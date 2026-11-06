-- Gestionale Workshop — Correzioni dalla revisione (Fase 4e)
--
-- Tocca SOLO oggetti gw_. Rollback: 024_gw_correzioni_revisione.down.sql
--
--   - #5/#28: gw_preview_entered_matches (sola lettura) per l'anteprima del
--     box di testo di Ale: per ogni nome, l'iscrizione di questo workshop a
--     cui il server lo abbinerebbe (stessi criteri esatti dell'abbinamento
--     automatico: email, nickname, nome e cognome, altri nomi). Restituisce
--     SOLO l'id dell'iscrizione e il testo che Ale stessa aveva scritto.
--   - #6/#9: gw_import_roster chiede la data dei pagamenti solo se serve
--     (un pagamento senza data) e, per le righe già presenti, salva l'email
--     scritta da Ale se l'iscrizione non ne ha una (`entered_email`).
--   - #2: gw_refund_booking, "Registra rimborso di X €" su un'iscrizione
--     cancellata: un rimborso per ogni parte che ha incassato (o uno solo,
--     della parte indicata), nella stessa transazione.
--   - #21: gw_delete_booking_with_payments, iscrizione e pagamenti eliminati
--     insieme (stesso deleted_at: un solo "Annulla", gw_restore_deleted).
--   - #23: gw_restore_person_alias, "Eliminato · Annulla" per gli altri nomi.
--   - D24: gli stati manuali del consuntivo sono solo Provvisorio e
--     Verificato; "Saldato" si deduce dal residuo. I workshop in
--     da_conguagliare / conguagliato diventano verificato (con storico). I
--     valori restano nell'enum (non si tolgono valori a un enum) ma
--     gw_set_settlement_status non li accetta più.
--   - #18: gw_economic_overview restituisce anche verified_snapshot (badge
--     "Da ricontrollare" in home).

begin;

do $$
begin
  if to_regclass('public.gw_person_aliases') is null then
    raise exception 'Migrazione 024 interrotta: applica prima 023_gw_richieste_associazione.sql';
  end if;
  if to_regprocedure('public.gw_refund_booking(uuid, uuid, bigint, public.gw_payment_method, date, public.gw_party)') is not null then
    raise exception 'Migrazione 024 interrotta: sembra già applicata (gw_refund_booking esiste)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- #5/#28: "Sembra già iscritta come «X»" nell'anteprima di Ale. Sola lettura:
-- nessuna persona creata, nessun dato anagrafico restituito.
-- p_entries: come gw_create_booking_entered (testo oppure {"text", "email"}).
-- Risultato: un elemento per voce, null oppure {"booking_id", "entered_as"}.
-- ---------------------------------------------------------------------------
create function public.gw_preview_entered_matches(p_workshop_id uuid, p_entries jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_entry jsonb;
  v_text text;
  v_norm text;
  v_email text;
  v_ids uuid[];
  v_person uuid;
  v_found jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) > 400 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Dati non validi.';
  end if;

  for v_entry in select e from jsonb_array_elements(p_entries) e loop
    v_text := gw_clean(case jsonb_typeof(v_entry) when 'string' then v_entry #>> '{}' when 'object' then v_entry->>'text' end);
    v_email := case when jsonb_typeof(v_entry) = 'object' then lower(replace(gw_clean(v_entry->>'email'), ' ', '')) end;
    v_person := null;

    -- Email scritta da Ale: come gw_create_booking_entered, abbina per prima.
    if v_email is not null then
      select array_agg(p.id) into v_ids
        from gw_people p
       where p.merged_into is null and p.deleted_at is null and lower(btrim(p.email)) = v_email;
      if coalesce(array_length(v_ids, 1), 0) = 1 then
        v_person := v_ids[1];
      end if;
    end if;

    -- Testo: passo 1 di gw_match_entered_person (esatto e unico).
    if v_person is null and v_text is not null then
      v_norm := gw_norm(v_text);
      select array_agg(p.id) into v_ids
        from gw_people p
       where p.merged_into is null
         and p.deleted_at is null
         and case
               when position('@' in v_text) > 0 then lower(btrim(p.email)) = lower(replace(v_text, ' ', ''))
               else gw_norm(p.nickname) = v_norm
                 or gw_norm(concat_ws(' ', p.first_name, p.last_name)) = v_norm
                 or exists (select 1 from gw_person_aliases a
                             where a.person_id = p.id and a.deleted_at is null and a.alias_normalized = v_norm)
             end;
      if coalesce(array_length(v_ids, 1), 0) = 1 then
        v_person := v_ids[1];
      end if;
    end if;

    v_found := null;
    if v_person is not null then
      select jsonb_build_object('booking_id', bp.booking_id, 'entered_as', bp.entered_as) into v_found
        from gw_booking_participants bp
        join gw_bookings b on b.id = bp.booking_id
       where bp.workshop_id = p_workshop_id and bp.person_id = v_person
         and bp.removed_at is null and bp.deleted_at is null and b.deleted_at is null
       order by bp.added_at
       limit 1;
    end if;
    v_result := v_result || jsonb_build_array(v_found);
  end loop;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- #6 + #9: box di testo. La data dei pagamenti (p_paid_on) serve solo se un
-- pagamento non ha la sua; per le righe già presenti `entered_email` salva
-- l'email scritta da Ale sul principale, se non ne ha una. Il resto come in 023.
-- ---------------------------------------------------------------------------
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
  if p_paid_on is null and exists (
       select 1
         from jsonb_array_elements(p_rows) r, jsonb_array_elements(coalesce(r->'payments', '[]'::jsonb)) p
        where gw_clean(p->>'paid_on') is null) then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Indica la data dei pagamenti.';
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
        coalesce((gw_clean(v_payment->>'paid_on'))::date, p_paid_on), p_received_by,
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

-- ---------------------------------------------------------------------------
-- #2: "Registra rimborso di X €" (iscrizione cancellata con soldi pagati).
-- X = pagato netto, controllato contro quello visto da Ale. Senza
-- p_received_by: un rimborso per ogni parte con incassato netto positivo
-- (se una parte è in negativo non si può ripartire: si chiede a chi va).
-- Con p_received_by: un solo rimborso di tutto, restituito da quella parte.
-- ---------------------------------------------------------------------------
create function public.gw_refund_booking(
  p_operator_id uuid,
  p_booking_id uuid,
  p_expected_cents bigint,
  p_method public.gw_payment_method,
  p_paid_on date,
  p_received_by public.gw_party
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_net bigint;
  v_part record;
  v_count integer := 0;
begin
  perform 1 from gw_bookings where id = p_booking_id and deleted_at is null for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;

  select coalesce(sum(amount_cents), 0) into v_net
    from gw_payments where booking_id = p_booking_id and deleted_at is null;
  if v_net <= 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Non ci sono soldi da restituire.';
  end if;
  if p_expected_cents is distinct from v_net then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'I pagamenti sono cambiati: ricarica la pagina.';
  end if;

  if p_received_by is not null then
    perform gw_insert_payment(p_operator_id, p_booking_id, 'rimborso', -v_net, 'altro', p_method,
                              p_paid_on, p_received_by, null, null, 'rimborso del pagato');
    v_count := 1;
  else
    if exists (select 1 from gw_payments where booking_id = p_booking_id and deleted_at is null
                group by received_by having sum(amount_cents) < 0) then
      raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Indica chi restituisce i soldi.';
    end if;
    for v_part in
      select received_by, sum(amount_cents)::bigint as total
        from gw_payments where booking_id = p_booking_id and deleted_at is null
       group by received_by having sum(amount_cents) > 0
       order by received_by
    loop
      perform gw_insert_payment(p_operator_id, p_booking_id, 'rimborso', -v_part.total, 'altro', p_method,
                                p_paid_on, v_part.received_by, null, null, 'rimborso del pagato');
      v_count := v_count + 1;
    end loop;
  end if;

  perform gw_apply_auto_status(p_operator_id, p_booking_id);
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- #21: "Elimina anche i pagamenti (X €) e l'iscrizione". Tutto con lo stesso
-- deleted_at: "Annulla" (gw_restore_deleted, entità booking) ripristina
-- iscrizione, partecipanti e pagamenti insieme. X è controllato.
-- ---------------------------------------------------------------------------
create function public.gw_delete_booking_with_payments(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_expected_cents bigint
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_net bigint;
begin
  perform 1 from gw_bookings where id = p_booking_id and version = p_version and deleted_at is null for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_bookings', p_booking_id);
  end if;

  select coalesce(sum(amount_cents), 0) into v_net
    from gw_payments where booking_id = p_booking_id and deleted_at is null;
  if p_expected_cents is distinct from v_net then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'I pagamenti sono cambiati: ricarica la pagina.';
  end if;

  v_before := gw_booking_snapshot(p_booking_id) || jsonb_build_object(
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at)
                            from gw_payments p where p.booking_id = p_booking_id and p.deleted_at is null), '[]'::jsonb));

  update gw_payments set deleted_at = now(), deleted_by = p_operator_id
   where booking_id = p_booking_id and deleted_at is null;
  update gw_booking_participants set deleted_at = now(), deleted_by = p_operator_id
   where booking_id = p_booking_id and deleted_at is null;
  update gw_bookings set deleted_at = now(), deleted_by = p_operator_id where id = p_booking_id;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'delete', v_before,
                   jsonb_build_object('eliminato', true, 'con_pagamenti', v_net));
end;
$$;

-- ---------------------------------------------------------------------------
-- #23: "Eliminato · Annulla" per gli altri nomi: come gw_restore_deleted
-- (020), solo chi ha eliminato ed entro 10 minuti.
-- ---------------------------------------------------------------------------
create function public.gw_restore_person_alias(p_operator_id uuid, p_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_person_aliases;
begin
  select * into v_row from gw_person_aliases where id = p_id for update;
  if not found or v_row.deleted_at is null then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_row.deleted_by is distinct from p_operator_id or v_row.deleted_at < now() - interval '10 minutes' then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Non si può più annullare l''eliminazione.';
  end if;
  begin
    update gw_person_aliases set deleted_at = null, deleted_by = null where id = p_id;
  exception when unique_violation then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = format('«%s» è già usato da un''altra persona: non si può ripristinare.', v_row.alias);
  end;
  perform gw_audit(p_operator_id, 'person_alias', p_id, 'update',
                   jsonb_build_object('deleted_at', v_row.deleted_at), jsonb_build_object('ripristinato', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- D24: stati manuali del consuntivo = Provvisorio / Verificato. "Da
-- conguagliare" e "Conguagliato" si deducono dal residuo (0 = Saldato).
-- ---------------------------------------------------------------------------
insert into public.gw_audit_log (operator_id, entity, entity_id, action, before, after)
select null, 'workshop', w.id, 'update',
       jsonb_build_object('settlement_status', w.settlement_status),
       jsonb_build_object('settlement_status', 'verificato',
                          'nota', 'migrazione 024: il conguaglio si deduce dal residuo')
  from public.gw_workshops w
 where w.settlement_status in ('da_conguagliare', 'conguagliato') and w.deleted_at is null;

update public.gw_workshops
   set settlement_status = 'verificato', version = version + 1
 where settlement_status in ('da_conguagliare', 'conguagliato') and deleted_at is null;

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

  if p_status not in ('provvisorio', 'verificato') then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'Il conguaglio si chiude registrando il trasferimento: ricarica la pagina.';
  end if;
  if p_status = 'verificato' and (p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object') then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Totali da verificare mancanti.';
  end if;

  update gw_workshops
     set settlement_status = p_status,
         verified_snapshot = case when p_status = 'verificato' then p_snapshot end,
         verified_at = case when p_status = 'verificato' then now() end,
         verified_by = case when p_status = 'verificato' then p_operator_id end,
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

-- #18: come 021, più verified_snapshot (badge "Da ricontrollare" in home).
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
  bookings jsonb,
  verified_snapshot jsonb
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
                from gw_bookings b where b.workshop_id = w.id and b.deleted_at is null), '[]'::jsonb),
    w.verified_snapshot
  from gw_workshops w
  where w.deleted_at is null;
$$;

-- Sicurezza: eseguibili solo dalla service role.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.gw_preview_entered_matches(uuid, jsonb)',
    'public.gw_refund_booking(uuid, uuid, bigint, public.gw_payment_method, date, public.gw_party)',
    'public.gw_delete_booking_with_payments(uuid, uuid, integer, bigint)',
    'public.gw_restore_person_alias(uuid, uuid)',
    'public.gw_economic_overview()'
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
