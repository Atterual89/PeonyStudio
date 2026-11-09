-- Area fiscale Alessandra -> revisione admin -> anagrafica centrale.
-- Import e aggiornamenti di Alessandra NON associano né creano gw_people.
-- Solo una scelta esplicita dell'admin può fissare person_id.
create table if not exists public.gw_ale_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_operator_id uuid not null references public.gw_operators(id),
  source_key text not null check(source_key ~ '^[a-f0-9]{64}$'),
  display_name text not null check(length(btrim(display_name)) between 2 and 300),
  email text,
  fields jsonb not null default '{}'::jsonb check(jsonb_typeof(fields)='object'),
  person_id uuid references public.gw_people(id) on delete restrict,
  linked_by uuid references public.gw_operators(id),
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_operator_id,source_key)
);
create index if not exists gw_ale_contacts_owner_idx
  on public.gw_ale_contacts(owner_operator_id,updated_at desc);
create unique index if not exists gw_ale_contacts_person_unique_idx
  on public.gw_ale_contacts(owner_operator_id,person_id) where person_id is not null;

create table if not exists public.gw_ale_contact_match_audit (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.gw_ale_contacts(id),
  person_id uuid not null references public.gw_people(id),
  operator_id uuid not null references public.gw_operators(id),
  action text not null default 'confirmed' check(action='confirmed'),
  created_at timestamptz not null default now()
);
create index if not exists gw_ale_match_audit_contact_idx
  on public.gw_ale_contact_match_audit(contact_id,created_at desc);

alter table public.gw_ale_contacts enable row level security;
alter table public.gw_ale_contact_match_audit enable row level security;
revoke all on public.gw_ale_contacts,public.gw_ale_contact_match_audit
  from public,anon,authenticated;
grant select,insert,update,delete on public.gw_ale_contacts,public.gw_ale_contact_match_audit to service_role;

-- Lo staging è idempotente per chiave di esportazione. Nessuna ricerca
-- per nome/email nel registro soci e nessuna fusione implicita di identità.
create or replace function public.gw_import_ale_contacts(p_operator_id uuid,p_rows jsonb)
returns jsonb language plpgsql set search_path to 'public','pg_temp'
as $$
declare
  v_item jsonb; v_name text; v_email text; v_key text; v_fields jsonb;
  v_contact uuid; v_person uuid;
  v_created integer:=0; v_updated integer:=0; v_skipped integer:=0;
begin
  perform 1 from gw_operators where id=p_operator_id and active and role='organizzatrice';
  if not found then raise exception 'gw_forbidden' using errcode='GW403'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) not between 1 and 1000
  then raise exception 'gw_invalid' using errcode='GW400'; end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_name:=btrim(coalesce(v_item->>'display_name',''));
    v_email:=nullif(lower(btrim(coalesce(v_item->>'email',''))),'');
    v_key:=coalesce(v_item->>'source_key','');
    v_fields:=v_item->'fields';
    if length(v_name) not between 2 and 300 or v_key !~ '^[a-f0-9]{64}$'
       or (v_email is not null and (length(v_email)>320 or position('@' in v_email)=0))
       or jsonb_typeof(v_fields) is distinct from 'object'
       or length(v_fields::text)>16000
    then v_skipped:=v_skipped+1;continue; end if;
    perform pg_advisory_xact_lock(hashtext(p_operator_id::text||':'||v_key));
    select id into v_contact from gw_ale_contacts
      where owner_operator_id=p_operator_id and source_key=v_key;
    if v_contact is null then
      insert into gw_ale_contacts(owner_operator_id,source_key,display_name,email,fields)
      values(p_operator_id,v_key,v_name,v_email,v_fields);
      v_created:=v_created+1;
    else
      update gw_ale_contacts set display_name=v_name,email=v_email,fields=v_fields,updated_at=now()
      where id=v_contact returning person_id into v_person;
      v_updated:=v_updated+1;
      -- Un abbinamento già confermato rimane stabile; aggiorna SOLO i dati
      -- fiscali della persona, non nome/email, quota o iscrizione associativa.
      if v_person is not null then
        update gw_billing_profiles set fields=v_fields,updated_at=now()
        where person_id=v_person and owner_operator_id=p_operator_id;
      end if;
      v_person:=null;
    end if;
    v_contact:=null;
  end loop;
  return jsonb_build_object('created',v_created,'updated',v_updated,'skipped',v_skipped);
end;
$$;
revoke all on function public.gw_import_ale_contacts(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.gw_import_ale_contacts(uuid,jsonb) to service_role;

create or replace function public.gw_update_ale_contact(
  p_operator_id uuid,p_contact_id uuid,p_display_name text,p_email text,p_fields jsonb
)
returns void language plpgsql set search_path to 'public','pg_temp'
as $$
declare v_person uuid; v_name text; v_email text;
begin
  perform 1 from gw_operators where id=p_operator_id and active and role='organizzatrice';
  if not found then raise exception 'gw_forbidden' using errcode='GW403'; end if;
  v_name:=btrim(coalesce(p_display_name,''));
  v_email:=nullif(lower(btrim(coalesce(p_email,''))),'');
  if length(v_name) not between 2 and 300
     or (v_email is not null and (length(v_email)>320 or position('@' in v_email)=0))
     or jsonb_typeof(p_fields) is distinct from 'object'
     or length(p_fields::text)>16000
  then raise exception 'gw_invalid' using errcode='GW400'; end if;
  update gw_ale_contacts set
    display_name=v_name,email=v_email,fields=p_fields,updated_at=now()
    where id=p_contact_id and owner_operator_id=p_operator_id
    returning person_id into v_person;
  if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
  if v_person is not null then
    update gw_billing_profiles set fields=p_fields,updated_at=now()
      where person_id=v_person and owner_operator_id=p_operator_id;
  end if;
end;
$$;
revoke all on function public.gw_update_ale_contact(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.gw_update_ale_contact(uuid,uuid,text,text,jsonb) to service_role;

-- Il matching è una conferma esplicita. Non modifica gw_people, quote, moduli
-- o le prenotazioni. Se la persona non esiste va prima creata in Persone.
create or replace function public.gw_admin_match_ale_contact(
  p_admin_id uuid,p_contact_id uuid,p_person_id uuid
)
returns uuid language plpgsql set search_path to 'public','pg_temp'
as $$
declare v_contact gw_ale_contacts; v_person uuid; v_owner uuid;
begin
  perform 1 from gw_operators where id=p_admin_id and active and role='admin';
  if not found then raise exception 'gw_forbidden' using errcode='GW403'; end if;
  select * into v_contact from gw_ale_contacts where id=p_contact_id for update;
  if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
  if v_contact.person_id is not null then
    raise exception 'gw_already_linked' using errcode='GW409'; end if;
  select id into v_person from gw_people
    where id=p_person_id and deleted_at is null and merged_into is null;
  if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
  select owner_operator_id into v_owner from gw_billing_profiles where person_id=v_person;
  if v_owner is not null and v_owner<>v_contact.owner_operator_id then
    raise exception 'gw_billing_owned_by_another_operator' using errcode='GW409'; end if;
  if exists(select 1 from gw_ale_contacts
    where owner_operator_id=v_contact.owner_operator_id
      and person_id=v_person and id<>p_contact_id) then
    raise exception 'gw_already_matched' using errcode='GW409'; end if;
  update gw_ale_contacts set person_id=v_person,linked_by=p_admin_id,
    linked_at=now(),updated_at=now() where id=p_contact_id;
  insert into gw_billing_profiles(person_id,owner_operator_id,fields)
    values(v_person,v_contact.owner_operator_id,v_contact.fields)
    on conflict(person_id) do update set
      fields=gw_billing_profiles.fields||excluded.fields,updated_at=now()
      where gw_billing_profiles.owner_operator_id=excluded.owner_operator_id;
  insert into gw_ale_contact_match_audit(contact_id,person_id,operator_id)
    values(p_contact_id,v_person,p_admin_id);
  return v_person;
end;
$$;
revoke all on function public.gw_admin_match_ale_contact(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.gw_admin_match_ale_contact(uuid,uuid,uuid) to service_role;
