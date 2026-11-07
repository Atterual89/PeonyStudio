-- Gestionale unificato: eventi Peony alimentati esclusivamente dai biglietti Ticket Tailor.
-- Non modifica ne' replica ordini, biglietti o partecipanti di Ticket Tailor.
-- Gli operatori applicativi sono verificati sul server prima di accedere alle tabelle.

create table if not exists public.gw_peony_checkins (
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_id text not null,
  present boolean not null,
  updated_by uuid references public.gw_operators(id),
  updated_at timestamptz not null default now(),
  primary key (event_id, ticket_id)
);

create table if not exists public.gw_peony_email_templates (
  event_id uuid primary key references public.events(id) on delete cascade,
  subject text not null default '',
  body text not null default '',
  updated_by uuid references public.gw_operators(id),
  updated_at timestamptz not null default now(),
  constraint gw_peony_email_subject_limit check (char_length(subject) <= 300),
  constraint gw_peony_email_body_limit check (char_length(body) <= 30000)
);

create table if not exists public.gw_peony_email_sends (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_id text not null,
  subject text not null,
  sent_on date not null default current_date,
  created_by uuid references public.gw_operators(id),
  created_at timestamptz not null default now(),
  unique (event_id, ticket_id, subject, sent_on)
);

create index if not exists gw_peony_email_sends_event_idx
  on public.gw_peony_email_sends(event_id, sent_on desc);

alter table public.gw_peony_checkins enable row level security;
alter table public.gw_peony_email_templates enable row level security;
alter table public.gw_peony_email_sends enable row level security;

revoke all on public.gw_peony_checkins from public, anon, authenticated;
revoke all on public.gw_peony_email_templates from public, anon, authenticated;
revoke all on public.gw_peony_email_sends from public, anon, authenticated;

grant select, insert, update, delete on public.gw_peony_checkins to service_role;
grant select, insert, update, delete on public.gw_peony_email_templates to service_role;
grant select, insert, update, delete on public.gw_peony_email_sends to service_role;

notify pgrst, 'reload schema';
