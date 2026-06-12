alter table public.ticket_tailor_issued_tickets
  add column if not exists checked_in_source text,
  add column if not exists checked_in_note text,
  add column if not exists checked_in_at timestamptz;

alter table public.event_participants
  add column if not exists checked_in_source text,
  add column if not exists checked_in_note text,
  add column if not exists checked_in_at timestamptz;
