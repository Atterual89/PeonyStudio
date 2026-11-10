-- Regola 1/9: la data della transazione determina l'anno di scadenza.
-- Aggiorna l'RPC service-role e riallinea le quote email 2026 già attribuite
-- all'annualità precedente (senza modificare il libro soci ufficiale).
begin;
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
  v_manual_notes text;
  v_email text := nullif(lower(btrim(coalesce(p_email,''))), '');
  v_first text := nullif(btrim(coalesce(p_first_name,'')), '');
  v_last text := nullif(btrim(coalesce(p_last_name,'')), '');
  v_id_key text;
  v_count integer;
  v_expected_from date;
  v_expected_until date;
  v_paid_year integer;
begin
  if num_nonnulls(p_person_id,p_member_key) <> 1 or p_operator_id is null or
     (v_email is null and (v_first is null or v_last is null)) then
    raise exception 'Identità associativa incompleta';
  end if;
  select * into v_payment from public.gw_association_payment_emails
   where id=p_payment_id for update;
  if not found or v_payment.status <> 'pending' then
    raise exception 'Pagamento già chiuso o inesistente';
  end if;
  if v_payment.paid_at is null then
    raise exception 'Data del pagamento non disponibile';
  end if;
  v_paid_year := extract(year from v_payment.paid_at at time zone 'Europe/Rome')::integer;
  v_paid_year := v_paid_year + case when extract(month from v_payment.paid_at at time zone 'Europe/Rome') >= 9 then 1 else 0 end;
  v_expected_from := make_date(v_paid_year-1,9,1);
  v_expected_until := make_date(v_paid_year,12,31);
  if v_expected_from < date '2025-09-01' or
     p_period_from <> v_expected_from or p_period_until <> v_expected_until then
    raise exception 'Annualità incompatibile con la data del versamento';
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
    select membership_status, notes_admin into v_manual_status, v_manual_notes
      from public.association_members where id=v_manual_id;
    -- Una prova email già associata non può essere associata nuovamente.
    if v_manual_status='verified' and
       v_manual_notes like 'Quota confermata da email (%' then
      raise exception 'Quota email già verificata per il periodo';
    end if;
    -- Una spunta manuale può invece essere sostituita dal pagamento provato.
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
      notes_admin='Quota confermata da email (riferimento '||p_payment_id::text||')'
        || case when v_manual_status='verified' then ' · sostituisce verifica manuale' else '' end,
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
-- Allinea le prove via email: solo i versamenti documentati dal 1/9/2026.
-- L'id della email nelle note garantisce che la riga sia quella effettivamente
-- confermata, evitando di dedurre una data dai moduli Google.
update public.association_members m
   set membership_starts_at = date '2026-09-01',
       membership_expires_at = date '2027-12-31',
       source_row_id = coalesce(m.source_row_id,'manual:quota') || ':2026-09-01',
       updated_at = now()
  from public.gw_association_payment_emails e
 where m.source='manual_override'
   and m.membership_starts_at=date '2025-09-01'
   and m.membership_expires_at=date '2026-12-31'
   and (e.paid_at at time zone 'Europe/Rome')::date between date '2026-09-01' and date '2026-12-31'
   and m.notes_admin like 'Quota confermata da email (riferimento '||e.id::text||')%';

-- Le verifiche manuali già attribuite esplicitamente al 2027 diventano
-- utilizzabili dal 1/9/2026; non sono cancellate né duplicate.
update public.association_members m
   set membership_starts_at=date '2026-09-01',
       source_row_id=replace(coalesce(m.source_row_id,''),':2027-01-01',':2026-09-01'),
       updated_at=now()
 where m.source='manual_override'
   and m.membership_starts_at=date '2027-01-01'
   and m.membership_expires_at=date '2027-12-31';

-- Conserva la traccia della transazione e dello slot assegnato alla persona.
update public.gw_association_payment_allocations a
   set period_from=date '2026-09-01'
  from public.gw_association_payment_emails e
 where a.payment_id=e.id
   and a.period_from in (date '2025-09-01',date '2027-01-01')
   and (e.paid_at at time zone 'Europe/Rome')::date between date '2026-09-01' and date '2026-12-31';

commit;
notify pgrst, 'reload schema';
