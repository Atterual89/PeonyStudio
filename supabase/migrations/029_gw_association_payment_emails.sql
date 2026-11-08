-- Import quote associative da notifiche Gmail, accesso esclusivo al service role.
-- Nessun dato sensibile e' accessibile dai client pubblici.
begin;
create table if not exists public.gw_payment_sync_state (
  source text primary key check (source in ('gmail_payments','ticket_tailor')),
  initial_from timestamptz,
  checked_through timestamptz,
  last_success_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.gw_association_payment_emails (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  provider text not null check (provider in ('paypal','qonto')),
  transaction_ref text,
  paid_at timestamptz not null,
  payer_name text,
  amount_cents integer not null check (amount_cents > 0),
  note text,
  status text not null default 'pending' check (status in ('pending','ignored','confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists gw_assoc_payment_transaction_unique
 on public.gw_association_payment_emails(provider, transaction_ref)
 where transaction_ref is not null;
create index if not exists gw_assoc_payment_review_idx
 on public.gw_association_payment_emails(status,paid_at desc);
create table if not exists public.gw_association_payment_allocations (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null references public.gw_association_payment_emails(id) on delete restrict,
 person_id uuid not null references public.gw_people(id) on delete restrict,
 period_from date not null,
 gross_quota_cents integer not null default 1500 check (gross_quota_cents = 1500),
 validated_by uuid not null,
 validated_at timestamptz not null default now(),
 unique (payment_id, person_id, period_from),
 unique (person_id, period_from, payment_id)
);
create index if not exists gw_assoc_alloc_payment on public.gw_association_payment_allocations(payment_id);
alter table public.gw_payment_sync_state enable row level security;
alter table public.gw_association_payment_emails enable row level security;
alter table public.gw_association_payment_allocations enable row level security;
revoke all on public.gw_payment_sync_state, public.gw_association_payment_emails,
 public.gw_association_payment_allocations from public, anon, authenticated;
grant select,insert,update,delete on public.gw_payment_sync_state,
 public.gw_association_payment_emails, public.gw_association_payment_allocations to service_role;
commit;
notify pgrst, 'reload schema';
