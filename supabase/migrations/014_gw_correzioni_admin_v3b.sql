-- Gestionale Workshop — correzioni 3b (docs/gestionale/00-contesto.md sez. 9)
--
-- Tocca SOLO oggetti gw_. Legge (mai scrive) `association_members`, copiando
-- solo nome, cognome ed email (D11).
-- Rollback: 014_gw_correzioni_admin_v3b.down.sql
--
--   1. Collegamento al libro soci (in qualsiasi modo): i campi VUOTI della
--      persona (nome, cognome, email) prendono i valori del socio; quelli
--      pieni non si toccano. Sistemate anche le persone già collegate.
--   2. gw_update_booking_notes: l'admin modifica solo le note della
--      prenotazione (lo stato lo gestisce l'organizzatrice).

begin;

do $$
begin
  if to_regprocedure('public.gw_import_roster(uuid, uuid, date, public.gw_party, jsonb)') is null then
    raise exception 'Migrazione 014 interrotta: applica prima 013_gw_ruoli_pagamenti_v3.sql';
  end if;
  if to_regprocedure('public.gw_fill_person_from_member(uuid, uuid)') is not null then
    raise exception 'Migrazione 014 interrotta: sembra già applicata (gw_fill_person_from_member esiste)';
  end if;
end;
$$;

-- Email del socio: quella della riga collegata; se manca, l'unica email delle
-- altre righe dello stesso socio (stesso nome e cognome, fonti attendibili),
-- come getMemberSummary nel server. null se il libro soci non ha email.
create function public.gw_member_email(p_member_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    lower(gw_clean(m.email)),
    (select min(lower(btrim(o.email)))
       from association_members o
      where o.source in ('official_members_book', 'manual_override')
        and gw_clean(o.email) is not null
        and gw_name_key(concat_ws(' ', o.first_name, o.last_name)) = gw_name_key(concat_ws(' ', m.first_name, m.last_name))
     having count(distinct lower(btrim(o.email))) = 1))
  from association_members m
  where m.id = p_member_id;
$$;

-- Riempie i campi vuoti della persona con i dati del socio collegato.
-- Restituisce true se ha cambiato qualcosa (con storico e version + 1).
create function public.gw_fill_person_from_member(p_operator_id uuid, p_person_id uuid)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_people;
  v_after gw_people;
  v_member record;
begin
  select * into v_before from gw_people where id = p_person_id for update;
  if not found or v_before.association_member_id is null then
    return false;
  end if;

  select m.first_name, m.last_name, gw_member_email(m.id) as email
    into v_member
    from association_members m
   where m.id = v_before.association_member_id;
  if not found then
    return false;
  end if;

  if (gw_clean(v_before.first_name) is not null or gw_clean(v_member.first_name) is null)
     and (gw_clean(v_before.last_name) is not null or gw_clean(v_member.last_name) is null)
     and (gw_clean(v_before.email) is not null or v_member.email is null) then
    return false;
  end if;

  update gw_people
     set first_name = coalesce(gw_clean(first_name), gw_clean(v_member.first_name)),
         last_name = coalesce(gw_clean(last_name), gw_clean(v_member.last_name)),
         email = coalesce(gw_clean(email), v_member.email),
         version = version + 1
   where id = p_person_id
  returning * into v_after;

  perform gw_audit(
    p_operator_id, 'person', p_person_id, 'update',
    jsonb_build_object('first_name', v_before.first_name, 'last_name', v_before.last_name, 'email', v_before.email),
    jsonb_build_object('first_name', v_after.first_name, 'last_name', v_after.last_name, 'email', v_after.email,
                       'nota', 'campi vuoti presi dal libro soci')
  );
  return true;
end;
$$;

-- "Cerca nel libro soci": collega e riempie i campi vuoti.
create or replace function public.gw_link_association_member(
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

  if p_association_member_id is not null then
    perform gw_fill_person_from_member(p_operator_id, p_person_id);
  end if;

  return (select version from gw_people where id = p_person_id);
end;
$$;

-- Abbinamento automatico e "Collega" a un socio: se il socio è già collegato
-- a una sola persona si usa quella (riempiendone i campi vuoti), altrimenti
-- si crea la persona con nome, cognome ed email del socio.
create or replace function public.gw_person_from_member(p_operator_id uuid, p_member_id uuid, p_fallback_text text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_member record;
  v_linked uuid[];
begin
  select m.id, m.first_name, m.last_name, gw_member_email(m.id) as email
    into v_member
    from association_members m
   where m.id = p_member_id;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404', detail = 'Socio non trovato nel libro soci.';
  end if;

  select array_agg(p.id) into v_linked
    from gw_people p
   where p.merged_into is null and p.association_member_id = p_member_id;
  if coalesce(array_length(v_linked, 1), 0) = 1 then
    perform gw_fill_person_from_member(p_operator_id, v_linked[1]);
    return v_linked[1];
  end if;

  return gw_create_person(p_operator_id, jsonb_build_object(
    'first_name', v_member.first_name,
    'last_name', v_member.last_name,
    'email', v_member.email,
    -- CHECK di gw_people: serve il nome o il nickname.
    'nickname', case when gw_clean(v_member.first_name) is null then gw_clean(p_fallback_text) end,
    'association_member_id', v_member.id));
end;
$$;

-- Abbinamento automatico: come in 013, ma la persona già collegata al socio
-- trovato prende i campi vuoti dal libro soci.
create or replace function public.gw_match_entered_person(
  p_operator_id uuid,
  p_workshop_id uuid,
  p_text text,
  p_exclude uuid[] default '{}'
)
returns table (out_person_id uuid, out_match_status public.gw_match_status, out_auto_created boolean, out_duplicate_of uuid)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_text text := gw_clean(p_text);
  v_norm text := gw_norm(p_text);
  v_is_email boolean;
  v_email text;
  v_key text;
  v_ids uuid[];
  v_candidate uuid;
  v_auto_created boolean := false;
  v_member_rows uuid[];
  v_member_id uuid;
  v_emails integer;
  v_linked uuid[];
begin
  if v_text is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Scrivi il nome, il nickname o l''email.';
  end if;
  v_is_email := position('@' in v_text) > 0;
  v_email := case when v_is_email then lower(replace(v_text, ' ', '')) end;

  -- 1. Persone del gestionale: corrispondenza esatta.
  select array_agg(p.id) into v_ids
    from gw_people p
   where p.merged_into is null
     and case
           when v_is_email then lower(btrim(p.email)) = v_email
           else gw_norm(p.nickname) = v_norm
             or gw_norm(concat_ws(' ', p.first_name, p.last_name)) = v_norm
         end;

  if coalesce(array_length(v_ids, 1), 0) = 1 then
    v_candidate := v_ids[1];
  elsif coalesce(array_length(v_ids, 1), 0) = 0 then
    -- 2. Libro soci (sola lettura), stesse fonti del resto del gestionale.
    if v_is_email then
      select array_agg(m.id order by m.membership_expires_at desc nulls last) into v_member_rows
        from association_members m
       where m.source in ('official_members_book', 'manual_override')
         and lower(btrim(m.email)) = v_email;
      -- Stessa email = stesso socio.
      v_member_id := v_member_rows[1];
    else
      v_key := gw_name_key(v_text);
      if v_key is not null then
        select array_agg(m.id order by m.membership_expires_at desc nulls last),
               count(distinct lower(btrim(m.email))) filter (where gw_clean(m.email) is not null)
          into v_member_rows, v_emails
          from association_members m
         where m.source in ('official_members_book', 'manual_override')
           and gw_name_key(concat_ws(' ', m.first_name, m.last_name)) = v_key;
        -- Omonimi con email diverse: soci diversi, nessun abbinamento.
        if coalesce(v_emails, 0) <= 1 then
          v_member_id := v_member_rows[1];
        end if;
      end if;
    end if;

    if v_member_id is not null then
      select array_agg(p.id) into v_linked
        from gw_people p
       where p.merged_into is null and p.association_member_id = any (v_member_rows);

      if coalesce(array_length(v_linked, 1), 0) = 1 then
        v_candidate := v_linked[1];
        -- 014: la persona già collegata prende i campi vuoti dal libro soci.
        perform gw_fill_person_from_member(p_operator_id, v_candidate);
      elsif coalesce(array_length(v_linked, 1), 0) = 0 then
        v_candidate := gw_person_from_member(p_operator_id, v_member_id, v_text);
        v_auto_created := true;
      end if;
    end if;
  end if;

  if v_candidate is not null then
    -- Già iscritta a questo workshop (o già scelta nella coppia): per Ale
    -- nessun errore, per gli admin "possibile doppia iscrizione".
    if v_candidate = any (coalesce(p_exclude, '{}'))
       or exists (select 1 from gw_booking_participants
                   where workshop_id = p_workshop_id and person_id = v_candidate and removed_at is null) then
      if v_auto_created then
        perform gw_remove_person_if_unused(p_operator_id, v_candidate);
      end if;
      return query select gw_create_person_from_text(p_operator_id, v_text), 'da_abbinare'::gw_match_status, true, v_candidate;
      return;
    end if;
    return query select v_candidate, 'automatico'::gw_match_status, v_auto_created, null::uuid;
    return;
  end if;

  -- 3. Nessuna corrispondenza o più di una.
  return query select gw_create_person_from_text(p_operator_id, v_text), 'da_abbinare'::gw_match_status, true, null::uuid;
end;
$$;

-- Admin, tab Partecipanti: solo le note (lo stato resta all'organizzatrice).
create function public.gw_update_booking_notes(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
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
     set notes = gw_clean(p_notes),
         version = version + 1
   where id = p_booking_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update',
                   jsonb_build_object('notes', v_before.notes), jsonb_build_object('notes', v_after.notes));
  return v_after.version;
end;
$$;

-- Persone già collegate al libro soci: stessi campi vuoti, stessa regola.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.gw_people
     where association_member_id is not null and merged_into is null
     order by created_at
  loop
    perform public.gw_fill_person_from_member(null, v_id);
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
    'public.gw_member_email(uuid)',
    'public.gw_fill_person_from_member(uuid, uuid)',
    'public.gw_link_association_member(uuid, uuid, integer, uuid)',
    'public.gw_person_from_member(uuid, uuid, text)',
    'public.gw_match_entered_person(uuid, uuid, text, uuid[])',
    'public.gw_update_booking_notes(uuid, uuid, integer, text)'
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
