-- Gestionale Workshop — quota che segue il workshop (D19 rivista,
-- docs/gestionale/00-contesto.md sez. 9.2)
--
-- Tocca SOLO oggetti gw_.
-- Rollback: 015_gw_quota_workshop_v3c.down.sql
--
--   - Ogni prenotazione SEGUE la quota del workshop, salvo tariffa dedicata
--     (fee_custom = true), impostata solo con la matita (gw_set_booking_fee)
--     o dal testo importato ("X€/ Y€").
--   - gw_update_workshop_settings: se la quota cambia, aggiorna subito tutte
--     le prenotazioni non dedicate e non cancellate (stessa transazione,
--     storico, stato automatico) e restituisce { version, unsettled }:
--     unsettled = prenotazioni che erano saldate e non lo sono più.
--   - gw_create_booking_entered: una quota indicata = tariffa dedicata.
--   - gw_update_registration non tocca più la quota; via gw_apply_standard_fee.
--   - Dati esistenti: fee_custom = false dove la quota è nulla o coincide con
--     una quota standard passata del workshop; poi allineamento alla quota.

begin;

do $$
begin
  if to_regprocedure('public.gw_fill_person_from_member(uuid, uuid)') is null then
    raise exception 'Migrazione 015 interrotta: applica prima 014_gw_correzioni_admin_v3b.sql';
  end if;
  if to_regprocedure('public.gw_set_booking_fee(uuid, uuid, integer, bigint)') is not null then
    raise exception 'Migrazione 015 interrotta: sembra già applicata (gw_set_booking_fee esiste)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Allineamento delle prenotazioni non dedicate alla quota del workshop
-- ---------------------------------------------------------------------------
-- Restituisce quante prenotazioni erano saldate e non lo sono più. Senza
-- quota del workshop non cambia niente. Le cancellate non si toccano.
create function public.gw_sync_workshop_fee(p_operator_id uuid, p_workshop_id uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_fee bigint;
  v_booking gw_bookings;
  v_status gw_booking_status;
  v_unsettled integer := 0;
begin
  select default_fee_cents into v_fee from gw_workshops where id = p_workshop_id;
  if v_fee is null then
    return 0;
  end if;

  for v_booking in
    select * from gw_bookings
     where workshop_id = p_workshop_id
       and not fee_custom
       and status <> 'cancellato'
       and agreed_fee_cents is distinct from v_fee
     order by created_at
       for update
  loop
    update gw_bookings set agreed_fee_cents = v_fee, version = version + 1 where id = v_booking.id;
    perform gw_audit(p_operator_id, 'booking', v_booking.id, 'update',
                     jsonb_build_object('agreed_fee_cents', v_booking.agreed_fee_cents),
                     jsonb_build_object('agreed_fee_cents', v_fee, 'nota', 'segue la quota del workshop'));
    v_status := gw_apply_auto_status(p_operator_id, v_booking.id);
    if v_booking.status = 'saldato' and v_status <> 'saldato' then
      v_unsettled := v_unsettled + 1;
    end if;
  end loop;

  return v_unsettled;
end;
$$;

-- D14 + D19: come in 012, ma se la quota cambia le prenotazioni non dedicate
-- la seguono subito. Cambia il tipo restituito: drop e create.
drop function public.gw_update_workshop_settings(uuid, uuid, integer, jsonb);

create function public.gw_update_workshop_settings(
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

  perform gw_audit(p_operator_id, 'workshop', p_id, 'update', to_jsonb(v_before), to_jsonb(v_after));

  if v_after.default_fee_cents is distinct from v_before.default_fee_cents then
    v_unsettled := gw_sync_workshop_fee(p_operator_id, p_id);
  end if;

  return jsonb_build_object('version', v_after.version, 'unsettled', v_unsettled);
end;
$$;

-- ---------------------------------------------------------------------------
-- Matita: tariffa dedicata (p_fee_cents) o "Ripristina quota del workshop"
-- (p_fee_cents null). Stato automatico ricalcolato.
-- ---------------------------------------------------------------------------
create function public.gw_set_booking_fee(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_fee_cents bigint
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_bookings;
  v_default bigint;
begin
  select * into v_before from gw_bookings where id = p_booking_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_bookings', p_booking_id);
  end if;
  if p_fee_cents is not null and p_fee_cents < 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Quota non valida.';
  end if;

  select default_fee_cents into v_default from gw_workshops where id = v_before.workshop_id;
  if p_fee_cents is null and v_default is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Il workshop non ha una quota.';
  end if;

  update gw_bookings
     set agreed_fee_cents = coalesce(p_fee_cents, v_default),
         fee_custom = p_fee_cents is not null,
         version = version + 1
   where id = p_booking_id;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update',
                   jsonb_build_object('agreed_fee_cents', v_before.agreed_fee_cents, 'fee_custom', v_before.fee_custom),
                   jsonb_build_object('agreed_fee_cents', coalesce(p_fee_cents, v_default),
                                      'fee_custom', p_fee_cents is not null,
                                      'nota', case when p_fee_cents is null then 'ripristinata la quota del workshop'
                                                   else 'tariffa dedicata' end));
  perform gw_apply_auto_status(p_operator_id, p_booking_id);

  return (select version from gw_bookings where id = p_booking_id);
end;
$$;

-- Riga aperta del tab Iscrizioni: stato, note, fattura. La quota si cambia
-- solo con gw_set_booking_fee. Cambia la firma: drop e create.
drop function public.gw_update_registration(
  uuid, uuid, integer, public.gw_booking_status, text, public.gw_invoice_status, bigint
);

create function public.gw_update_registration(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_status public.gw_booking_status,
  p_notes text,
  p_invoice_status public.gw_invoice_status
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_bookings;
  v_after gw_bookings;
begin
  select * into v_before from gw_bookings where id = p_booking_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_bookings', p_booking_id);
  end if;

  update gw_bookings
     set status = p_status,
         notes = gw_clean(p_notes),
         invoice_status = coalesce(p_invoice_status, invoice_status),
         version = version + 1
   where id = p_booking_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update', to_jsonb(v_before), to_jsonb(v_after));
  return v_after.version;
end;
$$;

-- Schermata "Aggiungi" di Ale e box di testo: come in 013, ma la quota
-- indicata rende la prenotazione dedicata anche se uguale a quella del workshop.
create or replace function public.gw_create_booking_entered(
  p_operator_id uuid,
  p_workshop_id uuid,
  p_entries jsonb,
  p_status public.gw_booking_status,
  p_fee_cents bigint,
  p_notes text
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_workshop gw_workshops;
  v_booking_id uuid;
  v_fee bigint;
  v_text text;
  v_ord bigint;
  v_match record;
  v_person_ids uuid[] := '{}';
begin
  select * into v_workshop from gw_workshops where id = p_workshop_id;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_workshop.default_fee_cents is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Imposta prima la quota del workshop.';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
     or jsonb_array_length(p_entries) not between 1 and 2
     or exists (select 1 from jsonb_array_elements(p_entries) e
                 where jsonb_typeof(e) <> 'string' or gw_clean(e #>> '{}') is null) then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'Scrivi il nome (e, se c''è, quello del partner).';
  end if;
  if p_fee_cents is not null and p_fee_cents < 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Quota non valida.';
  end if;

  v_fee := coalesce(p_fee_cents, v_workshop.default_fee_cents);

  -- D19 (015): una quota indicata (matita di "Aggiungi", "X€/" nel testo
  -- importato) è sempre una tariffa dedicata; senza, segue il workshop.
  insert into gw_bookings (workshop_id, status, agreed_fee_cents, fee_custom, notes, created_by)
  values (p_workshop_id, coalesce(p_status, 'prenotato'), v_fee,
          p_fee_cents is not null,
          gw_clean(p_notes), p_operator_id)
  returning id into v_booking_id;

  for v_text, v_ord in
    select e #>> '{}', o from jsonb_array_elements(p_entries) with ordinality as x(e, o)
  loop
    select * into v_match from gw_match_entered_person(p_operator_id, p_workshop_id, v_text, v_person_ids);
    insert into gw_booking_participants (
      booking_id, workshop_id, person_id, is_primary,
      entered_as, match_status, auto_created_person, possible_duplicate_person_id
    ) values (
      v_booking_id, p_workshop_id, v_match.out_person_id, v_ord = 1,
      regexp_replace(gw_clean(v_text), '\s+', ' ', 'g'), v_match.out_match_status,
      v_match.out_auto_created, v_match.out_duplicate_of
    );
    v_person_ids := v_person_ids || v_match.out_person_id;
  end loop;

  perform gw_audit(p_operator_id, 'booking', v_booking_id, 'insert', null, gw_booking_snapshot(v_booking_id));
  return v_booking_id;
end;
$$;

-- Non serve più: la quota del workshop si applica da sola.
drop function public.gw_apply_standard_fee(uuid, uuid, text, integer);

-- ---------------------------------------------------------------------------
-- Dati esistenti
-- ---------------------------------------------------------------------------
-- 1. Non dedicate le prenotazioni senza quota o con una quota standard
--    passata (o attuale) del workshop, ricavata dallo storico.
do $$
declare
  v_booking gw_bookings;
begin
  for v_booking in
    select b.* from gw_bookings b
      join gw_workshops w on w.id = b.workshop_id
     where b.fee_custom
       and (
         b.agreed_fee_cents is null
         or b.agreed_fee_cents = w.default_fee_cents
         or b.agreed_fee_cents in (
           select (gw_clean(x.value))::bigint
             from gw_audit_log a,
                  lateral (values (a.before->>'default_fee_cents'), (a.after->>'default_fee_cents')) as x(value)
            where a.entity = 'workshop' and a.entity_id = w.id
              and gw_clean(x.value) is not null
         )
       )
       for update of b
  loop
    update gw_bookings set fee_custom = false, version = version + 1 where id = v_booking.id;
    perform gw_audit(null, 'booking', v_booking.id, 'update',
                     jsonb_build_object('fee_custom', true),
                     jsonb_build_object('fee_custom', false, 'nota', 'migrazione 015: quota del workshop'));
  end loop;
end;
$$;

-- 2. Allineamento alla quota del workshop (storico + stato automatico).
do $$
declare
  v_id uuid;
begin
  for v_id in select id from gw_workshops where default_fee_cents is not null order by created_at loop
    perform gw_sync_workshop_fee(null, v_id);
  end loop;
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
    'public.gw_sync_workshop_fee(uuid, uuid)',
    'public.gw_update_workshop_settings(uuid, uuid, integer, jsonb)',
    'public.gw_set_booking_fee(uuid, uuid, integer, bigint)',
    'public.gw_update_registration(uuid, uuid, integer, public.gw_booking_status, text, public.gw_invoice_status)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- PostgREST: ricarica lo schema per vedere le funzioni nuove.
notify pgrst, 'reload schema';

commit;
