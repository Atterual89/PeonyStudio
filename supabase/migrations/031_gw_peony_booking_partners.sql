-- Il partner e' collegato alla PRENOTAZIONE, non al socio.
-- Conserva anche le assegnazioni vuote: una rimozione esplicita deve prevalere
-- su un testo obsoleto presente nel checkout Ticket Tailor.
create table if not exists public.gw_peony_booking_partners (
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_id text not null,
  partner_name text,
  partner_email text,
  person_id uuid references public.gw_people(id) on delete set null,
  member_row_id uuid references public.association_members(id) on delete set null,
  updated_by uuid references public.gw_operators(id),
  updated_at timestamptz not null default now(),
  primary key (event_id, ticket_id),
  constraint gw_peony_partner_name_limit check (char_length(coalesce(partner_name,'')) <= 220),
  constraint gw_peony_partner_email_limit check (char_length(coalesce(partner_email,'')) <= 320)
);
create index if not exists gw_peony_booking_partners_member_idx
  on public.gw_peony_booking_partners(member_row_id)
  where member_row_id is not null;
alter table public.gw_peony_booking_partners enable row level security;
revoke all on public.gw_peony_booking_partners from public, anon, authenticated;
grant select, insert, update, delete on public.gw_peony_booking_partners to service_role;
notify pgrst, 'reload schema';
