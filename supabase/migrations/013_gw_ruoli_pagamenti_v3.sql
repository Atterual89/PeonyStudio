-- Gestionale Workshop — ruoli, iscrizioni di Ale e pagamenti v3
-- (D18–D21, docs/gestionale/00-contesto.md sezione 9)
--
-- Tocca SOLO oggetti gw_. Legge (mai scrive) `association_members` dentro
-- l'abbinamento automatico, copiando solo nome, cognome ed email (D11).
-- Rollback: 013_gw_ruoli_pagamenti_v3.down.sql
--
--   D18  gw_operators.role (admin | organizzatrice) + gw_set_operator_role
--   D19  gw_bookings.fee_custom, quota standard alla creazione,
--        gw_update_registration, gw_apply_standard_fee
--   D20  gw_booking_participants.entered_as / match_status / ...
--        (entered_as anche per le iscrizioni degli admin: nome visualizzato),
--        gw_match_entered_person, gw_create_booking_entered e le azioni
--        admin di conferma e correzione dell'abbinamento
--   D21  gw_payments.payment_type, gw_add_payment, gw_correct_payment,
--        gw_apply_auto_status, gw_import_roster

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'gw_booking_participants' and column_name = 'is_primary'
  ) then
    raise exception 'Migrazione 013 interrotta: applica prima 012_gw_correzioni_v2b.sql';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'gw_operators' and column_name = 'role'
  ) then
    raise exception 'Migrazione 013 interrotta: sembra già applicata (gw_operators.role esiste)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.gw_operator_role as enum ('admin', 'organizzatrice');
create type public.gw_match_status as enum ('automatico', 'da_abbinare', 'confermato');
create type public.gw_payment_type as enum ('acconto', 'saldo', 'altro');

-- ---------------------------------------------------------------------------
-- D18 — Ruoli. Default: privilegio minimo. Gli operatori esistenti diventano
-- admin, tranne "Ale" (senza distinzione maiuscole/minuscole).
-- ---------------------------------------------------------------------------
alter table public.gw_operators
  add column role public.gw_operator_role not null default 'organizzatrice';

update public.gw_operators
   set role = 'admin'
 where lower(btrim(display_name)) <> 'ale';

insert into public.gw_audit_log (operator_id, entity, entity_id, action, after)
select null, 'operator', id, 'update', jsonb_build_object('role', role, 'origine', 'migrazione 013')
  from public.gw_operators;

-- ---------------------------------------------------------------------------
-- D19 — Tariffa dedicata
-- ---------------------------------------------------------------------------
alter table public.gw_bookings
  add column fee_custom boolean not null default false;

-- ---------------------------------------------------------------------------
-- D20 — Testo scritto da Ale e abbinamento automatico
-- ---------------------------------------------------------------------------
alter table public.gw_booking_participants
  add column entered_as text check (entered_as is null or btrim(entered_as) <> ''),
  add column match_status public.gw_match_status not null default 'confermato',
  add column auto_created_person boolean not null default false,
  add column possible_duplicate_person_id uuid references public.gw_people (id);

create index gw_booking_participants_to_match_idx
  on public.gw_booking_participants (workshop_id)
  where match_status <> 'confermato' and removed_at is null;

-- Iscrizioni inserite da un admin con la ricerca: entered_as = nome
-- visualizzato al momento dell'inserimento. Il nickname, altrimenti SOLO il
-- nome di battesimo: mai cognome né email (D18, è ciò che vede Ale).
create function public.gw_admin_entry_label(p_person_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(btrim(nickname), ''), nullif(btrim(first_name), ''))
    from gw_people
   where id = p_person_id;
$$;

-- Iscrizioni già presenti (tutte inserite dagli admin): stessa regola.
update public.gw_booking_participants bp
   set entered_as = public.gw_admin_entry_label(bp.person_id)
 where bp.entered_as is null;

-- ---------------------------------------------------------------------------
-- D21 — Tipo del movimento
-- ---------------------------------------------------------------------------
alter table public.gw_payments
  add column payment_type public.gw_payment_type not null default 'altro';

-- Il tipo, come importo e incassante, non si modifica: si corregge con una rettifica.
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
     or new.payment_type is distinct from old.payment_type
     or new.corrects_payment_id is distinct from old.corrects_payment_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'gw_payments: importo, tipo, prenotazione e incassante non sono modificabili, inserisci una rettifica';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Utilità
-- ---------------------------------------------------------------------------

-- Minuscole, senza accenti, spazi compressi (come normalizeText in format.ts).
create function public.gw_norm(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(btrim(regexp_replace(
    translate(lower(coalesce(p_value, '')),
              'àáâãäåèéêëìíîïòóôõöùúûüýÿñç',
              'aaaaaaeeeeiiiiooooouuuuyync'),
    '\s+', ' ', 'g')), '');
$$;

-- Chiave nome + cognome del libro soci: parole normalizzate e ordinate,
-- almeno due (come normalizeMembershipNameKey del sito).
create function public.gw_name_key(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when coalesce(array_length(words, 1), 0) >= 2
             then array_to_string(array(select w from unnest(words) as w order by w), ' ')
         end
    from (select string_to_array(gw_norm(p_value), ' ') as words) s;
$$;

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
                'entered_as', bp.entered_as, 'match_status', bp.match_status,
                'possible_duplicate_person_id', bp.possible_duplicate_person_id,
                'added_at', bp.added_at, 'removed_at', bp.removed_at)
              order by bp.added_at)
         from gw_booking_participants bp
        where bp.booking_id = b.id),
      '[]'::jsonb))
  from gw_bookings b
  where b.id = p_booking_id;
$$;

-- Persona nuova dal testo di Ale: una parola → nickname; email → email (con
-- nickname = parte prima della @, perché serve nome o nickname); più parole →
-- nome + cognome.
create function public.gw_create_person_from_text(p_operator_id uuid, p_text text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_text text := regexp_replace(gw_clean(p_text), '\s+', ' ', 'g');
  v_words text[];
begin
  if v_text is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Scrivi il nome, il nickname o l''email.';
  end if;

  if position('@' in v_text) > 0 then
    return gw_create_person(p_operator_id, jsonb_build_object(
      'email', lower(replace(v_text, ' ', '')),
      'nickname', coalesce(gw_clean(split_part(v_text, '@', 1)), v_text)));
  end if;

  v_words := string_to_array(v_text, ' ');
  if array_length(v_words, 1) = 1 then
    return gw_create_person(p_operator_id, jsonb_build_object('nickname', v_text));
  end if;
  return gw_create_person(p_operator_id, jsonb_build_object(
    'first_name', v_words[1],
    'last_name', array_to_string(v_words[2:], ' ')));
end;
$$;

-- Socio del libro soci (sola lettura) → persona del gestionale: si copiano
-- SOLO nome, cognome ed email (D11). Se il socio è già collegato a una sola
-- persona del gestionale, si usa quella.
create function public.gw_person_from_member(p_operator_id uuid, p_member_id uuid, p_fallback_text text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_member record;
  v_linked uuid[];
begin
  select m.id, m.first_name, m.last_name, m.email
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

-- Rimuove una persona creata in automatico, se non è usata da nessuna parte.
create function public.gw_remove_person_if_unused(p_operator_id uuid, p_person_id uuid)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_person gw_people;
begin
  select * into v_person from gw_people where id = p_person_id for update;
  if not found then
    return false;
  end if;
  if exists (select 1 from gw_booking_participants where person_id = p_person_id or possible_duplicate_person_id = p_person_id)
     or exists (select 1 from gw_membership_overrides where person_id = p_person_id)
     or exists (select 1 from gw_people where merged_into = p_person_id) then
    return false;
  end if;

  delete from gw_people where id = p_person_id;
  perform gw_audit(p_operator_id, 'person', p_person_id, 'delete', to_jsonb(v_person),
                   jsonb_build_object('motivo', 'persona creata in automatico non più usata'));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- D20 — Abbinamento automatico
-- ---------------------------------------------------------------------------
-- p_exclude: persone già scelte nella stessa prenotazione (la coppia).
create function public.gw_match_entered_person(
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

-- ---------------------------------------------------------------------------
-- D21 — Stato automatico dai pagamenti
-- ---------------------------------------------------------------------------
create function public.gw_apply_auto_status(p_operator_id uuid, p_booking_id uuid)
returns public.gw_booking_status
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_booking gw_bookings;
  v_paid bigint;
  v_new gw_booking_status;
begin
  select * into v_booking from gw_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  -- Lista d'attesa e cancellato non cambiano mai da soli.
  if v_booking.status not in ('interessato', 'prenotato', 'acconto', 'saldato') then
    return v_booking.status;
  end if;

  select coalesce(sum(amount_cents), 0) into v_paid from gw_payments where booking_id = p_booking_id;
  v_new := v_booking.status;

  if v_paid > 0 and v_booking.agreed_fee_cents is not null then
    v_new := case when v_paid >= v_booking.agreed_fee_cents then 'saldato' else 'acconto' end;
  elsif v_paid > 0 then
    -- Quota non definita: si sa solo che qualcosa è stato pagato.
    if v_booking.status in ('interessato', 'prenotato') then
      v_new := 'acconto';
    end if;
  elsif v_booking.status in ('acconto', 'saldato') then
    v_new := 'prenotato';
  end if;

  if v_new is distinct from v_booking.status then
    update gw_bookings set status = v_new, version = version + 1 where id = p_booking_id;
    perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update',
                     jsonb_build_object('status', v_booking.status),
                     jsonb_build_object('status', v_new, 'nota', 'aggiornato dal pagamento', 'pagato_cents', v_paid));
  end if;
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- D19/D20 — Prenotazioni
-- ---------------------------------------------------------------------------

-- Aggiunta rapida degli admin (Fase 2b): ora la prenotazione nasce con la
-- quota standard del workshop (D19) se non ne è indicata un'altra, e
-- entered_as è il nome visualizzato (gw_admin_entry_label).
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
  v_workshop gw_workshops;
  v_booking_id uuid;
  v_person_id uuid;
  v_item jsonb;
  v_person_ids uuid[] := '{}';
  v_fee bigint;
begin
  select * into v_workshop from gw_workshops where id = p_workshop_id;
  if not found then
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

  v_fee := coalesce(p_agreed_fee_cents, v_workshop.default_fee_cents);

  insert into gw_bookings (workshop_id, status, agreed_fee_cents, fee_custom, notes, created_by)
  values (p_workshop_id, coalesce(p_status, 'interessato'), v_fee,
          v_fee is distinct from v_workshop.default_fee_cents and v_fee is not null,
          gw_clean(p_notes), p_operator_id)
  returning id into v_booking_id;

  insert into gw_booking_participants (booking_id, workshop_id, person_id, is_primary, entered_as)
  select v_booking_id, p_workshop_id, ids.person_id, ids.ord = 1, gw_admin_entry_label(ids.person_id)
    from unnest(v_person_ids) with ordinality as ids(person_id, ord);

  perform gw_audit(p_operator_id, 'booking', v_booking_id, 'insert', null, gw_booking_snapshot(v_booking_id));
  return v_booking_id;
end;
$$;

-- Partner aggiunto da un admin: entered_as = nome visualizzato.
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
    insert into gw_booking_participants (booking_id, workshop_id, person_id, is_primary, entered_as)
    values (p_booking_id, v_booking.workshop_id, v_add_person_id, false, gw_admin_entry_label(v_add_person_id));
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

-- Separa: il partner porta con sé il testo scritto e lo stato dell'abbinamento.
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

  insert into gw_booking_participants (
    booking_id, workshop_id, person_id, attendance, is_primary,
    entered_as, match_status, possible_duplicate_person_id
  ) values (
    v_new_id, v_booking.workshop_id, v_participant.person_id, v_participant.attendance, true,
    v_participant.entered_as, v_participant.match_status, v_participant.possible_duplicate_person_id
  );

  update gw_bookings set version = version + 1 where id = p_booking_id;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update', v_before, gw_booking_snapshot(p_booking_id));
  perform gw_audit(p_operator_id, 'booking', v_new_id, 'insert', null, gw_booking_snapshot(v_new_id));
  return v_new_id;
end;
$$;

-- Schermata "Aggiungi" di Ale (D20): uno o due testi liberi, abbinamento
-- automatico invisibile, quota standard se non indicata (D19).
create function public.gw_create_booking_entered(
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

  insert into gw_bookings (workshop_id, status, agreed_fee_cents, fee_custom, notes, created_by)
  values (p_workshop_id, coalesce(p_status, 'prenotato'), v_fee,
          v_fee is distinct from v_workshop.default_fee_cents,
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

-- Riga aperta del tab Iscrizioni: stato, note, fattura e quota. Se la quota
-- cambia (e lo stato non è stato cambiato a mano nello stesso salvataggio),
-- si applica lo stato automatico (D21).
create function public.gw_update_registration(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_status public.gw_booking_status,
  p_notes text,
  p_invoice_status public.gw_invoice_status,
  p_fee_cents bigint
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_bookings;
  v_after gw_bookings;
  v_default bigint;
  v_fee_changed boolean;
begin
  select * into v_before from gw_bookings where id = p_booking_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_bookings', p_booking_id);
  end if;
  if p_fee_cents is not null and p_fee_cents < 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Quota non valida.';
  end if;

  select default_fee_cents into v_default from gw_workshops where id = v_before.workshop_id;
  v_fee_changed := p_fee_cents is distinct from v_before.agreed_fee_cents;

  update gw_bookings
     set status = p_status,
         notes = gw_clean(p_notes),
         invoice_status = coalesce(p_invoice_status, invoice_status),
         agreed_fee_cents = p_fee_cents,
         fee_custom = case
                        when v_fee_changed then p_fee_cents is not null and p_fee_cents is distinct from v_default
                        else fee_custom
                      end,
         version = version + 1
   where id = p_booking_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update', to_jsonb(v_before), to_jsonb(v_after));

  if v_fee_changed and p_status = v_before.status then
    perform gw_apply_auto_status(p_operator_id, p_booking_id);
  end if;

  return (select version from gw_bookings where id = p_booking_id);
end;
$$;

-- D19: applica la quota standard alle prenotazioni non cancellate e non
-- dedicate con la quota precedente ('precedente') o senza quota
-- ('senza_quota'). p_expected = il numero mostrato nella conferma.
create function public.gw_apply_standard_fee(
  p_operator_id uuid,
  p_workshop_id uuid,
  p_scope text,
  p_expected integer
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_fee bigint;
  v_ids uuid[];
  v_id uuid;
  v_before bigint;
begin
  select default_fee_cents into v_fee from gw_workshops where id = p_workshop_id for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_fee is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Il workshop non ha una quota standard.';
  end if;
  if p_scope not in ('precedente', 'senza_quota') then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Operazione non valida.';
  end if;

  select array_agg(b.id order by b.created_at) into v_ids
    from gw_bookings b
   where b.workshop_id = p_workshop_id
     and b.status <> 'cancellato'
     and not b.fee_custom
     and case
           when p_scope = 'precedente' then b.agreed_fee_cents is not null and b.agreed_fee_cents <> v_fee
           else b.agreed_fee_cents is null
         end;

  if coalesce(array_length(v_ids, 1), 0) <> p_expected then
    raise exception 'gw_conflict' using errcode = 'GW409';
  end if;

  foreach v_id in array coalesce(v_ids, '{}') loop
    select agreed_fee_cents into v_before from gw_bookings where id = v_id for update;
    update gw_bookings set agreed_fee_cents = v_fee, version = version + 1 where id = v_id;
    perform gw_audit(p_operator_id, 'booking', v_id, 'update',
                     jsonb_build_object('agreed_fee_cents', v_before),
                     jsonb_build_object('agreed_fee_cents', v_fee, 'nota', 'quota standard applicata'));
    perform gw_apply_auto_status(p_operator_id, v_id);
  end loop;

  return p_expected;
end;
$$;

-- ---------------------------------------------------------------------------
-- D20 — Conferma e correzione dell'abbinamento (solo admin, lato server)
-- ---------------------------------------------------------------------------
create function public.gw_lock_participant(p_booking_id uuid, p_version integer, p_participant_id uuid)
returns gw_booking_participants
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_participant gw_booking_participants;
begin
  perform 1 from gw_bookings where id = p_booking_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_bookings', p_booking_id);
  end if;
  select * into v_participant
    from gw_booking_participants
   where id = p_participant_id and booking_id = p_booking_id and removed_at is null
   for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  return v_participant;
end;
$$;

create function public.gw_finish_match_change(p_operator_id uuid, p_booking_id uuid, p_before jsonb)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_version integer;
begin
  update gw_bookings set version = version + 1 where id = p_booking_id returning version into v_version;
  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update', p_before, gw_booking_snapshot(p_booking_id));
  return v_version;
end;
$$;

-- "Conferma": l'abbinamento automatico è giusto.
create function public.gw_confirm_match(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_participant_id uuid
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_participant gw_booking_participants;
  v_before jsonb := gw_booking_snapshot(p_booking_id);
begin
  v_participant := gw_lock_participant(p_booking_id, p_version, p_participant_id);
  if v_participant.match_status <> 'automatico' then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Questa persona non è abbinata automaticamente.';
  end if;

  update gw_booking_participants
     set match_status = 'confermato', auto_created_person = false, version = version + 1
   where id = p_participant_id;
  return gw_finish_match_change(p_operator_id, p_booking_id, v_before);
end;
$$;

-- "Non è questa persona": scollega, persona nuova dal testo, da abbinare.
create function public.gw_reject_match(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_participant_id uuid
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_participant gw_booking_participants;
  v_before jsonb := gw_booking_snapshot(p_booking_id);
  v_new uuid;
begin
  v_participant := gw_lock_participant(p_booking_id, p_version, p_participant_id);
  if v_participant.match_status <> 'automatico' or v_participant.entered_as is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Questa persona non è abbinata automaticamente.';
  end if;

  v_new := gw_create_person_from_text(p_operator_id, v_participant.entered_as);
  update gw_booking_participants
     set person_id = v_new, match_status = 'da_abbinare', auto_created_person = true, version = version + 1
   where id = p_participant_id;

  if v_participant.auto_created_person then
    perform gw_remove_person_if_unused(p_operator_id, v_participant.person_id);
  end if;
  return gw_finish_match_change(p_operator_id, p_booking_id, v_before);
end;
$$;

-- Riga "da abbinare":
--   'crea_nuova'   tiene la persona creata dal testo (confermata)
--   'collega'      collega a una persona esistente (p_target = gw_people.id)
--   'collega_socio' collega a un socio del libro soci (p_target = association_members.id)
--   'unisci'       collega a una persona esistente e segna la persona creata
--                  dal testo come unita a quella (copiando l'email se manca)
create function public.gw_resolve_match(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_participant_id uuid,
  p_action text,
  p_target uuid
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_participant gw_booking_participants;
  v_before jsonb := gw_booking_snapshot(p_booking_id);
  v_old gw_people;
  v_target gw_people;
  v_target_id uuid;
begin
  v_participant := gw_lock_participant(p_booking_id, p_version, p_participant_id);
  if v_participant.match_status <> 'da_abbinare' then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Questa persona non è da abbinare.';
  end if;

  if p_action = 'crea_nuova' then
    update gw_booking_participants
       set match_status = 'confermato', auto_created_person = false, version = version + 1
     where id = p_participant_id;
    return gw_finish_match_change(p_operator_id, p_booking_id, v_before);
  end if;

  if p_action not in ('collega', 'collega_socio', 'unisci') or p_target is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Operazione non valida.';
  end if;

  v_target_id := case
                   when p_action = 'collega_socio' then gw_person_from_member(p_operator_id, p_target, v_participant.entered_as)
                   else p_target
                 end;

  if v_target_id <> v_participant.person_id then
    perform gw_assert_can_enroll(v_participant.workshop_id, v_target_id);
  end if;

  update gw_booking_participants
     set person_id = v_target_id, match_status = 'confermato', auto_created_person = false,
         possible_duplicate_person_id = null, version = version + 1
   where id = p_participant_id;

  if v_target_id <> v_participant.person_id and v_participant.auto_created_person then
    if p_action = 'unisci' then
      select * into v_old from gw_people where id = v_participant.person_id for update;
      select * into v_target from gw_people where id = v_target_id for update;
      if v_target.email is null and v_old.email is not null then
        update gw_people set email = v_old.email, version = version + 1 where id = v_target_id;
      end if;
      update gw_people set merged_into = v_target_id, version = version + 1 where id = v_old.id;
      perform gw_audit(p_operator_id, 'person', v_target_id, 'merge',
                       jsonb_build_object('primary', to_jsonb(v_target), 'secondary', to_jsonb(v_old)),
                       jsonb_build_object('merged_person_id', v_old.id, 'origine', 'abbinamento'));
    else
      perform gw_remove_person_if_unused(p_operator_id, v_participant.person_id);
    end if;
  end if;

  return gw_finish_match_change(p_operator_id, p_booking_id, v_before);
end;
$$;

-- ---------------------------------------------------------------------------
-- D21 — Pagamenti (append-only)
-- ---------------------------------------------------------------------------
create function public.gw_insert_payment(
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
  if p_paid_on is null or p_received_by is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Data e incassato da sono obbligatori.';
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

-- "+ Pagamento" e "Rimborso". p_data:
--   kind ('pagamento' | 'rimborso'), amount_cents (> 0: per il rimborso il
--   segno lo mette la funzione), payment_type, method, paid_on, received_by,
--   description
create function public.gw_add_payment(p_operator_id uuid, p_booking_id uuid, p_data jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_kind gw_payment_kind := coalesce(gw_clean(p_data->>'kind'), 'pagamento')::gw_payment_kind;
  v_amount bigint := (gw_clean(p_data->>'amount_cents'))::bigint;
  v_id uuid;
begin
  perform 1 from gw_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_kind not in ('pagamento', 'rimborso') then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Movimento non valido.';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Importo non valido.';
  end if;

  v_id := gw_insert_payment(
    p_operator_id, p_booking_id, v_kind,
    case when v_kind = 'rimborso' then -v_amount else v_amount end,
    case when v_kind = 'rimborso' then 'altro' else (gw_clean(p_data->>'payment_type'))::gw_payment_type end,
    (gw_clean(p_data->>'method'))::gw_payment_method,
    (gw_clean(p_data->>'paid_on'))::date,
    (gw_clean(p_data->>'received_by'))::gw_party,
    p_data->>'description',
    null,
    'manuale'
  );

  perform gw_apply_auto_status(p_operator_id, p_booking_id);
  return v_id;
end;
$$;

-- "Correggi": rettifica di importo opposto al netto del movimento (collegata
-- con corrects_payment_id) e, se indicato, il movimento giusto (p_replacement,
-- stesso formato di gw_add_payment senza kind), nella stessa transazione.
create function public.gw_correct_payment(
  p_operator_id uuid,
  p_payment_id uuid,
  p_replacement jsonb,
  p_description text
)
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
  select * into v_original from gw_payments where id = p_payment_id;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  perform 1 from gw_bookings where id = v_original.booking_id for update;
  if v_original.kind = 'rettifica' then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Una rettifica non si corregge: correggi il movimento originale.';
  end if;

  select v_original.amount_cents + coalesce(sum(amount_cents), 0) into v_net
    from gw_payments where corrects_payment_id = p_payment_id;
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
      coalesce((gw_clean(p_replacement->>'paid_on'))::date, v_original.paid_on),
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

-- ---------------------------------------------------------------------------
-- Box di testo di Ale: tutto o niente (sezione 6)
-- ---------------------------------------------------------------------------
-- p_rows: array di righe confermate dall'anteprima:
--   { "booking_id": uuid|null, "booking_version": int|null,
--     "people": ["Testo1", "Testo2"?], "status": "...", "fee_cents": int|null,
--     "invoice_status": "...", "notes": "...",
--     "payments": [{ "amount_cents": int, "method": "...", "payment_type": "..." }] }
-- Con booking_id si aggiungono SOLO i pagamenti (aggiorna l'iscrizione esistente).
create function public.gw_import_roster(
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
        p_paid_on, p_received_by, 'importazione testo', null, 'importazione testo'
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

-- ---------------------------------------------------------------------------
-- D18 — Script gw:set-role
-- ---------------------------------------------------------------------------
create function public.gw_set_operator_role(
  p_operator_id uuid,
  p_display_name text,
  p_role public.gw_operator_role
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_old gw_operator_role;
begin
  select id, role into v_id, v_old
    from gw_operators
   where lower(btrim(display_name)) = lower(btrim(p_display_name))
   for update;
  if v_id is null then
    raise exception 'gw_not_found' using errcode = 'GW404', detail = format('Operatore "%s" non trovato.', p_display_name);
  end if;

  update gw_operators set role = p_role where id = v_id;
  perform gw_audit(p_operator_id, 'operator', v_id, 'update',
                   jsonb_build_object('role', v_old), jsonb_build_object('role', p_role));
  return v_id;
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
    'public.gw_payments_guard()',
    'public.gw_norm(text)',
    'public.gw_name_key(text)',
    'public.gw_booking_snapshot(uuid)',
    'public.gw_create_person_from_text(uuid, text)',
    'public.gw_person_from_member(uuid, uuid, text)',
    'public.gw_remove_person_if_unused(uuid, uuid)',
    'public.gw_match_entered_person(uuid, uuid, text, uuid[])',
    'public.gw_apply_auto_status(uuid, uuid)',
    'public.gw_admin_entry_label(uuid)',
    'public.gw_create_booking(uuid, uuid, jsonb, public.gw_booking_status, bigint, text)',
    'public.gw_set_partner(uuid, uuid, integer, uuid, jsonb)',
    'public.gw_split_participant(uuid, uuid, integer, uuid)',
    'public.gw_create_booking_entered(uuid, uuid, jsonb, public.gw_booking_status, bigint, text)',
    'public.gw_update_registration(uuid, uuid, integer, public.gw_booking_status, text, public.gw_invoice_status, bigint)',
    'public.gw_apply_standard_fee(uuid, uuid, text, integer)',
    'public.gw_lock_participant(uuid, integer, uuid)',
    'public.gw_finish_match_change(uuid, uuid, jsonb)',
    'public.gw_confirm_match(uuid, uuid, integer, uuid)',
    'public.gw_reject_match(uuid, uuid, integer, uuid)',
    'public.gw_resolve_match(uuid, uuid, integer, uuid, text, uuid)',
    'public.gw_insert_payment(uuid, uuid, public.gw_payment_kind, bigint, public.gw_payment_type, public.gw_payment_method, date, public.gw_party, text, uuid, text)',
    'public.gw_add_payment(uuid, uuid, jsonb)',
    'public.gw_correct_payment(uuid, uuid, jsonb, text)',
    'public.gw_import_roster(uuid, uuid, date, public.gw_party, jsonb)',
    'public.gw_set_operator_role(uuid, text, public.gw_operator_role)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    if f <> 'public.gw_payments_guard()' then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end;
$$;

-- PostgREST: ricarica lo schema per vedere colonne e funzioni nuove.
notify pgrst, 'reload schema';

commit;
