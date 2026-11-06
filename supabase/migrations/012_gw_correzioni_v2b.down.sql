-- Rollback di 012_gw_correzioni_v2b.sql
--
-- Tocca solo oggetti gw_. Ripristina le funzioni come in 011, elimina le
-- funzioni nuove e le colonne event_id / is_primary.
--
-- STATI (D16): Postgres non permette di togliere un valore da un enum senza
-- ricreare il tipo (e tutte le colonne e funzioni che lo usano). Scelta più
-- sicura: i valori 'acconto' e 'saldato' RESTANO nel tipo ma inutilizzati; le
-- prenotazioni con quegli stati tornano a 'prenotato' e poi 'prenotato' viene
-- rinominato di nuovo in 'confermato'. L'informazione acconto/saldato va
-- persa: si ricava comunque dai pagamenti.

begin;

drop function if exists public.gw_rename_operator(uuid, text, text);
drop function if exists public.gw_update_booking_status(uuid, uuid, integer, public.gw_booking_status, text);
drop function if exists public.gw_update_workshop_settings(uuid, uuid, integer, jsonb);
drop function if exists public.gw_ensure_workshop_for_event(uuid, uuid, text, date, date);

update public.gw_bookings set status = 'prenotato' where status in ('acconto', 'saldato');
alter type public.gw_booking_status rename value 'prenotato' to 'confermato';

-- Funzioni come in 011_gw_functions_v2.sql
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
                'id', bp.id, 'person_id', bp.person_id,
                'added_at', bp.added_at, 'removed_at', bp.removed_at)
              order by bp.added_at)
         from gw_booking_participants bp
        where bp.booking_id = b.id),
      '[]'::jsonb))
  from gw_bookings b
  where b.id = p_booking_id;
$$;

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
  values (p_workshop_id, coalesce(p_status, 'confermato'), p_agreed_fee_cents, gw_clean(p_notes), p_operator_id)
  returning id into v_booking_id;

  insert into gw_booking_participants (booking_id, workshop_id, person_id)
  select v_booking_id, p_workshop_id, unnest(v_person_ids);

  perform gw_audit(p_operator_id, 'booking', v_booking_id, 'insert', null, gw_booking_snapshot(v_booking_id));
  return v_booking_id;
end;
$$;

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
    insert into gw_booking_participants (booking_id, workshop_id, person_id)
    values (p_booking_id, v_booking.workshop_id, v_add_person_id);
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

  if (select count(*) from gw_booking_participants
       where booking_id = p_booking_id and removed_at is null) < 2 then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'Si può separare solo una prenotazione di coppia.';
  end if;

  v_before := gw_booking_snapshot(p_booking_id);

  update gw_booking_participants set removed_at = now() where id = p_participant_id;

  insert into gw_bookings (workshop_id, status, agreed_fee_cents, notes, created_by)
  values (
    v_booking.workshop_id, v_booking.status, null,
    'Separata da una prenotazione di coppia: quota da rivedere.', p_operator_id
  )
  returning id into v_new_id;

  insert into gw_booking_participants (booking_id, workshop_id, person_id, attendance)
  values (v_new_id, v_booking.workshop_id, v_participant.person_id, v_participant.attendance);

  update gw_bookings set version = version + 1 where id = p_booking_id;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update', v_before, gw_booking_snapshot(p_booking_id));
  perform gw_audit(p_operator_id, 'booking', v_new_id, 'insert', null, gw_booking_snapshot(v_new_id));
  return v_new_id;
end;
$$;

drop index if exists public.gw_booking_participants_primary_key;
alter table public.gw_booking_participants drop column if exists is_primary;

drop index if exists public.gw_workshops_event_id_key;
alter table public.gw_workshops drop column if exists event_id;

notify pgrst, 'reload schema';

commit;
