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
 person_id uuid references public.gw_people(id) on delete restrict,
 member_key text,
 constraint gw_payment_target_one check (num_nonnulls(person_id,member_key)=1),
 slot smallint not null check (slot between 1 and 3),
 period_from date not null,
 gross_quota_cents integer not null default 1500 check (gross_quota_cents = 1500),
 validated_by uuid not null,
 validated_at timestamptz not null default now(),
 unique (payment_id, slot),
 unique (payment_id, person_id, period_from),
 unique (payment_id, member_key, period_from)
);
create index if not exists gw_assoc_alloc_payment on public.gw_association_payment_allocations(payment_id);
create unique index if not exists gw_alloc_unique_person_period on public.gw_association_payment_allocations(person_id,period_from) where person_id is not null;
create unique index if not exists gw_alloc_unique_member_period on public.gw_association_payment_allocations(member_key,period_from) where member_key is not null;
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

-- One database transaction for allocation, manual verification and payment closure.
-- Only a trusted server admin action may call this service-role-only function.
create or replace function public.gw_confirm_association_payment(
  p_payment_id uuid, p_person_id uuid, p_member_key text,
  p_period_from date, p_period_until date, p_operator_id uuid,
  p_first_name text, p_last_name text, p_email text
) returns smallint
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_payment public.gw_association_payment_emails%rowtype;
  v_capacity integer;
  v_slot smallint;
  v_manual_id uuid;
  v_manual_status text;
  v_email text := nullif(lower(btrim(coalesce(p_email,''))), '');
  v_first text := nullif(btrim(coalesce(p_first_name,'')), '');
  v_last text := nullif(btrim(coalesce(p_last_name,'')), '');
  v_id_key text;
  v_count integer;
begin
  if num_nonnulls(p_person_id,p_member_key) <> 1 or p_operator_id is null or
     (v_email is null and (v_first is null or v_last is null)) then
    raise exception 'Identità associativa incompleta';
  end if;
  if not ((p_period_from=date '2025-09-01' and p_period_until=date '2026-12-31') or
      (p_period_from >= date '2027-01-01' and
       extract(month from p_period_from)=1 and extract(day from p_period_from)=1 and
       p_period_until=make_date(extract(year from p_period_from)::int,12,31))) then
    raise exception 'Periodo associativo non valido';
  end if;
  select * into v_payment from public.gw_association_payment_emails
   where id=p_payment_id for update;
  if not found or v_payment.status <> 'pending' then
    raise exception 'Pagamento già chiuso o inesistente';
  end if;
  v_capacity := case
    when v_payment.amount_cents in (1500,3000,4500)
      then v_payment.amount_cents / 1500
    when v_payment.provider='paypal' and v_payment.amount_cents between 1380 and 1499 then 1
    when v_payment.provider='paypal' and v_payment.amount_cents between 2760 and 2999 then 2
    when v_payment.provider='paypal' and v_payment.amount_cents between 4140 and 4499 then 3
    else 0 end;
  if v_capacity=0 then raise exception 'Importo non coerente con le quote'; end if;
  select s.slot+1 into v_slot from generate_series(0,v_capacity-1) as s(slot)
    where not exists(select 1 from public.gw_association_payment_allocations a
                     where a.payment_id=p_payment_id and a.slot=s.slot+1)
    order by s.slot limit 1;
  if v_slot is null then raise exception 'Nessuna quota disponibile'; end if;
  select a.id into v_manual_id from public.association_members a
    where a.source='manual_override'
      and a.membership_starts_at=p_period_from
      and (
        (v_email is not null and lower(btrim(coalesce(a.email,'')))=v_email)
        or (
           (v_email is null or nullif(btrim(coalesce(a.email,'')),'') is null)
           and v_first is not null and v_last is not null
           and lower(btrim(coalesce(a.first_name,'')))=lower(v_first)
           and lower(btrim(coalesce(a.last_name,'')))=lower(v_last)
        )
      )
    order by a.id limit 1 for update;
  if v_manual_id is not null then
    select membership_status into v_manual_status from public.association_members where id=v_manual_id;
    if v_manual_status='verified' then raise exception 'Quota già verificata per il periodo'; end if;
  end if;
  insert into public.gw_association_payment_allocations
    (payment_id,person_id,member_key,slot,period_from,gross_quota_cents,validated_by)
  values(p_payment_id,p_person_id,p_member_key,v_slot,p_period_from,1500,p_operator_id);
  v_id_key := case when v_email is not null
    then 'manual:email:'||v_email
    else 'manual:name:'||lower(btrim(concat_ws(' ',v_first,v_last))) end;
  if p_period_from <> date '2025-09-01' then
    v_id_key:=v_id_key||':'||to_char(p_period_from,'YYYY-MM-DD');
  end if;
  if v_manual_id is not null then
    update public.association_members set
      first_name=v_first,last_name=v_last,email=v_email,
      membership_status='verified',membership_starts_at=p_period_from,
      membership_expires_at=p_period_until,
      source_row_id=v_id_key,source_hash=null,
      notes_admin='Quota confermata da email (riferimento '||p_payment_id::text||')',
      updated_at=now()
      where id=v_manual_id;
  else
    insert into public.association_members
      (first_name,last_name,email,membership_status,membership_starts_at,
       membership_expires_at,source,source_row_id,source_hash,notes_admin)
    values(v_first,v_last,v_email,'verified',p_period_from,p_period_until,
      'manual_override',v_id_key,null,'Quota confermata da email (riferimento '||p_payment_id::text||')');
  end if;
  select count(*) into v_count from public.gw_association_payment_allocations
    where payment_id=p_payment_id;
  if v_count = v_capacity then
    update public.gw_association_payment_emails set status='confirmed',updated_at=now()
      where id=p_payment_id;
  end if;
  return v_slot;
end;
$$;
revoke execute on function public.gw_confirm_association_payment(uuid,uuid,text,date,date,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.gw_confirm_association_payment(uuid,uuid,text,date,date,uuid,text,text,text)
 to service_role;
commit;
notify pgrst, 'reload schema';
