-- Secret-bearing Gmail OAuth connection metadata. Refresh tokens are encrypted in the app.
begin;
create table if not exists public.gw_gmail_connections (
  id text primary key check (id='peony'),
  gmail_address text not null,
  refresh_token_ciphertext text not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.gw_gmail_connections enable row level security;
revoke all on public.gw_gmail_connections from public,anon,authenticated;
grant select,insert,update,delete on public.gw_gmail_connections to service_role;
commit;
notify pgrst, 'reload schema';
