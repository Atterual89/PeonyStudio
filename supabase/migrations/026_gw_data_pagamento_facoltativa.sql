-- Gestionale Workshop — Data del pagamento facoltativa (Fase 4f)
--
-- Tocca SOLO oggetti gw_. Rollback: 026_gw_data_pagamento_facoltativa.down.sql
--
--   - gw_payments.paid_on diventa facoltativa (nessuna data = "data non
--     indicata"; nell'elenco i movimenti senza data vanno per data di
--     inserimento).
--   - gw_insert_payment: obbligatorio solo "Incassato da".
--   - gw_import_roster: come in 025, senza il controllo sulla data.
--   - gw_correct_payment: come in 020; nella "Modifica" la data indicata
--     (anche vuota) sostituisce quella dell'originale.

begin;

do $$
begin
  if to_regprocedure('public.gw_refund_booking(uuid, uuid, bigint, public.gw_payment_method, date, public.gw_party)') is null then
    raise exception 'Migrazione 026 interrotta: applica prima 024_gw_correzioni_revisione.sql e 025_gw_anteprima_moduli.sql';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'gw_payments'
                and column_name = 'paid_on' and is_nullable = 'YES') then
    raise exception 'Migrazione 026 interrotta: sembra già applicata (gw_payments.paid_on è già facoltativa)';
  end if;
end;
$$;

alter table public.gw_payments alter column paid_on drop not null;

create or replace function public.gw_insert_payment(
  p_operator_id uuid,
  p_booking_id uuid,
  p_kind public.gw_payment_kind,
  p_amount_cents bigint,
  p_payment_type public.gw_payment_type,
  p_method public.gw_payment_method,
  p_paid_on date,
  p_received_by public.gw_party,
  p_description text,
  p_corrects_payment_id uuid,
  p_origin text
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_payments;
begin
  if p_received_by is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Incassato da è obbligatorio.';
  end if;

  insert into gw_payments (
    booking_id, kind, amount_cents, payment_type, paid_on, method,
    received_by, description, corrects_payment_id, created_by
  ) values (
    p_booking_id, p_kind, p_amount_cents, coalesce(p_payment_type, 'altro'), p_paid_on, p_method,
    p_received_by, gw_clean(p_description), p_corrects_payment_id, p_operator_id
  )
  returning * into v_row;

  perform gw_audit(p_operator_id, 'payment', v_row.id, 'insert', null,
                   to_jsonb(v_row) || jsonb_build_object('origine', p_origin));
  return v_row.id;
end;
$$;

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
  v_participant_id uuid;
  v_created integer := 0;
  v_updated integer := 0;
  v_payments integer := 0;
begin
  if not exists (select 1 from gw_workshops where id = p_workshop_id) then
    raise exception 'gw_not_found' using errcode = 'GW404';
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
      -- #9: "Salva l'email" (solo se Ale non ne aveva già scritta una).
      if gw_clean(v_row->>'entered_email') is not null then
        select id into v_participant_id
          from gw_booking_participants
         where booking_id = v_booking_id and is_primary and removed_at is null and deleted_at is null
           and entered_email is null;
        if v_participant_id is not null then
          perform gw_set_entered_email(p_operator_id, v_participant_id, v_row->>'entered_email');
        end if;
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
        coalesce((gw_clean(v_payment->>'paid_on'))::date, p_paid_on),
        coalesce((gw_clean(v_payment->>'received_by'))::gw_party, p_received_by),
        coalesce(gw_clean(v_payment->>'description'), 'importazione testo'), null, 'importazione testo'
      );
      v_payments := v_payments + 1;
    end loop;

    perform gw_apply_auto_status(p_operator_id, v_booking_id);

    -- Moduli compatti (023): stato scelto nell'anteprima, solo righe nuove e
    -- solo stati non economici (D21: la scelta a mano vale).
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

create or replace function public.gw_correct_payment(p_operator_id uuid, p_payment_id uuid, p_replacement jsonb, p_description text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_original gw_payments;
  v_net bigint;
  v_id uuid;
  v_amount bigint;
begin
  select * into v_original from gw_payments where id = p_payment_id and deleted_at is null;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  perform 1 from gw_bookings where id = v_original.booking_id for update;
  if v_original.kind = 'rettifica' then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Una rettifica non si corregge: correggi il movimento originale.';
  end if;

  select v_original.amount_cents + coalesce(sum(amount_cents), 0) into v_net
    from gw_payments where corrects_payment_id = p_payment_id and deleted_at is null;
  if v_net = 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Questo movimento è già stato annullato.';
  end if;

  v_id := gw_insert_payment(
    p_operator_id, v_original.booking_id, 'rettifica', -v_net, v_original.payment_type,
    v_original.method, v_original.paid_on, v_original.received_by,
    coalesce(gw_clean(p_description), 'Correzione'), p_payment_id, 'correzione'
  );

  if p_replacement is not null and jsonb_typeof(p_replacement) = 'object' then
    v_amount := (gw_clean(p_replacement->>'amount_cents'))::bigint;
    if v_amount is null or v_amount <= 0 then
      raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Importo corretto non valido.';
    end if;
    perform gw_insert_payment(
      p_operator_id, v_original.booking_id, v_original.kind,
      case when v_original.kind = 'rimborso' then -v_amount else v_amount end,
      coalesce((gw_clean(p_replacement->>'payment_type'))::gw_payment_type, v_original.payment_type),
      (gw_clean(p_replacement->>'method'))::gw_payment_method,
      -- 026: "paid_on" presente (anche vuoto) = la data della modifica; assente = quella dell'originale.
      case when p_replacement ? 'paid_on' then (gw_clean(p_replacement->>'paid_on'))::date else v_original.paid_on end,
      coalesce((gw_clean(p_replacement->>'received_by'))::gw_party, v_original.received_by),
      p_replacement->>'description',
      null,
      'correzione'
    );
  end if;

  perform gw_apply_auto_status(p_operator_id, v_original.booking_id);
  return v_id;
end;
$$;

commit;

-- PostgREST: ricarica lo schema.
notify pgrst, 'reload schema';
