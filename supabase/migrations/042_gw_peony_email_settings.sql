-- Event-level email language and workshop-specific logistics.
-- Only stores editorial overrides; TT title/date/description remain in events.
begin;
create table if not exists public.gw_peony_email_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  language_override text check (language_override in ('it','en')),
  detail_fields jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail_fields)='object' and pg_column_size(detail_fields) < 30000),
  updated_by uuid references public.gw_operators(id),
  updated_at timestamptz not null default now()
);
alter table public.gw_peony_email_settings enable row level security;
revoke all on public.gw_peony_email_settings from public, anon, authenticated;
grant select, insert, update, delete on public.gw_peony_email_settings to service_role;
notify pgrst, 'reload schema';
commit;
