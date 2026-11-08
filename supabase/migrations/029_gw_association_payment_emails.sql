-- Import quote associative da notifiche Gmail, accesso esclusivo al service role.
-- Nessun dato sensibile e' accessibile dai client pubblici.
begin;
create table if not exists public.gw_payment_sync_state (
  source text primary key check (source in ('gmail_payments','ticket_tailor')),
  initial_from timestamptz,
  checked_through timestamptz,
  pending_window_from timestamptz,
  pending_window_until timestamptz,
  pending_page_token text,
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
 slot smallint not null check (slot between 1 and 3),
 period_from date not null,
 gross_quota_cents integer not null default 1500 check (gross_quota_cents = 1500),
 validated_by uuid not null,
 validated_at timestamptz not null default now(),
 unique (payment_id, slot),
 unique (payment_id, person_id, period_from),
 unique (person_id, period_from)
);
create index if not exists gw_assoc_alloc_payment on public.gw_association_payment_allocations(payment_id);
alter table public.gw_payment_sync_state enable row level security;
alter table public.gw_association_payment_emails enable row level security;
alter table public.gw_association_payment_allocations enable row level security;
revoke all on public.gw_payment_sync_state, public.gw_association_payment_emails,
 public.gw_association_payment_allocations from public, anon, authenticated;
grant select,insert,update,delete on public.gw_payment_sync_state,
 public.gw_association_payment_emails, public.gw_association_payment_allocations to service_role;
-- Aggregate in PostgreSQL instead of downloading every ticket to render the admin home.
create or replace function public.gw_peony_ticket_summary()
returns table(ticket_tailor_event_id text, ticket_count bigint, last_synced_at timestamptz)
language sql stable security invoker set search_path = public, pg_temp
as $$
 select t.ticket_tailor_event_id::text,
        count(*) filter (where t.status is null or lower(t.status) not similar to
          '%(void|cancelled|canceled|refunded|deleted|inactive)%')::bigint,
        max(t.last_synced_at)
 from public.ticket_tailor_issued_tickets t
 where t.ticket_tailor_event_id is not null
 group by t.ticket_tailor_event_id
$$;
revoke execute on function public.gw_peony_ticket_summary() from public,anon,authenticated;
grant execute on function public.gw_peony_ticket_summary() to service_role;
-- Proposte deterministiche: soltanto coincidenze esatte di nome/cognome o nickname.
-- Le proposte non confermano mai la quota.
create or replace function public.gw_payment_suggest_people()
returns table(payment_id uuid,person_id uuid,person_name text)
language sql stable security invoker set search_path = public, pg_temp
as $$
 select e.id,p.id,
        coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.nickname,p.email)
 from public.gw_association_payment_emails e
 join public.gw_people p on p.deleted_at is null and p.merged_into is null
 where e.status='pending' and e.payer_name is not null
 and (
   lower(btrim(e.payer_name))=lower(btrim(concat_ws(' ',p.first_name,p.last_name)))
   or lower(btrim(e.payer_name))=lower(btrim(concat_ws(' ',p.last_name,p.first_name)))
   or lower(btrim(e.payer_name))=lower(btrim(coalesce(p.nickname,'')))
 )
$$;
revoke execute on function public.gw_payment_suggest_people() from public,anon,authenticated;
grant execute on function public.gw_payment_suggest_people() to service_role;
commit;
notify pgrst, 'reload schema';
