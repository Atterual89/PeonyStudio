-- Riconcilia una verifica email esistente con il movimento originario senza duplicare la quota.
-- Richiamabile solo dal backend service_role e dall'admin che effettua l'operazione.
create or replace function public.gw_reconcile_verified_email_payment(
  p_payment_id uuid, p_person_id uuid, p_period_from date, p_operator_id uuid
) returns smallint
language plpgsql security invoker set search_path=public,pg_temp
as $$
declare
 v_payment public.gw_association_payment_emails%rowtype;
 v_person public.gw_people%rowtype;
 v_verified public.association_members%rowtype;
 v_period date;
begin
 if not exists(select 1 from public.gw_operators where id=p_operator_id and role='admin')
 then raise exception 'Admin non autorizzato'; end if;
 select * into v_payment from public.gw_association_payment_emails
  where id=p_payment_id for update;
 if not found or v_payment.status <> 'pending' or v_payment.amount_cents <> 1500
 then raise exception 'Pagamento non riconciliabile'; end if;
 v_period:=case when extract(month from v_payment.paid_at at time zone 'Europe/Rome')>=9
  then make_date(extract(year from v_payment.paid_at at time zone 'Europe/Rome')::int,9,1)
  else make_date(extract(year from v_payment.paid_at at time zone 'Europe/Rome')::int-1,9,1) end;
 if p_period_from <> v_period then raise exception 'Annualità incoerente'; end if;
 select * into v_person from public.gw_people where id=p_person_id
   and merged_into is null and deleted_at is null for update;
 if not found or v_person.email is null then raise exception 'Anagrafica non valida'; end if;
 -- Prova già verificata con il riferimento reale della stessa transazione.
 select * into v_verified from public.association_members
 where source='manual_override' and membership_status='verified'
  and lower(trim(email))=lower(trim(v_person.email))
  and membership_starts_at <= (v_payment.paid_at at time zone 'Europe/Rome')::date
  and membership_expires_at >= (v_payment.paid_at at time zone 'Europe/Rome')::date
  and (notes_admin like '%riferimento '||v_payment.transaction_ref||';%'
       or notes_admin like '%riferimento '||p_payment_id::text||')%')
 order by updated_at desc limit 1 for update;
 if not found then raise exception 'Nessuna verifica email riferita a questo pagamento'; end if;
 if exists(select 1 from public.gw_association_payment_allocations
   where payment_id=p_payment_id or (person_id=p_person_id and period_from=p_period_from))
 then raise exception 'Esiste già una assegnazione: controllare lo storico'; end if;
 insert into public.gw_association_payment_allocations
 (payment_id,person_id,slot,period_from,gross_quota_cents,validated_by)
 values(p_payment_id,p_person_id,1,p_period_from,1500,p_operator_id);
 update public.gw_association_payment_emails set status='confirmed',updated_at=now()
 where id=p_payment_id;
 return 1;
end;
$$;
revoke all on function public.gw_reconcile_verified_email_payment(uuid,uuid,date,uuid)
 from public,anon,authenticated;
grant execute on function public.gw_reconcile_verified_email_payment(uuid,uuid,date,uuid) to service_role;
