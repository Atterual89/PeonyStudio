-- Gestionale Workshop — funzioni v2 (Fase 2: workshop, persone, iscrizioni)
--
-- Solo funzioni nuove con prefisso gw_: nessuna tabella creata o modificata.
-- Rollback: 011_gw_functions_v2.down.sql
--
-- Ogni funzione:
--   - riceve p_operator_id e scrive gw_audit_log nella stessa transazione;
--   - sugli aggiornamenti controlla `version` (WHERE id = ... AND version = ...);
--   - segnala gli errori applicativi con SQLSTATE dedicati, tradotti in
--     italiano dal server (src/lib/gestionale/errors.ts):
--       GW404 non trovato · GW409 conflitto di versione · GWDUP già iscritto
--       GWMRG unione bloccata · GW400 dati non validi

begin;

-- ---------------------------------------------------------------------------
-- Utilità interne
-- ---------------------------------------------------------------------------
create function public.gw_audit(
  p_operator_id uuid,
  p_entity text,
  p_entity_id uuid,
  p_action public.gw_audit_action,
  p_before jsonb,
  p_after jsonb
)
returns void
language sql
set search_path = public, pg_temp
as $$
  insert into gw_audit_log (operator_id, entity, entity_id, action, before, after)
  values (p_operator_id, p_entity, p_entity_id, p_action, p_before, p_after);
$$;

create function public.gw_clean(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(btrim(p_value), '');
$$;

-- Dopo un UPDATE ... WHERE version = p_version andato a vuoto: distingue
-- "non esiste" da "modificato da un altro operatore".
create function public.gw_raise_missing_or_conflict(p_table regclass, p_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
begin
  execute format('select exists (select 1 from %s where id = $1)', p_table)
    into v_exists using p_id;

  if v_exists then
    raise exception 'gw_conflict' using errcode = 'GW409';
  end if;
  raise exception 'gw_not_found' using errcode = 'GW404';
end;
$$;

create function public.gw_booking_snapshot(p_booking_id uuid)
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

-- Verifica che la persona esista, non sia stata unita e non abbia già
-- un'iscrizione attiva al workshop.
create function public.gw_assert_can_enroll(p_workshop_id uuid, p_person_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_person gw_people;
begin
  select * into v_person from gw_people where id = p_person_id;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_person.merged_into is not null then
    raise exception 'gw_person_merged' using errcode = 'GW400',
      detail = 'La persona è stata unita a un''altra scheda.';
  end if;

  if exists (
    select 1 from gw_booking_participants
     where workshop_id = p_workshop_id
       and person_id = p_person_id
       and removed_at is null
  ) then
    raise exception 'gw_already_enrolled' using errcode = 'GWDUP',
      detail = coalesce(v_person.nickname, btrim(concat_ws(' ', v_person.first_name, v_person.last_name)));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workshop
-- ---------------------------------------------------------------------------
create function public.gw_create_workshop(p_operator_id uuid, p_data jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_workshops;
begin
  insert into gw_workshops (
    name, starts_on, ends_on, description, capacity, default_fee_cents, peony_pct, created_by
  ) values (
    gw_clean(p_data->>'name'),
    (p_data->>'starts_on')::date,
    coalesce((gw_clean(p_data->>'ends_on'))::date, (p_data->>'starts_on')::date),
    gw_clean(p_data->>'description'),
    (gw_clean(p_data->>'capacity'))::integer,
    (gw_clean(p_data->>'default_fee_cents'))::bigint,
    coalesce((gw_clean(p_data->>'peony_pct'))::numeric, 30),
    p_operator_id
  )
  returning * into v_row;

  perform gw_audit(p_operator_id, 'workshop', v_row.id, 'insert', null, to_jsonb(v_row));
  return v_row.id;
end;
$$;

create function public.gw_update_workshop(
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
     set name = gw_clean(p_data->>'name'),
         starts_on = (p_data->>'starts_on')::date,
         ends_on = coalesce((gw_clean(p_data->>'ends_on'))::date, (p_data->>'starts_on')::date),
         description = gw_clean(p_data->>'description'),
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

-- ---------------------------------------------------------------------------
-- Persone
-- ---------------------------------------------------------------------------
create function public.gw_create_person(p_operator_id uuid, p_data jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_people;
begin
  insert into gw_people (
    first_name, last_name, nickname, email, instagram, phone,
    teamartist_id, notes, association_member_id, created_by
  ) values (
    gw_clean(p_data->>'first_name'),
    gw_clean(p_data->>'last_name'),
    gw_clean(p_data->>'nickname'),
    lower(gw_clean(p_data->>'email')),
    gw_clean(p_data->>'instagram'),
    gw_clean(p_data->>'phone'),
    gw_clean(p_data->>'teamartist_id'),
    gw_clean(p_data->>'notes'),
    (gw_clean(p_data->>'association_member_id'))::uuid,
    p_operator_id
  )
  returning * into v_row;

  perform gw_audit(p_operator_id, 'person', v_row.id, 'insert', null, to_jsonb(v_row));
  return v_row.id;
end;
$$;

-- Aggiorna i dati anagrafici. Il collegamento al libro soci ha una funzione
-- propria (gw_link_association_member).
create function public.gw_update_person(
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
  v_before gw_people;
  v_after gw_people;
begin
  select * into v_before from gw_people where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_people', p_id);
  end if;
  if v_before.merged_into is not null then
    raise exception 'gw_person_merged' using errcode = 'GW400',
      detail = 'La persona è stata unita a un''altra scheda.';
  end if;

  update gw_people
     set first_name = gw_clean(p_data->>'first_name'),
         last_name = gw_clean(p_data->>'last_name'),
         nickname = gw_clean(p_data->>'nickname'),
         email = lower(gw_clean(p_data->>'email')),
         instagram = gw_clean(p_data->>'instagram'),
         phone = gw_clean(p_data->>'phone'),
         teamartist_id = gw_clean(p_data->>'teamartist_id'),
         notes = gw_clean(p_data->>'notes'),
         version = version + 1
   where id = p_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'person', p_id, 'update', to_jsonb(v_before), to_jsonb(v_after));
  return v_after.version;
end;
$$;

create function public.gw_link_association_member(
  p_operator_id uuid,
  p_person_id uuid,
  p_version integer,
  p_association_member_id uuid
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_people;
  v_after gw_people;
begin
  select * into v_before from gw_people where id = p_person_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_people', p_person_id);
  end if;

  update gw_people
     set association_member_id = p_association_member_id,
         version = version + 1
   where id = p_person_id
  returning * into v_after;

  perform gw_audit(
    p_operator_id, 'person', p_person_id, 'update',
    jsonb_build_object('association_member_id', v_before.association_member_id),
    jsonb_build_object('association_member_id', v_after.association_member_id)
  );
  return v_after.version;
end;
$$;

-- Unione: le iscrizioni (anche quelle rimosse, per lo storico) passano alla
-- persona principale; la secondaria resta con merged_into. Bloccata se
-- entrambe hanno un'iscrizione attiva allo stesso workshop.
create function public.gw_merge_people(
  p_operator_id uuid,
  p_primary_id uuid,
  p_primary_version integer,
  p_secondary_id uuid,
  p_secondary_version integer,
  p_values jsonb
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_primary gw_people;
  v_secondary gw_people;
  v_after gw_people;
  v_conflict text;
begin
  if p_primary_id = p_secondary_id then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Non puoi unire una persona con sé stessa.';
  end if;

  select * into v_primary from gw_people where id = p_primary_id and version = p_primary_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_people', p_primary_id);
  end if;
  select * into v_secondary from gw_people where id = p_secondary_id and version = p_secondary_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_people', p_secondary_id);
  end if;
  if v_primary.merged_into is not null or v_secondary.merged_into is not null then
    raise exception 'gw_person_merged' using errcode = 'GW400',
      detail = 'Una delle due persone è già stata unita.';
  end if;

  select string_agg(distinct w.name, ', ')
    into v_conflict
    from gw_booking_participants a
    join gw_booking_participants b
      on b.workshop_id = a.workshop_id
     and b.person_id = p_secondary_id
     and b.removed_at is null
    join gw_workshops w on w.id = a.workshop_id
   where a.person_id = p_primary_id
     and a.removed_at is null;

  if v_conflict is not null then
    raise exception 'gw_merge_blocked' using errcode = 'GWMRG', detail = v_conflict;
  end if;

  update gw_booking_participants set person_id = p_primary_id where person_id = p_secondary_id;

  update gw_membership_overrides o
     set person_id = p_primary_id
   where o.person_id = p_secondary_id
     and not exists (
       select 1 from gw_membership_overrides p
        where p.person_id = p_primary_id and p.year = o.year
     );

  -- Persone unite in precedenza nella secondaria puntano ora alla principale.
  update gw_people set merged_into = p_primary_id where merged_into = p_secondary_id;

  update gw_people
     set first_name = gw_clean(p_values->>'first_name'),
         last_name = gw_clean(p_values->>'last_name'),
         nickname = gw_clean(p_values->>'nickname'),
         email = lower(gw_clean(p_values->>'email')),
         instagram = gw_clean(p_values->>'instagram'),
         phone = gw_clean(p_values->>'phone'),
         teamartist_id = gw_clean(p_values->>'teamartist_id'),
         notes = gw_clean(p_values->>'notes'),
         association_member_id = (gw_clean(p_values->>'association_member_id'))::uuid,
         version = version + 1
   where id = p_primary_id
  returning * into v_after;

  update gw_people
     set merged_into = p_primary_id,
         version = version + 1
   where id = p_secondary_id;

  perform gw_audit(
    p_operator_id, 'person', p_primary_id, 'merge',
    jsonb_build_object('primary', to_jsonb(v_primary), 'secondary', to_jsonb(v_secondary)),
    jsonb_build_object('primary', to_jsonb(v_after), 'merged_person_id', p_secondary_id)
  );
  return v_after.version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Prenotazioni
-- ---------------------------------------------------------------------------
-- Aggiunta rapida. p_people è un array JSON di 1 o 2 elementi, ognuno:
--   {"person_id": "<uuid>"}            persona esistente
--   {"new": {first_name, nickname, …}}  persona nuova (anche dal libro soci)
-- Persone nuove e prenotazione si salvano nella stessa transazione.
create function public.gw_create_booking(
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

create function public.gw_update_booking(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_status public.gw_booking_status,
  p_agreed_fee_cents bigint,
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
         agreed_fee_cents = p_agreed_fee_cents,
         notes = gw_clean(p_notes),
         version = version + 1
   where id = p_booking_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update', to_jsonb(v_before), to_jsonb(v_after));
  return v_after.version;
end;
$$;

-- Aggiunge, toglie o cambia il partner. Cambio partner = removed_at sul
-- vecchio partecipante + nuova riga: lo storico resta.
-- p_add_person: null, {"person_id": "<uuid>"} oppure {"new": {...}} come in
-- gw_create_booking.
create function public.gw_set_partner(
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

-- Separa: la persona esce dalla prenotazione condivisa e diventa una
-- prenotazione autonoma, con lo stesso stato e SENZA quota (la quota resta
-- sulla prenotazione originale), con una nota da rivedere.
create function public.gw_split_participant(
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

-- ---------------------------------------------------------------------------
-- Sicurezza: eseguibili solo dalla service role
-- ---------------------------------------------------------------------------
revoke execute on function public.gw_audit(uuid, text, uuid, public.gw_audit_action, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.gw_clean(text) from public, anon, authenticated;
revoke execute on function public.gw_raise_missing_or_conflict(regclass, uuid) from public, anon, authenticated;
revoke execute on function public.gw_booking_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.gw_assert_can_enroll(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.gw_create_workshop(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.gw_update_workshop(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.gw_create_person(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.gw_update_person(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.gw_link_association_member(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function public.gw_merge_people(uuid, uuid, integer, uuid, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.gw_create_booking(uuid, uuid, jsonb, public.gw_booking_status, bigint, text) from public, anon, authenticated;
revoke execute on function public.gw_update_booking(uuid, uuid, integer, public.gw_booking_status, bigint, text) from public, anon, authenticated;
revoke execute on function public.gw_set_partner(uuid, uuid, integer, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.gw_split_participant(uuid, uuid, integer, uuid) from public, anon, authenticated;

grant execute on function public.gw_audit(uuid, text, uuid, public.gw_audit_action, jsonb, jsonb) to service_role;
grant execute on function public.gw_clean(text) to service_role;
grant execute on function public.gw_raise_missing_or_conflict(regclass, uuid) to service_role;
grant execute on function public.gw_booking_snapshot(uuid) to service_role;
grant execute on function public.gw_assert_can_enroll(uuid, uuid) to service_role;
grant execute on function public.gw_create_workshop(uuid, jsonb) to service_role;
grant execute on function public.gw_update_workshop(uuid, uuid, integer, jsonb) to service_role;
grant execute on function public.gw_create_person(uuid, jsonb) to service_role;
grant execute on function public.gw_update_person(uuid, uuid, integer, jsonb) to service_role;
grant execute on function public.gw_link_association_member(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.gw_merge_people(uuid, uuid, integer, uuid, integer, jsonb) to service_role;
grant execute on function public.gw_create_booking(uuid, uuid, jsonb, public.gw_booking_status, bigint, text) to service_role;
grant execute on function public.gw_update_booking(uuid, uuid, integer, public.gw_booking_status, bigint, text) to service_role;
grant execute on function public.gw_set_partner(uuid, uuid, integer, uuid, jsonb) to service_role;
grant execute on function public.gw_split_participant(uuid, uuid, integer, uuid) to service_role;

commit;
