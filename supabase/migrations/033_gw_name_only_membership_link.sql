-- Collegamento esplicito per soci Team Artist senza email.
-- Prima di questa correzione la conferma per nome cambiava solo i dati
-- anagrafici: la persona continuava ad apparire tra i non collegati.
alter table public.gw_people
  add column if not exists membership_name_key text;

create index if not exists gw_people_membership_name_key_idx
  on public.gw_people(membership_name_key)
  where membership_name_key is not null and deleted_at is null;

create or replace function public.gw_clear_stale_member_name_link()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.membership_name_key is not null and (
    new.association_member_id is not null or
    nullif(btrim(new.membership_email),'') is not null or
    gw_name_key(concat_ws(' ',new.first_name,new.last_name)) is distinct from new.membership_name_key
  ) then
    new.membership_name_key := null;
  end if;
  return new;
end;
$$;

drop trigger if exists gw_clear_stale_member_name_link_trigger on public.gw_people;
create trigger gw_clear_stale_member_name_link_trigger
before insert or update on public.gw_people
for each row execute function public.gw_clear_stale_member_name_link();

-- Persiste il collegamento esclusivamente se il nome è univoco e
-- corrisponde a una riga ufficiale senza email; non inferire omonimi.
create or replace function public.gw_set_member_name_link(
  p_operator_id uuid,
  p_person_id uuid,
  p_version integer,
  p_name_key text
)
returns integer language plpgsql set search_path=public,pg_temp as $$
declare
  v_before public.gw_people%rowtype;
  v_after public.gw_people%rowtype;
  v_count integer;
  v_people integer;
begin
  select * into v_before from public.gw_people
    where id=p_person_id and version=p_version and deleted_at is null and merged_into is null
    for update;
  if not found then
    perform public.gw_raise_missing_or_conflict('public.gw_people',p_person_id);
  end if;

  if p_name_key is not null then
    if length(p_name_key)>300 or p_name_key is distinct from
      public.gw_name_key(concat_ws(' ',v_before.first_name,v_before.last_name)) then
      raise exception 'gw_invalid' using errcode='GW400',detail='Nome o chiave non corrispondente.';
    end if;
    select count(*) into v_count
      from public.association_members m
     where m.source='official_members_book'
       and nullif(btrim(m.email),'') is null
       and public.gw_name_key(concat_ws(' ',m.first_name,m.last_name))=p_name_key;
    if v_count<>1 then
      raise exception 'gw_invalid' using errcode='GW400',detail='Corrispondenza non univoca nel libro soci.';
    end if;
    if exists(
      select 1 from public.association_members m
       where nullif(btrim(m.email),'') is not null
         and public.gw_name_key(concat_ws(' ',m.first_name,m.last_name))=p_name_key
    ) then
      raise exception 'gw_invalid' using errcode='GW400',detail='Corrispondenza da verificare via email.';
    end if;
    select count(*) into v_people from public.gw_people p
      where p.deleted_at is null and p.merged_into is null
        and public.gw_name_key(concat_ws(' ',p.first_name,p.last_name))=p_name_key;
    if v_people<>1 then
      raise exception 'gw_invalid' using errcode='GW400',detail='Anagrafiche omonime: selezione manuale richiesta.';
    end if;
  end if;

  update public.gw_people
     set membership_name_key=p_name_key,
         membership_email=null,
         association_member_id=null,
         version=version+1
   where id=p_person_id
   returning * into v_after;

  perform public.gw_audit(
    p_operator_id,'person',p_person_id,'update',
    jsonb_build_object('membership_name_key',v_before.membership_name_key,
      'association_member_id',v_before.association_member_id,
      'membership_email',v_before.membership_email),
    jsonb_build_object('membership_name_key',v_after.membership_name_key,
      'association_member_id',v_after.association_member_id,
      'membership_email',v_after.membership_email)
  );
  return v_after.version;
end;
$$;

revoke all on function public.gw_set_member_name_link(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.gw_set_member_name_link(uuid,uuid,integer,text) to service_role;
