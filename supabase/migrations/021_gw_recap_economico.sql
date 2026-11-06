-- Gestionale Workshop — recap economico della home (Fase 4c, D23)
--
-- Tocca SOLO oggetti gw_. Rollback: 021_gw_recap_economico.down.sql
--
--   - gw_economic_overview(): UNA lettura aggregata con, per ogni workshop non
--     eliminato, i dati che servono a computeSettlement (somme per parte) e
--     a paymentTotals (pagato per prenotazione). Nessun calcolo del
--     consuntivo qui: lo fa il server con le stesse funzioni del tab Conti.
--     Sola lettura; le righe eliminate (D22) non contano.

begin;

do $$
begin
  if to_regprocedure('public.gw_restore_deleted(uuid, text, uuid)') is null then
    raise exception 'Migrazione 021 interrotta: applica prima 020_gw_eliminazioni.sql';
  end if;
  if to_regprocedure('public.gw_economic_overview()') is not null then
    raise exception 'Migrazione 021 interrotta: sembra già applicata (gw_economic_overview esiste)';
  end if;
end;
$$;

create function public.gw_economic_overview()
returns table (
  workshop_id uuid,
  peony_pct numeric,
  loss_peony_cents bigint,
  settlement_status public.gw_settlement_status,
  payment_count integer,
  expense_count integer,
  payments jsonb,
  expenses jsonb,
  transfers jsonb,
  carryovers_in jsonb,
  carryovers_out jsonb,
  bookings jsonb
)
language sql
stable
set search_path = public, pg_temp
as $$
  with live_payments as (
    select b.workshop_id, p.booking_id, p.received_by, p.amount_cents
      from gw_payments p
      join gw_bookings b on b.id = p.booking_id
     where p.deleted_at is null and b.deleted_at is null
  )
  select
    w.id,
    w.peony_pct,
    w.loss_peony_cents,
    w.settlement_status,
    (select count(*)::integer from live_payments lp where lp.workshop_id = w.id),
    (select count(*)::integer from gw_expenses e where e.workshop_id = w.id and e.deleted_at is null),
    coalesce((select jsonb_agg(jsonb_build_object('received_by', s.received_by, 'amount_cents', s.total))
                from (select lp.received_by, sum(lp.amount_cents) as total
                        from live_payments lp where lp.workshop_id = w.id
                       group by lp.received_by) s), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('advanced_by', s.advanced_by, 'amount_cents', s.total))
                from (select e.advanced_by, sum(e.amount_cents) as total
                        from gw_expenses e where e.workshop_id = w.id and e.deleted_at is null
                       group by e.advanced_by) s), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('from_party', s.from_party, 'to_party', s.to_party,
                                                  'status', s.status, 'amount_cents', s.total))
                from (select t.from_party, t.to_party, t.status, sum(t.amount_cents) as total
                        from gw_transfers t where t.workshop_id = w.id and t.deleted_at is null
                       group by t.from_party, t.to_party, t.status) s), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('debtor', s.debtor, 'creditor', s.creditor, 'amount_cents', s.total))
                from (select c.debtor, c.creditor, sum(c.amount_cents) as total
                        from gw_carryovers c where c.destination_workshop_id = w.id and c.deleted_at is null
                       group by c.debtor, c.creditor) s), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('debtor', s.debtor, 'creditor', s.creditor, 'amount_cents', s.total))
                from (select c.debtor, c.creditor, sum(c.amount_cents) as total
                        from gw_carryovers c where c.origin_workshop_id = w.id and c.deleted_at is null
                       group by c.debtor, c.creditor) s), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
                       'status', b.status,
                       'agreed_fee_cents', b.agreed_fee_cents,
                       'paid_cents', coalesce((select sum(lp.amount_cents) from live_payments lp where lp.booking_id = b.id), 0)))
                from gw_bookings b where b.workshop_id = w.id and b.deleted_at is null), '[]'::jsonb)
  from gw_workshops w
  where w.deleted_at is null;
$$;

revoke execute on function public.gw_economic_overview() from public, anon, authenticated;
grant execute on function public.gw_economic_overview() to service_role;

commit;

-- PostgREST: ricarica lo schema per vedere la funzione nuova.
notify pgrst, 'reload schema';
