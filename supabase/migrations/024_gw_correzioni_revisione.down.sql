-- Rollback di 024_gw_correzioni_revisione.sql: toglie le funzioni nuove
-- (anteprima degli abbinamenti, rimborso del pagato, eliminazione con i
-- pagamenti, ripristino degli altri nomi) e rimette gw_import_roster (023),
-- gw_set_settlement_status (018) e gw_economic_overview (021) com'erano.
-- Gli stati del consuntivo convertiti in "verificato" restano tali (lo
-- storico ha il valore precedente); i movimenti e le eliminazioni registrati
-- con le funzioni nuove restano.

begin;

drop function public.gw_preview_entered_matches(uuid, jsonb);
drop function public.gw_refund_booking(uuid, uuid, bigint, public.gw_payment_method, date, public.gw_party);
drop function public.gw_delete_booking_with_payments(uuid, uuid, integer, bigint);
drop function public.gw_restore_person_alias(uuid, uuid);

-- gw_import_roster com'era in 023.
create or replace function public.gw_import_roster(
  p_operator_id uuid,
  p_workshop_id uuid,
  p_paid_on date,
  p_received_by public.gw_party,
  p_rows jsonb
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_payment jsonb;
  v_booking_id uuid;
  v_amount bigint;
  v_created integer := 0;
  v_updated integer := 0;
  v_payments integer := 0;
begin
  if not exists (select 1 from gw_workshops where id = p_workshop_id) then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if p_paid_on is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Indica la data dei pagamenti.';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Nessuna riga da salvare.';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    if gw_clean(v_row->>'booking_id') is not null then
      v_booking_id := (v_row->>'booking_id')::uuid;
      perform 1 from gw_bookings
        where id = v_booking_id and workshop_id = p_workshop_id
          and version = (v_row->>'booking_version')::integer
        for update;
      if not found then
        perform gw_raise_missing_or_conflict('public.gw_bookings', v_booking_id);
      end if;
      v_updated := v_updated + 1;
    else
      -- Acconto pagato / Saldato si salvano solo con il primo pagamento.
      if gw_clean(v_row->>'status') in ('acconto', 'saldato')
         and jsonb_array_length(coalesce(v_row->'payments', '[]'::jsonb)) = 0 then
        raise exception 'gw_invalid' using errcode = 'GW400',
          detail = 'Acconto pagato o Saldato: registra il primo pagamento.';
      end if;
      v_booking_id := gw_create_booking_entered(
        p_operator_id, p_workshop_id, v_row->'people',
        coalesce((gw_clean(v_row->>'status'))::gw_booking_status, 'prenotato'),
        (gw_clean(v_row->>'fee_cents'))::bigint,
        v_row->>'notes'
      );
      if coalesce(gw_clean(v_row->>'invoice_status'), 'non_richiesta') <> 'non_richiesta' then
        update gw_bookings
           set invoice_status = (v_row->>'invoice_status')::gw_invoice_status
         where id = v_booking_id;
      end if;
      v_created := v_created + 1;
    end if;

    for v_payment in select value from jsonb_array_elements(coalesce(v_row->'payments', '[]'::jsonb)) loop
      v_amount := (gw_clean(v_payment->>'amount_cents'))::bigint;
      if v_amount is null or v_amount <= 0 then
        raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Importo non valido nel testo importato.';
      end if;
      perform gw_insert_payment(
        p_operator_id, v_booking_id, 'pagamento', v_amount,
        (gw_clean(v_payment->>'payment_type'))::gw_payment_type,
        (gw_clean(v_payment->>'method'))::gw_payment_method,
        coalesce((gw_clean(v_payment->>'paid_on'))::date, p_paid_on), p_received_by,
        coalesce(gw_clean(v_payment->>'description'), 'importazione testo'), null, 'importazione testo'
      );
      v_payments := v_payments + 1;
    end loop;

    perform gw_apply_auto_status(p_operator_id, v_booking_id);

    -- Moduli compatti: nell'anteprima Ale ha scelto lo stato scritto nel testo
    -- invece di quello indicato dai pagamenti (D21: la scelta a mano vale).
    -- Solo righe nuove e solo stati non economici.
    if gw_clean(v_row->>'booking_id') is null and gw_clean(v_row->>'forced_status') in ('interessato', 'prenotato') then
      update gw_bookings
         set status = (v_row->>'forced_status')::gw_booking_status, version = version + 1
       where id = v_booking_id and status <> (v_row->>'forced_status')::gw_booking_status;
      if found then
        perform gw_audit(p_operator_id, 'booking', v_booking_id, 'update', null,
                         jsonb_build_object('status', v_row->>'forced_status', 'nota', 'stato scelto nell''anteprima del testo'));
      end if;
    end if;
  end loop;

  perform gw_audit(p_operator_id, 'workshop', p_workshop_id, 'insert', null,
                   jsonb_build_object('origine', 'importazione testo', 'iscrizioni_create', v_created,
                                      'iscrizioni_aggiornate', v_updated, 'pagamenti', v_payments,
                                      'data_pagamenti', p_paid_on));

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'payments', v_payments);
end;
$$;

-- gw_set_settlement_status com'era in 018.
create or replace function public.gw_set_settlement_status(
  p_operator_id uuid,
  p_workshop_id uuid,
  p_version integer,
  p_status public.gw_settlement_status,
  p_snapshot jsonb
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_workshops;
  v_after gw_workshops;
begin
  select * into v_before from gw_workshops where id = p_workshop_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_workshops', p_workshop_id);
  end if;

  if p_status = 'verificato' and (p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object') then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Totali da verificare mancanti.';
  end if;
  if (p_status = 'da_conguagliare' and v_before.settlement_status <> 'verificato')
     or (p_status = 'conguagliato' and v_before.settlement_status <> 'da_conguagliare') then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Passaggio di stato non consentito: ricarica la pagina.';
  end if;

  update gw_workshops
     set settlement_status = p_status,
         verified_snapshot = case p_status when 'verificato' then p_snapshot
                                           when 'provvisorio' then null
                                           else verified_snapshot end,
         verified_at = case p_status when 'verificato' then now()
                                     when 'provvisorio' then null
                                     else verified_at end,
         verified_by = case p_status when 'verificato' then p_operator_id
                                     when 'provvisorio' then null
                                     else verified_by end,
         version = version + 1
   where id = p_workshop_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'workshop', p_workshop_id, 'update',
                   jsonb_build_object('settlement_status', v_before.settlement_status,
                                      'verified_snapshot', v_before.verified_snapshot),
                   jsonb_build_object('settlement_status', v_after.settlement_status,
                                      'verified_snapshot', v_after.verified_snapshot));
  return v_after.version;
end;
$$;

-- gw_economic_overview com'era in 021 (senza verified_snapshot).
drop function public.gw_economic_overview();

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

notify pgrst, 'reload schema';
