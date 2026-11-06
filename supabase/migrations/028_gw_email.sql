-- FASE 7 — Email workshop. NON applicare automaticamente in produzione.
-- Reversibile con 028_gw_email.down.sql. Tutte le scritture via RPC service role.
begin;
do $$ begin
 if to_regclass('public.gw_email_texts') is not null then raise exception 'Migrazione 028 già applicata'; end if;
 if to_regclass('public.gw_membership_contacts') is null then raise exception 'Applicare prima 027'; end if;
end $$;

create table public.gw_email_texts (
 workshop_id uuid primary key references public.gw_workshops(id) on delete cascade,
 fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
 version integer not null default 1 check (version > 0),
 updated_by uuid references public.gw_operators(id),
 updated_at timestamptz not null default now()
);
create table public.gw_settings (
 key text primary key check (key = 'email_defaults'),
 fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
 version integer not null default 1 check (version > 0),
 updated_by uuid references public.gw_operators(id),
 updated_at timestamptz not null default now()
);
create type public.gw_email_kind as enum ('partner', 'partner_reminder', 'workshop_details');
create table public.gw_email_sends (
 id uuid primary key default gen_random_uuid(),
 workshop_id uuid not null references public.gw_workshops(id),
 person_id uuid not null references public.gw_people(id),
 kind public.gw_email_kind not null,
 number integer not null default 0 check (number >= 0),
 sent_on date not null,
 created_by uuid not null references public.gw_operators(id),
 created_at timestamptz not null default now(),
 deleted_at timestamptz,
 deleted_by uuid references public.gw_operators(id),
 constraint gw_email_kind_number_check check ((kind = 'partner_reminder') = (number > 0))
);
create index gw_email_sends_workshop_person on public.gw_email_sends(workshop_id,person_id,kind) where deleted_at is null;
create unique index gw_email_once_unique on public.gw_email_sends(workshop_id,person_id,kind) where deleted_at is null and kind <> 'partner_reminder';
create unique index gw_email_reminder_number_unique on public.gw_email_sends(workshop_id,person_id,kind,number) where deleted_at is null and kind = 'partner_reminder';

alter table public.gw_email_texts enable row level security;
alter table public.gw_settings enable row level security;
alter table public.gw_email_sends enable row level security;
revoke all on public.gw_email_texts, public.gw_settings, public.gw_email_sends from public, anon, authenticated;
-- La chiave service_role usa PostgREST: RLS bypass da sola non conferisce privilegi SQL.
grant select, insert, update, delete on public.gw_email_texts, public.gw_settings, public.gw_email_sends to service_role;
grant usage on type public.gw_email_kind to service_role;

create function public.gw_save_email_texts(p_operator_id uuid,p_workshop_id uuid,p_version integer,p_fields jsonb)
returns integer language plpgsql set search_path=public,pg_temp as $$
declare v_old gw_email_texts; v_version integer;
begin
 if not exists(select 1 from gw_operators where id=p_operator_id and role='admin') then raise exception 'gw_not_found' using errcode='GW404'; end if;
 if not exists(select 1 from gw_workshops where id=p_workshop_id and deleted_at is null) then raise exception 'gw_not_found' using errcode='GW404'; end if;
 if jsonb_typeof(p_fields) is distinct from 'object' or length(p_fields::text)>40000 then raise exception 'gw_invalid' using errcode='GW400'; end if;
 select * into v_old from gw_email_texts where workshop_id=p_workshop_id for update;
 if found then
   if v_old.version<>p_version then raise exception 'gw_conflict' using errcode='GW409'; end if;
   update gw_email_texts set fields=p_fields,version=version+1,updated_by=p_operator_id,updated_at=now()
     where workshop_id=p_workshop_id returning version into v_version;
   perform gw_audit(p_operator_id,'email_texts',p_workshop_id,'update',v_old.fields,p_fields);
 else
   if p_version<>0 then raise exception 'gw_conflict' using errcode='GW409'; end if;
   insert into gw_email_texts(workshop_id,fields,updated_by) values(p_workshop_id,p_fields,p_operator_id) returning version into v_version;
   perform gw_audit(p_operator_id,'email_texts',p_workshop_id,'insert',null,p_fields);
 end if;
 return v_version;
end $$;

create function public.gw_save_email_defaults(p_operator_id uuid,p_version integer,p_fields jsonb)
returns integer language plpgsql set search_path=public,pg_temp as $$
declare v_old gw_settings; v_version integer;
begin
 if not exists(select 1 from gw_operators where id=p_operator_id and role='admin') then raise exception 'gw_not_found' using errcode='GW404'; end if;
 if jsonb_typeof(p_fields) is distinct from 'object' or length(p_fields::text)>25000 then raise exception 'gw_invalid' using errcode='GW400'; end if;
 select * into v_old from gw_settings where key='email_defaults' for update;
 if found then
   if v_old.version<>p_version then raise exception 'gw_conflict' using errcode='GW409'; end if;
   update gw_settings set fields=p_fields,version=version+1,updated_by=p_operator_id,updated_at=now()
     where key='email_defaults' returning version into v_version;
   perform gw_audit(p_operator_id,'email_defaults',p_operator_id,'update',v_old.fields,p_fields);
 else
   if p_version<>0 then raise exception 'gw_conflict' using errcode='GW409'; end if;
   insert into gw_settings(key,fields,updated_by) values('email_defaults',p_fields,p_operator_id) returning version into v_version;
   perform gw_audit(p_operator_id,'email_defaults',p_operator_id,'insert',null,p_fields);
 end if;
 return v_version;
end $$;

create function public.gw_mark_email_sends(p_operator_id uuid,p_workshop_id uuid,p_person_ids uuid[],p_kind public.gw_email_kind,p_sent_on date)
returns integer language plpgsql set search_path=public,pg_temp as $$
declare v_id uuid; v_created gw_email_sends; v_n integer; v_count integer:=0;
begin
 if not exists(select 1 from gw_operators where id=p_operator_id and role='admin') then raise exception 'gw_not_found' using errcode='GW404'; end if;
 if not exists(select 1 from gw_workshops where id=p_workshop_id and deleted_at is null) then raise exception 'gw_not_found' using errcode='GW404'; end if;
 if p_sent_on is null or p_sent_on>current_date or coalesce(array_length(p_person_ids,1),0)<1 or coalesce(array_length(p_person_ids,1),0)>500 then
  raise exception 'gw_invalid' using errcode='GW400';
 end if;
 for v_id in select distinct unnest(p_person_ids) loop
   perform 1 from gw_people where id=v_id and merged_into is null and deleted_at is null for update;
   if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
   if not exists (select 1 from gw_booking_participants bp join gw_bookings b on b.id=bp.booking_id
                  where bp.person_id=v_id and b.workshop_id=p_workshop_id and b.deleted_at is null
                  and bp.deleted_at is null and bp.removed_at is null and b.status in ('prenotato','acconto','saldato'))
   then raise exception 'gw_invalid' using errcode='GW400'; end if;
   if p_kind='workshop_details' and not exists (select 1 from gw_booking_participants bp join gw_bookings b on b.id=bp.booking_id
                  where bp.person_id=v_id and b.workshop_id=p_workshop_id and b.deleted_at is null and bp.deleted_at is null
                  and bp.removed_at is null and b.status in ('acconto','saldato'))
   then raise exception 'gw_invalid' using errcode='GW400'; end if;
   if p_kind='partner_reminder' then
      if not exists (select 1 from gw_email_sends where workshop_id=p_workshop_id and person_id=v_id and kind='partner' and deleted_at is null) then raise exception 'gw_invalid' using errcode='GW400'; end if;
      select coalesce(max(number),0)+1 into v_n from gw_email_sends where workshop_id=p_workshop_id and person_id=v_id and kind='partner_reminder' and deleted_at is null;
   else
      if exists (select 1 from gw_email_sends where workshop_id=p_workshop_id and person_id=v_id and kind=p_kind and deleted_at is null) then raise exception 'gw_conflict' using errcode='GW409'; end if;
      v_n:=0;
   end if;
   insert into gw_email_sends(workshop_id,person_id,kind,number,sent_on,created_by)
    values(p_workshop_id,v_id,p_kind,v_n,p_sent_on,p_operator_id) returning * into v_created;
   perform gw_audit(p_operator_id,'email_send',v_created.id,'insert',null,to_jsonb(v_created));
   v_count:=v_count+1;
 end loop;
 return v_count;
end $$;

create function public.gw_delete_email_send(p_operator_id uuid,p_id uuid)
returns void language plpgsql set search_path=public,pg_temp as $$
declare v_old gw_email_sends;
begin
 if not exists(select 1 from gw_operators where id=p_operator_id and role='admin') then raise exception 'gw_not_found' using errcode='GW404'; end if;
 select * into v_old from gw_email_sends where id=p_id and deleted_at is null for update;
 if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
 update gw_email_sends set deleted_at=now(),deleted_by=p_operator_id where id=p_id;
 perform gw_audit(p_operator_id,'email_send',p_id,'delete',to_jsonb(v_old),jsonb_build_object('eliminato',true));
end $$;

-- Service-role only. DB role permissions controlled also at Next.js server boundary.
revoke all on function public.gw_save_email_texts(uuid,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.gw_save_email_defaults(uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.gw_mark_email_sends(uuid,uuid,uuid[],public.gw_email_kind,date) from public,anon,authenticated;
revoke all on function public.gw_delete_email_send(uuid,uuid) from public,anon,authenticated;
-- RPC invocate esclusivamente dal server Next.js con credenziali service_role.
grant execute on function public.gw_save_email_texts(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.gw_save_email_defaults(uuid,integer,jsonb) to service_role;
grant execute on function public.gw_mark_email_sends(uuid,uuid,uuid[],public.gw_email_kind,date) to service_role;
grant execute on function public.gw_delete_email_send(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
