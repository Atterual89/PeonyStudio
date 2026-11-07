-- Collega l'intestatario Ticket Tailor a una persona/socio senza modificare
-- il biglietto o la tabella ufficiale del libro soci.
create table if not exists public.gw_peony_booking_holders (
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_id text not null,
  person_id uuid references public.gw_people(id) on delete set null,
  member_row_id uuid references public.association_members(id) on delete set null,
  updated_by uuid references public.gw_operators(id),
  updated_at timestamptz not null default now(),
  primary key(event_id,ticket_id),
  constraint gw_peony_booking_holders_has_link check (
    person_id is not null or member_row_id is not null
  ),
  constraint gw_peony_booking_holders_single_link check (
    not (person_id is not null and member_row_id is not null)
  )
);
create index if not exists gw_peony_booking_holders_member_idx
  on public.gw_peony_booking_holders(member_row_id)
  where member_row_id is not null;
alter table public.gw_peony_booking_holders enable row level security;
revoke all on public.gw_peony_booking_holders from public,anon,authenticated;
grant select,insert,update,delete on public.gw_peony_booking_holders to service_role;
notify pgrst,'reload schema';
