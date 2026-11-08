-- Explicit admin confirmation for an official-book member stored under a nickname.
-- Never auto-match a nickname to legal identity; the UI requires a human choice.
begin;
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
    and m.membership_status='verified'
    and public.gw_name_key(concat_ws(' ',m.first_name,m.last_name))=p_name_key;
 if v_count<>1 then
  raise exception 'Identità non univoca nel libro soci ufficiale' using errcode='GW400';
 end if;
 select * into v_member from public.association_members m
  where m.source='official_members_book'
    and nullif(btrim(coalesce(m.email,'')),'') is null
    and m.membership_status='verified'
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
 update public.gw_people set membership_name_key=p_name_key,version=version+1
  where id=p_person_id returning * into v_after;
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
