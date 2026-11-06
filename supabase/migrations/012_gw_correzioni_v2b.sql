-- Gestionale Workshop — correzioni v2b (D14–D17, docs/gestionale/00-contesto.md)
--
-- Tocca SOLO oggetti gw_. Non legge né scrive `events` o `ticket_tailor_*`:
-- nome e date dell'evento li passa il server (lettura con il client admin).
-- Rollback: 012_gw_correzioni_v2b.down.sql
--
--   D14  gw_workshops.event_id + gw_ensure_workshop_for_event
--        gw_update_workshop_settings (nome e date non si modificano più)
--   D15  gw_booking_participants.is_primary: un solo principale per prenotazione
--   D16  stati: confermato → prenotato, + acconto, + saldato
--   D17  gw_rename_operator (lo script gw:rename-operator)

begin;

do $$
begin
  if to_regprocedure('public.gw_create_booking(uuid, uuid, jsonb, public.gw_booking_status, bigint, text)') is null then
    raise exception 'Migrazione 012 interrotta: applica prima 011_gw_functions_v2.sql';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'gw_booking_participants' and column_name = 'is_primary'
  ) then
    raise exception 'Migrazione 012 interrotta: sembra già applicata (is_primary esiste)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- D16 — Stati dell'iscrizione
-- ---------------------------------------------------------------------------
alter type public.gw_booking_status rename value 'confermato' to 'prenotato';
alter type public.gw_booking_status add value if not exists 'acconto' after 'prenotato';
alter type public.gw_booking_status add value if not exists 'saldato' after 'acconto';

-- ---------------------------------------------------------------------------
-- D14 — Collegamento all'evento Ticket Tailor (senza foreign key)
-- ---------------------------------------------------------------------------
alter table public.gw_workshops add column event_id uuid;

create unique index gw_workshops_event_id_key
  on public.gw_workshops (event_id)
  where event_id is not null;

-- ---------------------------------------------------------------------------
-- D15 — Partecipante principale
-- ---------------------------------------------------------------------------
alter table public.gw_booking_participants
  add column is_primary boolean not null default false;

-- Prenotazioni già esistenti: il principale è il primo partecipante attivo inserito.
-- Nella 011 i due partecipanti di una coppia hanno lo stesso added_at (stessa
-- transazione): a parità vale l'ordine fisico di inserimento (ctid), che segue
-- l'ordine in cui le persone sono state indicate nell'aggiunta rapida.
update public.gw_booking_participants bp
   set is_primary = true
 where bp.id in (
   select distinct on (booking_id) id
     from public.gw_booking_participants
    where removed_at is null
    order by booking_id, added_at, ctid
 );

create unique index gw_booking_participants_primary_key
  on public.gw_booking_participants (booking_id)
  where is_primary and removed_at is null;

-- ---------------------------------------------------------------------------
-- Funzioni ridefinite
-- ---------------------------------------------------------------------------
create or replace function public.gw_booking_snapshot(p_booking_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select to_jsonb(b) || jsonb_build_object(
    'participants',
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'id', bp.id, 'person_id', bp.person_id, 'is_primary', bp.is_primary,
                'added_at', bp.added_at, 'removed_at', bp.removed_at)
              order by bp.added_at)
         from gw_booking_participants bp
        where bp.booking_id = b.id),
      '[]'::jsonb))
  from gw_bookings b
  where b.id = p_booking_id;
$$;

-- Il primo elemento di p_people è il principale, il secondo il partner.
-- Le prenotazioni nascono senza quota (la quota si gestisce in Pagamenti).
create or replace function public.gw_create_booking(
  p_operator_id uuid,
  p_workshop_id uuid,
  p_people jsonb,
  p_status public.gw_booking_status,
  p_agreed_fee_cents bigint,
  p_notes text
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_booking_id uuid;
  v_person_id uuid;
  v_item jsonb;
  v_person_ids uuid[] := '{}';
begin
  if not exists (select 1 from gw_workshops where id = p_workshop_id) then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if jsonb_typeof(p_people) is distinct from 'array'
     or jsonb_array_length(p_people) not between 1 and 2 then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'Una prenotazione ha una o due persone.';
  end if;

  for v_item in select value from jsonb_array_elements(p_people) loop
    if v_item ? 'person_id' then
      v_person_id := (v_item->>'person_id')::uuid;
    elsif jsonb_typeof(v_item->'new') = 'object' then
      v_person_id := gw_create_person(p_operator_id, v_item->'new');
    else
      raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Persona non indicata.';
    end if;

    if v_person_id = any (v_person_ids) then
      raise exception 'gw_invalid' using errcode = 'GW400',
        detail = 'La stessa persona non può essere partner di sé stessa.';
    end if;
    perform gw_assert_can_enroll(p_workshop_id, v_person_id);
    v_person_ids := v_person_ids || v_person_id;
  end loop;

  insert into gw_bookings (workshop_id, status, agreed_fee_cents, notes, created_by)
  values (p_workshop_id, coalesce(p_status, 'interessato'), p_agreed_fee_cents, gw_clean(p_notes), p_operator_id)
  returning id into v_booking_id;

  insert into gw_booking_participants (booking_id, workshop_id, person_id, is_primary)
  select v_booking_id, p_workshop_id, ids.person_id, ids.ord = 1
    from unnest(v_person_ids) with ordinality as ids(person_id, ord);

  perform gw_audit(p_operator_id, 'booking', v_booking_id, 'insert', null, gw_booking_snapshot(v_booking_id));
  return v_booking_id;
end;
$$;

-- Cambia partner sostituisce solo il secondario; il principale non si toglie.
create or replace function public.gw_set_partner(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_remove_participant_id uuid,
  p_add_person jsonb
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_booking gw_bookings;
  v_before jsonb;
  v_active integer;
  v_add_person_id uuid;
begin
  select * into v_booking from gw_bookings where id = p_booking_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_bookings', p_booking_id);
  end if;
  if p_remove_participant_id is null and p_add_person is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Nessuna modifica richiesta.';
  end if;

  v_before := gw_booking_snapshot(p_booking_id);

  if p_remove_participant_id is not null then
    if exists (select 1 from gw_booking_participants
                where id = p_remove_participant_id and booking_id = p_booking_id
                  and removed_at is null and is_primary) then
      raise exception 'gw_invalid' using errcode = 'GW400',
        detail = 'Si può sostituire solo il partner, non la persona principale della prenotazione.';
    end if;

    update gw_booking_participants
       set removed_at = now()
     where id = p_remove_participant_id
       and booking_id = p_booking_id
       and removed_at is null;
    if not found then
      raise exception 'gw_not_found' using errcode = 'GW404';
    end if;
  end if;

  if p_add_person is not null then
    if p_add_person ? 'person_id' then
      v_add_person_id := (p_add_person->>'person_id')::uuid;
    elsif jsonb_typeof(p_add_person->'new') = 'object' then
      v_add_person_id := gw_create_person(p_operator_id, p_add_person->'new');
    else
      raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Persona non indicata.';
    end if;

    perform gw_assert_can_enroll(v_booking.workshop_id, v_add_person_id);
    insert into gw_booking_participants (booking_id, workshop_id, person_id, is_primary)
    values (p_booking_id, v_booking.workshop_id, v_add_person_id, false);
  end if;

  select count(*) into v_active
    from gw_booking_participants
   where booking_id = p_booking_id and removed_at is null;

  if v_active = 0 then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'La prenotazione resterebbe senza persone: usa lo stato Cancellato.';
  end if;
  if v_active > 2 then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'Una prenotazione ha al massimo due persone.';
  end if;

  update gw_bookings set version = version + 1 where id = p_booking_id returning * into v_booking;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update', v_before, gw_booking_snapshot(p_booking_id));
  return v_booking.version;
end;
$$;

-- Separa: il partner (secondario) diventa una prenotazione autonoma,
-- principale di sé stessa, con lo stesso stato e senza quota.
create or replace function public.gw_split_participant(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_participant_id uuid
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_booking gw_bookings;
  v_participant gw_booking_participants;
  v_before jsonb;
  v_new_id uuid;
begin
  select * into v_booking from gw_bookings where id = p_booking_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_bookings', p_booking_id);
  end if;

  select * into v_participant
    from gw_booking_participants
   where id = p_participant_id and booking_id = p_booking_id and removed_at is null;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_participant.is_primary then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'Si separa il partner, non la persona principale della prenotazione.';
  end if;

  v_before := gw_booking_snapshot(p_booking_id);

  update gw_booking_participants set removed_at = now() where id = p_participant_id;

  insert into gw_bookings (workshop_id, status, agreed_fee_cents, notes, created_by)
  values (
    v_booking.workshop_id, v_booking.status, null,
    'Separata da una prenotazione di coppia: quota da rivedere.', p_operator_id
  )
  returning id into v_new_id;

  insert into gw_booking_participants (booking_id, workshop_id, person_id, attendance, is_primary)
  values (v_new_id, v_booking.workshop_id, v_participant.person_id, v_participant.attendance, true);

  update gw_bookings set version = version + 1 where id = p_booking_id;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update', v_before, gw_booking_snapshot(p_booking_id));
  perform gw_audit(p_operator_id, 'booking', v_new_id, 'insert', null, gw_booking_snapshot(v_new_id));
  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funzioni nuove
-- ---------------------------------------------------------------------------

-- D14: all'apertura di un evento LuXuria. Crea la riga gw_workshops se manca
-- (accessi simultanei: l'indice unico su event_id + ON CONFLICT evita i
-- doppioni) e aggiorna la copia di nome e date se l'evento è cambiato.
create function public.gw_ensure_workshop_for_event(
  p_operator_id uuid,
  p_event_id uuid,
  p_name text,
  p_starts_on date,
  p_ends_on date
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_workshops;
  v_after gw_workshops;
begin
  if p_event_id is null or gw_clean(p_name) is null or p_starts_on is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Evento non valido.';
  end if;

  insert into gw_workshops (event_id, name, starts_on, ends_on, created_by)
  values (p_event_id, gw_clean(p_name), p_starts_on, coalesce(p_ends_on, p_starts_on), p_operator_id)
  on conflict (event_id) where event_id is not null do nothing
  returning * into v_row;

  if v_row.id is not null then
    perform gw_audit(p_operator_id, 'workshop', v_row.id, 'insert', null, to_jsonb(v_row));
    return v_row.id;
  end if;

  select * into v_row from gw_workshops where event_id = p_event_id for update;

  if v_row.name is distinct from gw_clean(p_name)
     or v_row.starts_on is distinct from p_starts_on
     or v_row.ends_on is distinct from coalesce(p_ends_on, p_starts_on) then
    update gw_workshops
       set name = gw_clean(p_name),
           starts_on = p_starts_on,
           ends_on = coalesce(p_ends_on, p_starts_on),
           version = version + 1
     where id = v_row.id
    returning * into v_after;

    perform gw_audit(
      p_operator_id, 'workshop', v_row.id, 'update',
      jsonb_build_object('name', v_row.name, 'starts_on', v_row.starts_on, 'ends_on', v_row.ends_on),
      jsonb_build_object('name', v_after.name, 'starts_on', v_after.starts_on, 'ends_on', v_after.ends_on)
    );
  end if;

  return v_row.id;
end;
$$;

-- D14: nel tab Info si modificano solo capienza, quota standard, percentuale
-- Peony e descrizione. Nome e date restano quelli dell'evento.
create function public.gw_update_workshop_settings(
  p_operator_id uuid,
  p_id uuid,
  p_version integer,
  p_data jsonb
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_workshops;
  v_after gw_workshops;
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
  return v_after.version;
end;
$$;

-- Stato e note della prenotazione, senza toccare la quota (D16: i soldi
-- stanno solo in Pagamenti).
create function public.gw_update_booking_status(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_status public.gw_booking_status,
  p_notes text
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
         version = version + 1
   where id = p_booking_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update', to_jsonb(v_before), to_jsonb(v_after));
  return v_after.version;
end;
$$;

-- D17: npm.cmd run gw:rename-operator -- "<vecchio>" "<nuovo>"
create function public.gw_rename_operator(
  p_operator_id uuid,
  p_old_name text,
  p_new_name text
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_old text;
begin
  if gw_clean(p_new_name) is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Il nuovo nome è vuoto.';
  end if;

  select id, display_name into v_id, v_old
    from gw_operators
   where lower(btrim(display_name)) = lower(btrim(p_old_name))
   for update;
  if v_id is null then
    raise exception 'gw_not_found' using errcode = 'GW404', detail = format('Operatore "%s" non trovato.', p_old_name);
  end if;

  if exists (
    select 1 from gw_operators
     where id <> v_id and lower(btrim(display_name)) = lower(btrim(p_new_name))
  ) then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = format('Esiste già un operatore "%s".', btrim(p_new_name));
  end if;

  update gw_operators set display_name = btrim(p_new_name) where id = v_id;

  perform gw_audit(
    p_operator_id, 'operator', v_id, 'update',
    jsonb_build_object('display_name', v_old),
    jsonb_build_object('display_name', btrim(p_new_name))
  );
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sicurezza: eseguibili solo dalla service role
-- ---------------------------------------------------------------------------
revoke execute on function public.gw_ensure_workshop_for_event(uuid, uuid, text, date, date) from public, anon, authenticated;
revoke execute on function public.gw_update_workshop_settings(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.gw_update_booking_status(uuid, uuid, integer, public.gw_booking_status, text) from public, anon, authenticated;
revoke execute on function public.gw_rename_operator(uuid, text, text) from public, anon, authenticated;

grant execute on function public.gw_ensure_workshop_for_event(uuid, uuid, text, date, date) to service_role;
grant execute on function public.gw_update_workshop_settings(uuid, uuid, integer, jsonb) to service_role;
grant execute on function public.gw_update_booking_status(uuid, uuid, integer, public.gw_booking_status, text) to service_role;
grant execute on function public.gw_rename_operator(uuid, text, text) to service_role;

-- PostgREST: ricarica lo schema per vedere colonne e funzioni nuove.
notify pgrst, 'reload schema';

commit;
