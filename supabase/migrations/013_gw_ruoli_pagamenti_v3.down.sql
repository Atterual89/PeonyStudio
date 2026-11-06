-- Rollback di 013_gw_ruoli_pagamenti_v3.sql
--
-- Tocca solo oggetti gw_. Elimina le funzioni nuove, ripristina quelle
-- ridefinite (come in 010/012) ed elimina colonne e tipi aggiunti.
-- ATTENZIONE: si perdono ruoli, testi scritti da Ale (entered_as), stato
-- dell'abbinamento, tariffe dedicate e tipo dei movimenti. Pagamenti,
-- prenotazioni e persone (anche quelle create in automatico) restano.

begin;

drop function if exists public.gw_set_operator_role(uuid, text, public.gw_operator_role);
drop function if exists public.gw_import_roster(uuid, uuid, date, public.gw_party, jsonb);
drop function if exists public.gw_correct_payment(uuid, uuid, jsonb, text);
drop function if exists public.gw_add_payment(uuid, uuid, jsonb);
drop function if exists public.gw_insert_payment(uuid, uuid, public.gw_payment_kind, bigint, public.gw_payment_type, public.gw_payment_method, date, public.gw_party, text, uuid, text);
drop function if exists public.gw_resolve_match(uuid, uuid, integer, uuid, text, uuid);
drop function if exists public.gw_reject_match(uuid, uuid, integer, uuid);
drop function if exists public.gw_confirm_match(uuid, uuid, integer, uuid);
drop function if exists public.gw_finish_match_change(uuid, uuid, jsonb);
drop function if exists public.gw_lock_participant(uuid, integer, uuid);
drop function if exists public.gw_apply_standard_fee(uuid, uuid, text, integer);
drop function if exists public.gw_update_registration(uuid, uuid, integer, public.gw_booking_status, text, public.gw_invoice_status, bigint);
drop function if exists public.gw_create_booking_entered(uuid, uuid, jsonb, public.gw_booking_status, bigint, text);
drop function if exists public.gw_apply_auto_status(uuid, uuid);
drop function if exists public.gw_match_entered_person(uuid, uuid, text, uuid[]);
drop function if exists public.gw_remove_person_if_unused(uuid, uuid);
drop function if exists public.gw_person_from_member(uuid, uuid, text);
drop function if exists public.gw_create_person_from_text(uuid, text);
drop function if exists public.gw_name_key(text);

drop function if exists public.gw_norm(text);

-- Funzioni come in 012_gw_correzioni_v2b.sql
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

-- Come in 010_gw_schema_v1.sql
create or replace function public.gw_payments_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'gw_payments: i pagamenti non si cancellano, inserisci una rettifica';
  end if;

  if new.booking_id is distinct from old.booking_id
     or new.kind is distinct from old.kind
     or new.amount_cents is distinct from old.amount_cents
     or new.received_by is distinct from old.received_by
     or new.corrects_payment_id is distinct from old.corrects_payment_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'gw_payments: importo, tipo, prenotazione e incassante non sono modificabili, inserisci una rettifica';
  end if;

  return new;
end;
$$;

drop function if exists public.gw_admin_entry_label(uuid);
drop index if exists public.gw_booking_participants_to_match_idx;

alter table public.gw_payments drop column if exists payment_type;
alter table public.gw_booking_participants
  drop column if exists possible_duplicate_person_id,
  drop column if exists auto_created_person,
  drop column if exists match_status,
  drop column if exists entered_as;
alter table public.gw_bookings drop column if exists fee_custom;
alter table public.gw_operators drop column if exists role;

drop type if exists public.gw_payment_type;
drop type if exists public.gw_match_status;
drop type if exists public.gw_operator_role;

notify pgrst, 'reload schema';

commit;
