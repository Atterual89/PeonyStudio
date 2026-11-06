-- Gestionale Workshop — pagamenti leggibili e stato che apre il pagamento
--
-- Tocca SOLO oggetti gw_. Rollback: 019_gw_pagamenti_stato.down.sql
--
--   - gw_create_registration: "Aggiungi" di Ale con il primo pagamento nella
--     stessa transazione (obbligatorio per Acconto pagato / Saldato).
--   - gw_import_roster: come in 013, ma ogni pagamento può avere data e note
--     proprie (altrimenti quelle comuni) e le righe nuove con Acconto pagato /
--     Saldato devono avere almeno un pagamento.

begin;

do $$
begin
  if to_regtype('public.gw_expense_category') is null then
    raise exception 'Migrazione 019 interrotta: applica prima 018_gw_consuntivo_v4.sql';
  end if;
  if to_regprocedure('public.gw_create_registration(uuid, uuid, jsonb, public.gw_booking_status, bigint, text, jsonb)') is not null then
    raise exception 'Migrazione 019 interrotta: sembra già applicata (gw_create_registration esiste)';
  end if;
end;
$$;

-- p_payment (facoltativo, obbligatorio per acconto/saldato): amount_cents > 0,
-- payment_type, method, paid_on, received_by, description.
create function public.gw_create_registration(
  p_operator_id uuid,
  p_workshop_id uuid,
  p_entries jsonb,
  p_status public.gw_booking_status,
  p_fee_cents bigint,
  p_notes text,
  p_payment jsonb
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_booking_id uuid;
  v_amount bigint;
  v_has_payment boolean := p_payment is not null and jsonb_typeof(p_payment) = 'object';
begin
  if p_status in ('acconto', 'saldato') and not v_has_payment then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Acconto pagato o Saldato: registra il primo pagamento.';
  end if;

  v_booking_id := gw_create_booking_entered(p_operator_id, p_workshop_id, p_entries, p_status, p_fee_cents, p_notes);

  if v_has_payment then
    v_amount := (gw_clean(p_payment->>'amount_cents'))::bigint;
    if v_amount is null or v_amount <= 0 then
      raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Importo non valido.';
    end if;
    perform gw_insert_payment(
      p_operator_id, v_booking_id, 'pagamento', v_amount,
      (gw_clean(p_payment->>'payment_type'))::gw_payment_type,
      (gw_clean(p_payment->>'method'))::gw_payment_method,
      (gw_clean(p_payment->>'paid_on'))::date,
      (gw_clean(p_payment->>'received_by'))::gw_party,
      p_payment->>'description',
      null,
      'iscrizione'
    );
    -- Stato automatico (D21): con un pagamento parziale Saldato diventa Acconto pagato.
    perform gw_apply_auto_status(p_operator_id, v_booking_id);
  end if;

  return v_booking_id;
end;
$$;

-- Come in 013, con data e note per pagamento e il primo pagamento obbligatorio
-- per le righe nuove con Acconto pagato / Saldato.
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
  end loop;

  perform gw_audit(p_operator_id, 'workshop', p_workshop_id, 'insert', null,
                   jsonb_build_object('origine', 'importazione testo', 'iscrizioni_create', v_created,
                                      'iscrizioni_aggiornate', v_updated, 'pagamenti', v_payments,
                                      'data_pagamenti', p_paid_on));

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'payments', v_payments);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.gw_create_registration(uuid, uuid, jsonb, public.gw_booking_status, bigint, text, jsonb)',
    'public.gw_import_roster(uuid, uuid, date, public.gw_party, jsonb)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;

-- PostgREST: ricarica lo schema per vedere le funzioni nuove.
notify pgrst, 'reload schema';
