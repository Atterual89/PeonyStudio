-- Fase Peony 8b: tre modelli HTML per evento, senza modificare i modelli LuXuria.
create table if not exists public.gw_peony_email_kinds (
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (kind in ('membership','partner','details')),
  subject text not null check (char_length(subject) between 1 and 300),
  body text not null check (char_length(body) <= 30000),
  updated_by uuid references public.gw_operators(id),
  updated_at timestamptz not null default now(),
  primary key (event_id, kind)
);
alter table public.gw_peony_email_kinds enable row level security;
revoke all on public.gw_peony_email_kinds from public, anon, authenticated;
grant select,insert,update,delete on public.gw_peony_email_kinds to service_role;

-- Mantiene l'eventuale modello precedente come comunicazione "details".
insert into public.gw_peony_email_kinds(event_id,kind,subject,body,updated_by,updated_at)
select event_id,'details',subject,body,updated_by,updated_at
from public.gw_peony_email_templates
where subject <> '' and char_length(subject) <= 300 and char_length(body) <= 30000
on conflict (event_id,kind) do nothing;

alter table public.gw_peony_email_sends
  add column if not exists kind text not null default 'details'
  check (kind in ('membership','partner','details'));

notify pgrst, 'reload schema';