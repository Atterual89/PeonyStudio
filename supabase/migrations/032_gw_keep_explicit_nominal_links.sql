-- Fix: the old BEFORE UPDATE trigger silently cleared a manually-confirmed link
-- whenever the profile only had a nickname (no legal first/last name).
-- This migration preserves existing data, only changes future manual link behavior.
begin;

-- La conferma esplicita consente un collegamento nominale anche se il profilo
-- contiene solo un nickname. Cambiare nome/cognome invalida la conferma,
-- salvo che il nuovo nome coincida finalmente con quello ufficiale.
alter table public.gw_people
 add column if not exists membership_name_explicit boolean not null default false;

create or replace function public.gw_clear_stale_member_name_link()
returns trigger language plpgsql set search_path=public,pg_temp
as $$
begin
  if new.membership_name_key is not null then
    if new.association_member_id is not null or
       nullif(btrim(new.membership_email),'') is not null then
      new.membership_name_key:=null;
    elsif new.membership_name_explicit then
      if TG_OP='UPDATE' and coalesce(old.membership_name_explicit,false) and
         (new.first_name is distinct from old.first_name or
          new.last_name is distinct from old.last_name) then
        if public.gw_name_key(concat_ws(' ',new.first_name,new.last_name))
           = new.membership_name_key then
          -- La scheda ora riporta esattamente il nome ufficiale.
          new.membership_name_explicit:=false;
        else
          new.membership_name_key:=null;
        end if;
      end if;
    elsif public.gw_name_key(concat_ws(' ',new.first_name,new.last_name))
        is distinct from new.membership_name_key then
      new.membership_name_key:=null;
    end if;
  end if;
  if new.membership_name_key is null then
    new.membership_name_explicit:=false;
  end if;
  return new;
end;
$$;

create or replace function public.gw_link_member_name_explicit(
 p_operator_id uuid,p_person_id uuid,p_version integer,p_name_key text
) returns integer
language plpgsql security invoker set search_path=public,pg_temp
as $$
declare
 v_before public.gw_people%rowtype;
 v_after public.gw_people%rowtype;
 v_member public.association_members%rowtype;
 v_count integer;
begin
 if p_name_key is null or length(p_name_key)>300 then
  raise exception 'Chiave socio non valida' using errcode='GW400';
 end if;
 select * into v_before from public.gw_people
  where id=p_person_id and version=p_version
  and deleted_at is null and merged_into is null for update;
 if not found then
  perform public.gw_raise_missing_or_conflict('public.gw_people',p_person_id);
 end if;
 if v_before.membership_name_key=p_name_key then return v_before.version; end if;
 if v_before.membership_email is not null or v_before.association_member_id is not null
    or v_before.membership_name_key is not null then
  raise exception 'Scheda già collegata: scollega prima il socio precedente' using errcode='GW400';
 end if;
 select count(*) into v_count from public.association_members m
  where m.source='official_members_book'
    and nullif(btrim(coalesce(m.email,'')),'') is null
    and public.gw_name_key(concat_ws(' ',m.first_name,m.last_name))=p_name_key;
 if v_count<>1 then
  raise exception 'Identità non univoca nel libro soci ufficiale' using errcode='GW400';
 end if;
 select * into v_member from public.association_members m
  where m.source='official_members_book'
    and nullif(btrim(coalesce(m.email,'')),'') is null
    and public.gw_name_key(concat_ws(' ',m.first_name,m.last_name))=p_name_key
  limit 1;
 if exists (
  select 1 from public.gw_people p where p.id<>p_person_id
  and p.deleted_at is null and p.merged_into is null
  and p.membership_name_key=p_name_key
 ) then
  raise exception 'Socio già collegato a un’altra persona' using errcode='GW400';
 end if;
 if nullif(btrim(coalesce(v_before.email,'')),'') is not null and exists (
  select 1 from public.association_members m
   where m.source='official_members_book'
   and lower(btrim(coalesce(m.email,'')))=lower(btrim(v_before.email))
   and public.gw_name_key(concat_ws(' ',m.first_name,m.last_name))<>p_name_key
 ) then
  raise exception 'L’email della scheda corrisponde a un socio diverso' using errcode='GW400';
 end if;
 update public.gw_people set membership_name_key=p_name_key,
  membership_name_explicit=true,version=version+1
  where id=p_person_id returning * into v_after;
 if v_after.membership_name_key is distinct from p_name_key then
   raise exception 'Collegamento non memorizzato: controllo di integrità fallito'
     using errcode='GW400';
 end if;
 perform public.gw_audit(
  p_operator_id,'person',p_person_id,'update',
  jsonb_build_object('membership_name_key',v_before.membership_name_key,
    'association_member_id',v_before.association_member_id,
    'membership_email',v_before.membership_email),
  jsonb_build_object('membership_name_key',v_after.membership_name_key,
    'association_member_id',v_after.association_member_id,
    'membership_email',v_after.membership_email,
    'nota','socio del libro ufficiale collegato da admin dopo verifica identità')
 );
 return v_after.version;
end;
$$;
revoke execute on function public.gw_link_member_name_explicit(uuid,uuid,integer,text)
 from public,anon,authenticated;
grant execute on function public.gw_link_member_name_explicit(uuid,uuid,integer,text)
 to service_role;
commit;
notify pgrst,'reload schema';
