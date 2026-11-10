-- Nuovi inserimenti di Alessandra: una notifica distinta per ciascun admin.
-- Le notifiche sono persistenti e indipendenti dai dispositivi push.
create table if not exists public.gw_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_operator_id uuid not null references public.gw_operators(id),
  actor_operator_id uuid not null references public.gw_operators(id),
  kind text not null check (kind in ('ale_booking','ale_contact')),
  source_id uuid not null,
  title text not null,
  body text not null,
  href text not null check (href like '/gestione/%'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_sent_at timestamptz,
  unique (recipient_operator_id,kind,source_id)
);
create index if not exists gw_admin_notifications_inbox_idx
  on public.gw_admin_notifications(recipient_operator_id,created_at desc);
create index if not exists gw_admin_notifications_push_idx
  on public.gw_admin_notifications(actor_operator_id,created_at)
  where push_sent_at is null;
alter table public.gw_admin_notifications enable row level security;
revoke all on public.gw_admin_notifications from public,anon,authenticated;
grant select,insert,update,delete on public.gw_admin_notifications to service_role;

-- Una sottoscrizione per browser/dispositivo, associata all'admin che l'ha autorizzata.
create table if not exists public.gw_admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.gw_operators(id),
  endpoint text not null unique check(length(endpoint) between 20 and 2048),
  p256dh text not null check(length(p256dh) between 80 and 150),
  auth text not null check(length(auth) between 15 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gw_admin_push_subscriptions_owner_idx
  on public.gw_admin_push_subscriptions(operator_id);
alter table public.gw_admin_push_subscriptions enable row level security;
revoke all on public.gw_admin_push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.gw_admin_push_subscriptions to service_role;

-- Trigger differito: nome intestatario e partner sono stati scritti
-- nello stesso inserimento (gw_create_registration / gw_import_roster).
create or replace function public.gw_notify_ale_booking_insert()
returns trigger language plpgsql security invoker
set search_path = 'public','pg_temp'
as $$
declare
  v_workshop_name text;
  v_people text;
begin
  if new.deleted_at is not null or not exists(
    select 1 from gw_operators
    where id=new.created_by and role='organizzatrice' and active
  ) then return new; end if;
  select coalesce(nullif(name,''),'Workshop') into v_workshop_name
    from gw_workshops where id=new.workshop_id;
  select string_agg(entered_as,' + ' order by is_primary desc,created_at)
    into v_people from (
      select nullif(btrim(entered_as),'') as entered_as,is_primary,created_at
      from gw_booking_participants
      where booking_id=new.id and removed_at is null and deleted_at is null
      order by is_primary desc,created_at limit 2
    ) as participants
    where entered_as is not null;
  insert into gw_admin_notifications(
    recipient_operator_id,actor_operator_id,kind,source_id,title,body,href
  )
  select id,new.created_by,'ale_booking',new.id,'Nuova iscrizione di Ale',
    left(coalesce(v_people,'Nuova iscrizione') || ' · ' || coalesce(v_workshop_name,'Workshop'),450),
    '/gestione/w/' || new.workshop_id::text || '?tab=partecipanti&booking=' || new.id::text
  from gw_operators where role='admin' and active
  on conflict (recipient_operator_id,kind,source_id) do nothing;
  return new;
end;
$$;
revoke all on function public.gw_notify_ale_booking_insert() from public,anon,authenticated;
grant execute on function public.gw_notify_ale_booking_insert() to service_role;
drop trigger if exists gw_notify_ale_booking_created on public.gw_bookings;
create constraint trigger gw_notify_ale_booking_created
  after insert on public.gw_bookings
  deferrable initially deferred for each row
  execute function public.gw_notify_ale_booking_insert();

create or replace function public.gw_notify_ale_contact_insert()
returns trigger language plpgsql security invoker
set search_path = 'public','pg_temp'
as $$
begin
  if not exists(
    select 1 from gw_operators
    where id=new.owner_operator_id and role='organizzatrice' and active
  ) then return new; end if;
  insert into gw_admin_notifications(
    recipient_operator_id,actor_operator_id,kind,source_id,title,body,href
  )
  select id,new.owner_operator_id,'ale_contact',new.id,'Nuovo contatto di Ale',
    left(new.display_name,300),
    '/gestione/altro/soci/abbinamenti-ale?contatto=' || new.id::text
  from gw_operators where role='admin' and active
  on conflict (recipient_operator_id,kind,source_id) do nothing;
  return new;
end;
$$;
revoke all on function public.gw_notify_ale_contact_insert() from public,anon,authenticated;
grant execute on function public.gw_notify_ale_contact_insert() to service_role;
drop trigger if exists gw_notify_ale_contact_created on public.gw_ale_contacts;
create trigger gw_notify_ale_contact_created
  after insert on public.gw_ale_contacts for each row
  execute function public.gw_notify_ale_contact_insert();
