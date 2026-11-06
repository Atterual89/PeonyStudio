-- Gestionale Workshop — consuntivo e conguagli (Fase 4, docs/gestionale/fase-4-consuntivo.md)
--
-- Tocca SOLO oggetti gw_. Rollback: 018_gw_consuntivo_v4.down.sql
--
--   - gw_expenses.category (enum gw_expense_category, default 'altro').
--   - gw_audit_action: nuovo valore 'export' (Excel e stampa del consuntivo).
--   - Funzioni per spese, trasferimenti, riporti, percentuale, perdita
--     sostenuta da Peony (D6), stato del consuntivo con snapshot, note fiscali
--     di Ale (D7) e registrazione degli export.
--   - gw_update_workshop_settings: come in 015, ma lo storico non contiene più
--     le note fiscali né lo snapshot (le note le vede solo l'organizzatrice).
--
-- Nessun calcolo del consuntivo qui: i totali li calcola computeSettlement()
-- (src/lib/gestionale/settlement.ts) e il server li passa già pronti
-- (snapshot) o li usa per i controlli (perdita, riporto del residuo).

begin;

do $$
begin
  if to_regprocedure('public.gw_confirm_person_matches(uuid, uuid)') is null then
    raise exception 'Migrazione 018 interrotta: applica prima 017_gw_riga_persona.sql';
  end if;
  if to_regtype('public.gw_expense_category') is not null then
    raise exception 'Migrazione 018 interrotta: sembra già applicata (gw_expense_category esiste)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Categoria delle spese
-- ---------------------------------------------------------------------------
create type public.gw_expense_category as enum ('viaggi', 'vitto', 'alloggio', 'sala', 'materiali', 'altro');

alter table public.gw_expenses
  add column category public.gw_expense_category not null default 'altro';

-- Storico degli export. Il nuovo valore non si può usare nella stessa
-- transazione: le funzioni sotto lo usano solo a runtime (plpgsql).
alter type public.gw_audit_action add value if not exists 'export';

-- ---------------------------------------------------------------------------
-- Spese (modificabili ed eliminabili, con storico)
-- ---------------------------------------------------------------------------
create function public.gw_create_expense(p_operator_id uuid, p_workshop_id uuid, p_data jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_expenses;
begin
  if not exists (select 1 from gw_workshops where id = p_workshop_id) then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;

  insert into gw_expenses (workshop_id, description, amount_cents, advanced_by, category, spent_on, created_by)
  values (
    p_workshop_id,
    gw_clean(p_data->>'description'),
    (p_data->>'amount_cents')::bigint,
    (p_data->>'advanced_by')::gw_party,
    coalesce((gw_clean(p_data->>'category'))::gw_expense_category, 'altro'),
    (gw_clean(p_data->>'spent_on'))::date,
    p_operator_id
  )
  returning * into v_row;

  perform gw_audit(p_operator_id, 'expense', v_row.id, 'insert', null, to_jsonb(v_row));
  return v_row.id;
end;
$$;

create function public.gw_update_expense(p_operator_id uuid, p_id uuid, p_version integer, p_data jsonb)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_expenses;
  v_after gw_expenses;
begin
  select * into v_before from gw_expenses where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_expenses', p_id);
  end if;

  update gw_expenses
     set description = gw_clean(p_data->>'description'),
         amount_cents = (p_data->>'amount_cents')::bigint,
         advanced_by = (p_data->>'advanced_by')::gw_party,
         category = coalesce((gw_clean(p_data->>'category'))::gw_expense_category, 'altro'),
         spent_on = (gw_clean(p_data->>'spent_on'))::date,
         version = version + 1
   where id = p_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'expense', p_id, 'update', to_jsonb(v_before), to_jsonb(v_after));
  return v_after.version;
end;
$$;

create function public.gw_delete_expense(p_operator_id uuid, p_id uuid, p_version integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_expenses;
begin
  select * into v_before from gw_expenses where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_expenses', p_id);
  end if;

  delete from gw_expenses where id = p_id;
  perform gw_audit(p_operator_id, 'expense', p_id, 'delete', to_jsonb(v_before), null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trasferimenti (conguaglio tra le parti)
-- ---------------------------------------------------------------------------
create function public.gw_create_transfer(p_operator_id uuid, p_workshop_id uuid, p_data jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_transfers;
  v_status gw_transfer_status := coalesce((gw_clean(p_data->>'status'))::gw_transfer_status, 'da_eseguire');
begin
  if not exists (select 1 from gw_workshops where id = p_workshop_id) then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;

  insert into gw_transfers (workshop_id, from_party, to_party, amount_cents, status, executed_on, notes, created_by)
  values (
    p_workshop_id,
    (p_data->>'from_party')::gw_party,
    (p_data->>'to_party')::gw_party,
    (p_data->>'amount_cents')::bigint,
    v_status,
    case when v_status = 'eseguito'
         then coalesce((gw_clean(p_data->>'executed_on'))::date, (now() at time zone 'Europe/Rome')::date)
    end,
    gw_clean(p_data->>'notes'),
    p_operator_id
  )
  returning * into v_row;

  perform gw_audit(p_operator_id, 'transfer', v_row.id, 'insert', null, to_jsonb(v_row));
  return v_row.id;
end;
$$;

-- "Segna come eseguito" (data facoltativa: oggi, fuso Europe/Rome).
create function public.gw_set_transfer_executed(p_operator_id uuid, p_id uuid, p_version integer, p_executed_on date)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_transfers;
  v_after gw_transfers;
begin
  select * into v_before from gw_transfers where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_transfers', p_id);
  end if;

  update gw_transfers
     set status = 'eseguito',
         executed_on = coalesce(p_executed_on, (now() at time zone 'Europe/Rome')::date),
         version = version + 1
   where id = p_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'transfer', p_id, 'update', to_jsonb(v_before), to_jsonb(v_after));
  return v_after.version;
end;
$$;

create function public.gw_delete_transfer(p_operator_id uuid, p_id uuid, p_version integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_transfers;
begin
  select * into v_before from gw_transfers where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_transfers', p_id);
  end if;

  delete from gw_transfers where id = p_id;
  perform gw_audit(p_operator_id, 'transfer', p_id, 'delete', to_jsonb(v_before), null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Riporti tra workshop. Una riga conta in uscita sull'origine e in entrata
-- sulla destinazione (mai due volte sullo stesso workshop: CHECK in 010).
-- ---------------------------------------------------------------------------
create function public.gw_create_carryover(p_operator_id uuid, p_data jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_carryovers;
begin
  if (select count(*) from gw_workshops
       where id in ((p_data->>'origin_workshop_id')::uuid, (p_data->>'destination_workshop_id')::uuid)) < 2 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Scegli un altro workshop di destinazione.';
  end if;

  insert into gw_carryovers (origin_workshop_id, destination_workshop_id, debtor, creditor, amount_cents, notes, created_by)
  values (
    (p_data->>'origin_workshop_id')::uuid,
    (p_data->>'destination_workshop_id')::uuid,
    (p_data->>'debtor')::gw_party,
    (p_data->>'creditor')::gw_party,
    (p_data->>'amount_cents')::bigint,
    gw_clean(p_data->>'notes'),
    p_operator_id
  )
  returning * into v_row;

  perform gw_audit(p_operator_id, 'carryover', v_row.id, 'insert', null, to_jsonb(v_row));
  return v_row.id;
end;
$$;

create function public.gw_delete_carryover(p_operator_id uuid, p_id uuid, p_version integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_carryovers;
begin
  select * into v_before from gw_carryovers where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_carryovers', p_id);
  end if;

  delete from gw_carryovers where id = p_id;
  perform gw_audit(p_operator_id, 'carryover', p_id, 'delete', to_jsonb(v_before), null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ripartizione: percentuale Peony (solo admin, controllo nel server) e
-- perdita sostenuta da Peony (D6; il limite |Utile| lo controlla il server
-- con computeSettlement, qui solo >= 0).
-- ---------------------------------------------------------------------------
create function public.gw_set_peony_pct(p_operator_id uuid, p_workshop_id uuid, p_version integer, p_peony_pct numeric)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_workshops;
  v_version integer;
begin
  select * into v_before from gw_workshops where id = p_workshop_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_workshops', p_workshop_id);
  end if;
  if p_peony_pct is null or p_peony_pct < 0 or p_peony_pct > 100 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Percentuale tra 0 e 100.';
  end if;

  update gw_workshops set peony_pct = p_peony_pct, version = version + 1
   where id = p_workshop_id
  returning version into v_version;

  perform gw_audit(p_operator_id, 'workshop', p_workshop_id, 'update',
                   jsonb_build_object('peony_pct', v_before.peony_pct),
                   jsonb_build_object('peony_pct', p_peony_pct));
  return v_version;
end;
$$;

create function public.gw_set_loss_peony(p_operator_id uuid, p_workshop_id uuid, p_version integer, p_loss_peony_cents bigint)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_workshops;
  v_version integer;
begin
  select * into v_before from gw_workshops where id = p_workshop_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_workshops', p_workshop_id);
  end if;
  if p_loss_peony_cents is not null and p_loss_peony_cents < 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Importo non valido.';
  end if;

  update gw_workshops set loss_peony_cents = p_loss_peony_cents, version = version + 1
   where id = p_workshop_id
  returning version into v_version;

  perform gw_audit(p_operator_id, 'workshop', p_workshop_id, 'update',
                   jsonb_build_object('loss_peony_cents', v_before.loss_peony_cents),
                   jsonb_build_object('loss_peony_cents', p_loss_peony_cents));
  return v_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stato del consuntivo. Verificato salva lo snapshot dei totali (calcolati
-- dal server) e si può ripetere; Conguaglio da eseguire dopo Verificato;
-- Conguaglio eseguito dopo Conguaglio da eseguire; Provvisorio sempre (toglie
-- lo snapshot, che resta nello storico). Nessuno stato blocca le modifiche.
-- ---------------------------------------------------------------------------
create function public.gw_set_settlement_status(
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

-- ---------------------------------------------------------------------------
-- D7 (Fase 4): note fiscali personali di Ale, solo dell'organizzatrice
-- (controllo nel server). Lo storico NON contiene il testo: gli admin non lo
-- vedono nemmeno da lì.
-- ---------------------------------------------------------------------------
create function public.gw_set_tax_notes(p_operator_id uuid, p_workshop_id uuid, p_version integer, p_notes text)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_version integer;
begin
  update gw_workshops set personal_tax_notes = gw_clean(p_notes), version = version + 1
   where id = p_workshop_id and version = p_version
  returning version into v_version;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_workshops', p_workshop_id);
  end if;

  perform gw_audit(p_operator_id, 'workshop', p_workshop_id, 'update', null,
                   jsonb_build_object('personal_tax_notes', 'modificate'));
  return v_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Export del consuntivo (Excel o stampa): solo storico.
-- ---------------------------------------------------------------------------
create function public.gw_log_export(p_operator_id uuid, p_workshop_id uuid, p_format text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_format is null or p_format not in ('xlsx', 'stampa') then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Formato non valido.';
  end if;
  if not exists (select 1 from gw_workshops where id = p_workshop_id) then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;

  insert into gw_audit_log (operator_id, entity, entity_id, action, before, after)
  values (p_operator_id, 'workshop', p_workshop_id, 'export'::gw_audit_action, null,
          jsonb_build_object('consuntivo', p_format));
end;
$$;

-- ---------------------------------------------------------------------------
-- Come in 015, ma lo storico esclude note fiscali e snapshot.
-- ---------------------------------------------------------------------------
create or replace function public.gw_update_workshop_settings(
  p_operator_id uuid,
  p_id uuid,
  p_version integer,
  p_data jsonb
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_workshops;
  v_after gw_workshops;
  v_unsettled integer := 0;
begin
  select * into v_before from gw_workshops where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_workshops', p_id);
  end if;

  update gw_workshops
     set description = gw_clean(p_data->>'description'),
         capacity = (gw_clean(p_data->>'capacity'))::integer,
         default_fee_cents = (gw_clean(p_data->>'default_fee_cents'))::bigint,
         peony_pct = coalesce((gw_clean(p_data->>'peony_pct'))::numeric, 30),
         version = version + 1
   where id = p_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'workshop', p_id, 'update',
                   to_jsonb(v_before) - 'personal_tax_notes' - 'verified_snapshot',
                   to_jsonb(v_after) - 'personal_tax_notes' - 'verified_snapshot');

  if v_after.default_fee_cents is distinct from v_before.default_fee_cents then
    v_unsettled := gw_sync_workshop_fee(p_operator_id, p_id);
  end if;

  return jsonb_build_object('version', v_after.version, 'unsettled', v_unsettled);
end;
$$;

-- ---------------------------------------------------------------------------
-- Sicurezza: eseguibili solo dalla service role
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.gw_create_expense(uuid, uuid, jsonb)',
    'public.gw_update_expense(uuid, uuid, integer, jsonb)',
    'public.gw_delete_expense(uuid, uuid, integer)',
    'public.gw_create_transfer(uuid, uuid, jsonb)',
    'public.gw_set_transfer_executed(uuid, uuid, integer, date)',
    'public.gw_delete_transfer(uuid, uuid, integer)',
    'public.gw_create_carryover(uuid, jsonb)',
    'public.gw_delete_carryover(uuid, uuid, integer)',
    'public.gw_set_peony_pct(uuid, uuid, integer, numeric)',
    'public.gw_set_loss_peony(uuid, uuid, integer, bigint)',
    'public.gw_set_settlement_status(uuid, uuid, integer, public.gw_settlement_status, jsonb)',
    'public.gw_set_tax_notes(uuid, uuid, integer, text)',
    'public.gw_log_export(uuid, uuid, text)',
    'public.gw_update_workshop_settings(uuid, uuid, integer, jsonb)'
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
