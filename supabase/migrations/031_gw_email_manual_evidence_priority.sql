-- Upgrade a manually verified quota to a stronger, admin-confirmed Gmail payment proof.
-- Preserve the original manual verification in an append-only audit table; do not
-- treat the email notification as proof before an admin explicitly matches the payer.
begin;
create table if not exists public.gw_email_manual_supersessions (
 id uuid primary key default gen_random_uuid(),
 manual_member_id uuid not null references public.association_members(id) on delete restrict,
 period_from date not null,
 allocation_id uuid not null unique references public.gw_association_payment_allocations(id) on delete restrict,
 previous_manual_evidence jsonb not null,
 updated_by uuid not null,
 created_at timestamptz not null default now(),
 unique(manual_member_id, period_from)
);
alter table public.gw_email_manual_supersessions enable row level security;
revoke all on public.gw_email_manual_supersessions from public,anon,authenticated;
grant select,insert on public.gw_email_manual_supersessions to service_role;

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
  v_alloc_id uuid;
  v_manual_before jsonb;
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

    if v_manual_status='verified' then
      if exists(select 1 from public.gw_email_manual_supersessions s
                where s.manual_member_id=v_manual_id and s.period_from=p_period_from) then
        raise exception 'La verifica manuale ha già una prova email associata';
      end if;
      if exists(select 1 from public.gw_association_payment_allocations a
                where a.period_from=p_period_from
                  and ((p_person_id is not null and a.person_id=p_person_id)
                    or (p_member_key is not null and a.member_key=p_member_key))) then
        raise exception 'Quota già associata a una prova email';
      end if;
      if exists(select 1 from public.association_members a
                where a.id=v_manual_id and a.notes_admin like 'Quota confermata da email%') then
        raise exception 'La quota ha già una prova email';
      end if;
      select jsonb_build_object(
        'status', a.membership_status,
        'starts_at', a.membership_starts_at,
        'expires_at', a.membership_expires_at,
        'notes_admin', a.notes_admin,
        'source_row_id', a.source_row_id,
        'updated_at', a.updated_at
      ) into v_manual_before from public.association_members a where a.id=v_manual_id;
    end if;
  end if;
  insert into public.gw_association_payment_allocations
    (payment_id,person_id,member_key,slot,period_from,gross_quota_cents,validated_by)
  values(p_payment_id,p_person_id,p_member_key,v_slot,p_period_from,1500,p_operator_id)
  returning id into v_alloc_id;
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

  if v_manual_before is not null then
    insert into public.gw_email_manual_supersessions
      (manual_member_id,period_from,allocation_id,previous_manual_evidence,updated_by)
    values(v_manual_id,p_period_from,v_alloc_id,v_manual_before,p_operator_id);
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
notify pgrst,'reload schema';
