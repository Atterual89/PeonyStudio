-- Gestionale Workshop — eliminazioni (Fase 4b, D22, docs/gestionale/00-contesto.md sezione 10)
--
-- Tocca SOLO oggetti gw_. Rollback: 020_gw_eliminazioni.down.sql
--
--   - deleted_at / deleted_by su workshop, persone, prenotazioni, partecipanti,
--     pagamenti, spese, trasferimenti, riporti: eliminazione logica.
--   - Guardie: una riga eliminata non si modifica più (solo il ripristino) e
--     non si aggiunge nulla a un workshop, una prenotazione o una persona
--     eliminati. gw_payments: l'unico UPDATE consentito è deleted_at/deleted_by.
--   - Indice "una iscrizione attiva per persona e workshop" senza le eliminate.
--   - Le funzioni che leggono o aggiornano in blocco ignorano le righe eliminate.
--   - gw_delete_payment / _booking / _person / _workshop (nuove),
--     gw_delete_expense / _transfer / _carryover (ora logiche),
--     gw_restore_deleted (Annulla).

begin;

do $$
begin
  if to_regprocedure('public.gw_create_registration(uuid, uuid, jsonb, public.gw_booking_status, bigint, text, jsonb)') is null then
    raise exception 'Migrazione 020 interrotta: applica prima 019_gw_pagamenti_stato.sql';
  end if;
  if to_regprocedure('public.gw_restore_deleted(uuid, text, uuid)') is not null then
    raise exception 'Migrazione 020 interrotta: sembra già applicata (gw_restore_deleted esiste)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Colonne
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'gw_workshops', 'gw_people', 'gw_bookings', 'gw_booking_participants',
    'gw_payments', 'gw_expenses', 'gw_transfers', 'gw_carryovers'
  ]
  loop
    execute format('alter table public.%I add column deleted_at timestamptz', t);
    execute format('alter table public.%I add column deleted_by uuid references public.gw_operators (id)', t);
    execute format('alter table public.%I add constraint %I check (deleted_by is null or deleted_at is not null)',
                   t, t || '_deleted_check');
  end loop;
end;
$$;

-- Una persona non può avere due iscrizioni attive allo stesso workshop: le
-- iscrizioni eliminate non contano (la persona si può iscrivere di nuovo).
drop index public.gw_booking_participants_active_key;
create unique index gw_booking_participants_active_key
  on public.gw_booking_participants (workshop_id, person_id)
  where removed_at is null and deleted_at is null;

create index gw_payments_deleted_idx on public.gw_payments (booking_id, deleted_at) where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- Guardie
-- ---------------------------------------------------------------------------

-- Una riga eliminata non si modifica: per il resto del gestionale non esiste
-- più (GW404). Unico UPDATE ammesso: il ripristino (deleted_at → null).
create function public.gw_deleted_row_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is not null and new.deleted_at is not null then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  return new;
end;
$$;

-- Niente di nuovo dentro un workshop, una prenotazione o una persona
-- eliminati (anche spostando una riga con UPDATE della chiave).
create function public.gw_live_parents_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_key text;
  v_table text;
  v_dead boolean;
begin
  foreach v_key in array case tg_table_name
      when 'gw_bookings' then array['workshop_id']
      when 'gw_booking_participants' then array['booking_id', 'person_id']
      when 'gw_payments' then array['booking_id']
      when 'gw_expenses' then array['workshop_id']
      when 'gw_transfers' then array['workshop_id']
      when 'gw_carryovers' then array['origin_workshop_id', 'destination_workshop_id']
      when 'gw_membership_overrides' then array['person_id']
      else array[]::text[]
    end
  loop
    if v_new->>v_key is null or (v_new->>v_key) is not distinct from (v_old->>v_key) then
      continue;
    end if;
    v_table := case
      when v_key like '%workshop_id' then 'gw_workshops'
      when v_key = 'booking_id' then 'gw_bookings'
      else 'gw_people'
    end;
    execute format('select exists (select 1 from public.%I where id = $1 and deleted_at is not null)', v_table)
      into v_dead using (v_new->>v_key)::uuid;
    if v_dead then
      raise exception 'gw_not_found' using errcode = 'GW404';
    end if;
  end loop;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'gw_workshops', 'gw_people', 'gw_bookings', 'gw_booking_participants',
    'gw_expenses', 'gw_transfers', 'gw_carryovers'
  ]
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.gw_deleted_row_guard()',
                   t || '_deleted_guard', t);
  end loop;
  foreach t in array array[
    'gw_bookings', 'gw_booking_participants', 'gw_payments', 'gw_expenses',
    'gw_transfers', 'gw_carryovers', 'gw_membership_overrides'
  ]
  loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.gw_live_parents_guard()',
                   t || '_live_parents', t);
  end loop;
end;
$$;

-- gw_payments (010/013): mai DELETE; l'unico UPDATE consentito è
-- l'eliminazione logica o il ripristino (deleted_at, deleted_by). Per
-- correggere un importo si inserisce una rettifica.
create or replace function public.gw_payments_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'gw_payments: i pagamenti non si cancellano, inserisci una rettifica';
  end if;

  if old.deleted_at is not null and new.deleted_at is not null then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;

  if (to_jsonb(new) - 'deleted_at' - 'deleted_by' - 'updated_at')
     is distinct from (to_jsonb(old) - 'deleted_at' - 'deleted_by' - 'updated_at') then
    raise exception 'gw_payments: si possono solo eliminare o ripristinare (deleted_at, deleted_by); per correggere inserisci una rettifica';
  end if;

  return new;
end;
$$;

-- Riga eliminata = non trovata (prima risultava "modificata da un altro operatore").
create or replace function public.gw_raise_missing_or_conflict(p_table regclass, p_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
begin
  execute format('select exists (select 1 from %s t where t.id = $1 and (to_jsonb(t)->>''deleted_at'') is null)', p_table)
    into v_exists using p_id;

  if v_exists then
    raise exception 'gw_conflict' using errcode = 'GW409';
  end if;
  raise exception 'gw_not_found' using errcode = 'GW404';
end;
$$;

-- ---------------------------------------------------------------------------
-- Funzioni esistenti: le righe eliminate non contano
-- ---------------------------------------------------------------------------

-- Come in 013: pagato senza i movimenti eliminati.
create or replace function public.gw_apply_auto_status(p_operator_id uuid, p_booking_id uuid)
returns public.gw_booking_status
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_booking gw_bookings;
  v_paid bigint;
  v_new gw_booking_status;
begin
  select * into v_booking from gw_bookings where id = p_booking_id and deleted_at is null for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  -- Lista d'attesa e cancellato non cambiano mai da soli.
  if v_booking.status not in ('interessato', 'prenotato', 'acconto', 'saldato') then
    return v_booking.status;
  end if;

  select coalesce(sum(amount_cents), 0) into v_paid
    from gw_payments where booking_id = p_booking_id and deleted_at is null;
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

-- Come in 013: non si corregge un movimento eliminato; il netto ignora le
-- rettifiche eliminate.
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

-- Come in 015: solo le prenotazioni non eliminate seguono la quota.
create or replace function public.gw_sync_workshop_fee(p_operator_id uuid, p_workshop_id uuid)
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
       and deleted_at is null
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

-- Come in 011: persona eliminata = non trovata; le iscrizioni eliminate non contano.
create or replace function public.gw_assert_can_enroll(p_workshop_id uuid, p_person_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_person gw_people;
begin
  select * into v_person from gw_people where id = p_person_id and deleted_at is null;
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
       and deleted_at is null
  ) then
    raise exception 'gw_already_enrolled' using errcode = 'GWDUP',
      detail = coalesce(v_person.nickname, btrim(concat_ws(' ', v_person.first_name, v_person.last_name)));
  end if;
end;
$$;

-- Come in 014/016: l'abbinamento automatico non propone persone eliminate e
-- non considera le iscrizioni eliminate.
create or replace function public.gw_match_entered_person(p_operator_id uuid, p_workshop_id uuid, p_text text, p_exclude uuid[] default '{}'::uuid[])
returns table(out_person_id uuid, out_match_status public.gw_match_status, out_auto_created boolean, out_duplicate_of uuid)
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
  v_member_email text;
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
     and p.deleted_at is null
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
      -- 016: collegata per id (validazione manuale) o per email (libro soci / modulo).
      v_member_email := gw_member_email(v_member_id);
      select array_agg(p.id) into v_linked
        from gw_people p
       where p.merged_into is null
         and p.deleted_at is null
         and (p.association_member_id = any (v_member_rows)
              or (v_member_email is not null and p.membership_email = v_member_email));

      if coalesce(array_length(v_linked, 1), 0) = 1 then
        v_candidate := v_linked[1];
        -- 014: la persona già collegata prende i campi vuoti dal libro soci.
        perform gw_fill_person_from_member_row(p_operator_id, v_candidate, v_member_id);
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
                   where workshop_id = p_workshop_id and person_id = v_candidate
                     and removed_at is null and deleted_at is null) then
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

-- Come in 016: "già collegato" solo tra le persone non eliminate.
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
   where p.merged_into is null
     and p.deleted_at is null
     and (p.association_member_id = p_member_id
          or (v_member.email is not null and p.membership_email = v_member.email));
  if coalesce(array_length(v_linked, 1), 0) = 1 then
    perform gw_fill_person_from_member_row(p_operator_id, v_linked[1], p_member_id);
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

create or replace function public.gw_person_from_membership(p_operator_id uuid, p_member_id uuid, p_email text, p_first_name text, p_last_name text, p_fallback_text text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(gw_clean(p_email));
  v_linked uuid[];
begin
  if p_member_id is not null then
    return gw_person_from_member(p_operator_id, p_member_id, p_fallback_text);
  end if;

  if v_email is not null then
    select array_agg(p.id) into v_linked
      from gw_people p
     where p.merged_into is null and p.deleted_at is null and p.membership_email = v_email;
    if coalesce(array_length(v_linked, 1), 0) = 1 then
      perform gw_fill_person_fields(p_operator_id, v_linked[1], p_first_name, p_last_name, v_email);
      return v_linked[1];
    end if;
  end if;

  return gw_create_person(p_operator_id, jsonb_build_object(
    'first_name', p_first_name,
    'last_name', p_last_name,
    'email', v_email,
    'membership_email', v_email,
    'nickname', case when gw_clean(p_first_name) is null then gw_clean(p_fallback_text) end));
end;
$$;

-- Come in 011: conflitti e spostamenti solo sulle iscrizioni non eliminate
-- (quelle eliminate restano collegate alla persona unita, per lo storico).
create or replace function public.gw_merge_people(p_operator_id uuid, p_primary_id uuid, p_primary_version integer, p_secondary_id uuid, p_secondary_version integer, p_values jsonb)
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

  select * into v_primary from gw_people where id = p_primary_id and version = p_primary_version and deleted_at is null for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_people', p_primary_id);
  end if;
  select * into v_secondary from gw_people where id = p_secondary_id and version = p_secondary_version and deleted_at is null for update;
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
     and b.deleted_at is null
    join gw_workshops w on w.id = a.workshop_id
   where a.person_id = p_primary_id
     and a.removed_at is null
     and a.deleted_at is null;

  if v_conflict is not null then
    raise exception 'gw_merge_blocked' using errcode = 'GWMRG', detail = v_conflict;
  end if;

  update gw_booking_participants set person_id = p_primary_id where person_id = p_secondary_id and deleted_at is null;

  update gw_membership_overrides o
     set person_id = p_primary_id
   where o.person_id = p_secondary_id
     and not exists (
       select 1 from gw_membership_overrides p
        where p.person_id = p_primary_id and p.year = o.year
     );

  -- Persone unite in precedenza nella secondaria puntano ora alla principale.
  update gw_people set merged_into = p_primary_id where merged_into = p_secondary_id and deleted_at is null;

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

-- Come in 017: solo le iscrizioni non eliminate.
create or replace function public.gw_confirm_person_matches(p_operator_id uuid, p_person_id uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_booking_id uuid;
  v_before jsonb;
  v_count integer := 0;
begin
  for v_booking_id in
    select distinct booking_id from gw_booking_participants
     where person_id = p_person_id and removed_at is null and deleted_at is null and match_status <> 'confermato'
  loop
    v_before := gw_booking_snapshot(v_booking_id);
    update gw_booking_participants
       set match_status = 'confermato', auto_created_person = false, version = version + 1
     where booking_id = v_booking_id and person_id = p_person_id
       and removed_at is null and deleted_at is null and match_status <> 'confermato';
    perform gw_finish_match_change(p_operator_id, v_booking_id, v_before);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Eliminazioni
-- ---------------------------------------------------------------------------

-- Pagamento (sempre). Un movimento "modificato" si elimina con tutta la sua
-- catena: le rettifiche che lo correggono e, all'indietro, la rettifica nata
-- nella stessa transazione (stesso created_at) con il movimento che
-- sostituiva, e così via. Il totale torna come se non fosse mai esistito.
create function public.gw_delete_payment(p_operator_id uuid, p_payment_id uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_payment gw_payments;
  v_net bigint;
  v_row gw_payments;
  v_count integer := 0;
begin
  select * into v_payment from gw_payments where id = p_payment_id and deleted_at is null;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  perform 1 from gw_bookings where id = v_payment.booking_id and deleted_at is null for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;

  if v_payment.kind = 'rettifica' and v_payment.corrects_payment_id is not null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Una rettifica non si elimina da sola: elimina il movimento che corregge.';
  end if;
  select v_payment.amount_cents + coalesce(sum(amount_cents), 0) into v_net
    from gw_payments where corrects_payment_id = p_payment_id and deleted_at is null;
  if v_net = 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Questo movimento è già stato annullato.';
  end if;

  for v_row in
    with recursive chain(id, created_at) as (
      select v_payment.id, v_payment.created_at
      union
      select o.id, o.created_at
        from chain c
        join gw_payments r
          on r.booking_id = v_payment.booking_id
         and r.kind = 'rettifica'
         and r.created_at = c.created_at
         and r.corrects_payment_id is not null
         and r.corrects_payment_id <> c.id
         and r.deleted_at is null
        join gw_payments o on o.id = r.corrects_payment_id and o.deleted_at is null and o.kind <> 'rettifica'
    )
    select p.* from gw_payments p
     where p.deleted_at is null
       and (p.id in (select id from chain) or p.corrects_payment_id in (select id from chain))
     order by p.created_at, p.id
  loop
    update gw_payments set deleted_at = now(), deleted_by = p_operator_id where id = v_row.id;
    perform gw_audit(p_operator_id, 'payment', v_row.id, 'delete', to_jsonb(v_row),
                     jsonb_build_object('eliminato', true, 'pagamento', p_payment_id));
    v_count := v_count + 1;
  end loop;

  perform gw_apply_auto_status(p_operator_id, v_payment.booking_id);
  return v_count;
end;
$$;

-- Iscrizione: solo senza soldi (pagato netto 0, anche per ciascuna parte;
-- i movimenti eliminati non contano). Con lei si eliminano i partecipanti e
-- gli eventuali movimenti a saldo zero.
create function public.gw_delete_booking(p_operator_id uuid, p_booking_id uuid, p_version integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_net bigint;
  v_party_net boolean;
begin
  perform 1 from gw_bookings where id = p_booking_id and version = p_version and deleted_at is null for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_bookings', p_booking_id);
  end if;

  select coalesce(sum(amount_cents), 0) into v_net
    from gw_payments where booking_id = p_booking_id and deleted_at is null;
  select exists (select 1 from gw_payments where booking_id = p_booking_id and deleted_at is null
                  group by received_by having sum(amount_cents) <> 0)
    into v_party_net;
  if v_net <> 0 then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = format('Ha %s%s%s € di pagamenti: eliminali o registra un rimborso prima.',
                      case when v_net < 0 then '-' else '' end,
                      abs(v_net) / 100,
                      case when abs(v_net) % 100 <> 0 then ',' || lpad((abs(v_net) % 100)::text, 2, '0') else '' end);
  end if;
  if v_party_net then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'I pagamenti e i rimborsi di questa iscrizione sono di parti diverse: eliminali prima.';
  end if;

  v_before := gw_booking_snapshot(p_booking_id) || jsonb_build_object(
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at)
                            from gw_payments p where p.booking_id = p_booking_id and p.deleted_at is null), '[]'::jsonb));

  update gw_payments set deleted_at = now(), deleted_by = p_operator_id
   where booking_id = p_booking_id and deleted_at is null;
  update gw_booking_participants set deleted_at = now(), deleted_by = p_operator_id
   where booking_id = p_booking_id and deleted_at is null;
  update gw_bookings set deleted_at = now(), deleted_by = p_operator_id where id = p_booking_id;

  perform gw_audit(p_operator_id, 'booking', p_booking_id, 'delete', v_before, jsonb_build_object('eliminato', true));
end;
$$;

-- Persona (solo admin, controllo nel server): solo senza iscrizioni attive.
-- Le iscrizioni eliminate (ed ex partner) restano collegate per lo storico.
create function public.gw_delete_person(p_operator_id uuid, p_person_id uuid, p_version integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_people;
  v_workshops text;
begin
  select * into v_before from gw_people where id = p_person_id and version = p_version and deleted_at is null for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_people', p_person_id);
  end if;

  select string_agg(distinct w.name, ', ')
    into v_workshops
    from gw_booking_participants bp
    join gw_workshops w on w.id = bp.workshop_id
   where bp.person_id = p_person_id
     and bp.removed_at is null
     and bp.deleted_at is null;
  if v_workshops is not null then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = format('È iscritta a: %s. Elimina prima le iscrizioni.', v_workshops);
  end if;

  update gw_people set deleted_at = now(), deleted_by = p_operator_id where id = p_person_id;
  perform gw_audit(p_operator_id, 'person', p_person_id, 'delete', to_jsonb(v_before), jsonb_build_object('eliminato', true));
end;
$$;

-- Workshop non collegato a Ticket Tailor (solo admin, controllo nel server),
-- confermato scrivendo il nome: con lui tutto ciò che contiene.
create function public.gw_delete_workshop(p_operator_id uuid, p_workshop_id uuid, p_version integer, p_confirm_name text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_workshops;
  v_contents jsonb;
begin
  select * into v_before from gw_workshops where id = p_workshop_id and version = p_version and deleted_at is null for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_workshops', p_workshop_id);
  end if;
  if v_before.event_id is not null then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'Il workshop arriva da Ticket Tailor: non si può eliminare.';
  end if;
  if lower(btrim(coalesce(p_confirm_name, ''))) <> lower(btrim(v_before.name)) then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'Scrivi il nome del workshop esattamente com''è per confermare.';
  end if;

  v_contents := jsonb_build_object(
    'iscrizioni', (select count(*) from gw_bookings where workshop_id = p_workshop_id and deleted_at is null),
    'pagamenti', (select count(*) from gw_payments p join gw_bookings b on b.id = p.booking_id
                   where b.workshop_id = p_workshop_id and p.deleted_at is null),
    'spese', (select count(*) from gw_expenses where workshop_id = p_workshop_id and deleted_at is null),
    'trasferimenti', (select count(*) from gw_transfers where workshop_id = p_workshop_id and deleted_at is null),
    'riporti', (select count(*) from gw_carryovers
                 where p_workshop_id in (origin_workshop_id, destination_workshop_id) and deleted_at is null));

  update gw_payments p set deleted_at = now(), deleted_by = p_operator_id
    from gw_bookings b
   where b.id = p.booking_id and b.workshop_id = p_workshop_id and p.deleted_at is null;
  update gw_booking_participants set deleted_at = now(), deleted_by = p_operator_id
   where workshop_id = p_workshop_id and deleted_at is null;
  update gw_bookings set deleted_at = now(), deleted_by = p_operator_id
   where workshop_id = p_workshop_id and deleted_at is null;
  update gw_expenses set deleted_at = now(), deleted_by = p_operator_id
   where workshop_id = p_workshop_id and deleted_at is null;
  update gw_transfers set deleted_at = now(), deleted_by = p_operator_id
   where workshop_id = p_workshop_id and deleted_at is null;
  -- Un riporto collegato a un workshop eliminato (in entrata o in uscita) va con lui.
  update gw_carryovers set deleted_at = now(), deleted_by = p_operator_id
   where p_workshop_id in (origin_workshop_id, destination_workshop_id) and deleted_at is null;
  update gw_workshops set deleted_at = now(), deleted_by = p_operator_id where id = p_workshop_id;

  perform gw_audit(p_operator_id, 'workshop', p_workshop_id, 'delete',
                   to_jsonb(v_before) - 'personal_tax_notes',
                   jsonb_build_object('eliminato', true, 'contenuto', v_contents));
end;
$$;

-- Spese, trasferimenti e riporti (018): ora eliminazione logica.
create or replace function public.gw_delete_expense(p_operator_id uuid, p_id uuid, p_version integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_expenses;
begin
  select * into v_before from gw_expenses where id = p_id and version = p_version and deleted_at is null for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_expenses', p_id);
  end if;

  update gw_expenses set deleted_at = now(), deleted_by = p_operator_id where id = p_id;
  perform gw_audit(p_operator_id, 'expense', p_id, 'delete', to_jsonb(v_before), jsonb_build_object('eliminato', true));
end;
$$;

create or replace function public.gw_delete_transfer(p_operator_id uuid, p_id uuid, p_version integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_transfers;
begin
  select * into v_before from gw_transfers where id = p_id and version = p_version and deleted_at is null for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_transfers', p_id);
  end if;

  update gw_transfers set deleted_at = now(), deleted_by = p_operator_id where id = p_id;
  perform gw_audit(p_operator_id, 'transfer', p_id, 'delete', to_jsonb(v_before), jsonb_build_object('eliminato', true));
end;
$$;

create or replace function public.gw_delete_carryover(p_operator_id uuid, p_id uuid, p_version integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_carryovers;
begin
  select * into v_before from gw_carryovers where id = p_id and version = p_version and deleted_at is null for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_carryovers', p_id);
  end if;

  update gw_carryovers set deleted_at = now(), deleted_by = p_operator_id where id = p_id;
  perform gw_audit(p_operator_id, 'carryover', p_id, 'delete', to_jsonb(v_before), jsonb_build_object('eliminato', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- Annulla (entro 10 secondi nell'interfaccia): ripristina esattamente ciò che
-- è stato eliminato insieme (stesso deleted_at). Solo chi ha eliminato ed
-- entro 10 minuti: dopo non c'è un cestino.
-- ---------------------------------------------------------------------------
create function public.gw_restore_deleted(p_operator_id uuid, p_entity text, p_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_table text;
  v_deleted_at timestamptz;
  v_deleted_by uuid;
  v_row jsonb;
  v_booking_id uuid;
  v_workshop_id uuid;
begin
  v_table := case p_entity
    when 'payment' then 'gw_payments'
    when 'booking' then 'gw_bookings'
    when 'person' then 'gw_people'
    when 'workshop' then 'gw_workshops'
    when 'expense' then 'gw_expenses'
    when 'transfer' then 'gw_transfers'
    when 'carryover' then 'gw_carryovers'
  end;
  if v_table is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Elemento non valido.';
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1 for update', v_table) into v_row using p_id;
  v_deleted_at := (v_row->>'deleted_at')::timestamptz;
  v_deleted_by := (v_row->>'deleted_by')::uuid;
  if v_row is null or v_deleted_at is null then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_deleted_by is distinct from p_operator_id or v_deleted_at < now() - interval '10 minutes' then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Non si può più annullare l''eliminazione.';
  end if;

  if p_entity = 'payment' then
    v_booking_id := (v_row->>'booking_id')::uuid;
    perform 1 from gw_bookings where id = v_booking_id and deleted_at is null for update;
    if not found then
      raise exception 'gw_invalid' using errcode = 'GW400', detail = 'L''iscrizione è stata eliminata: il pagamento non si può ripristinare.';
    end if;
    update gw_payments set deleted_at = null, deleted_by = null
     where booking_id = v_booking_id and deleted_at = v_deleted_at and deleted_by = v_deleted_by;
    perform gw_apply_auto_status(p_operator_id, v_booking_id);

  elsif p_entity = 'booking' then
    v_workshop_id := (v_row->>'workshop_id')::uuid;
    if exists (select 1 from gw_workshops where id = v_workshop_id and deleted_at is not null) then
      raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Il workshop è stato eliminato: l''iscrizione non si può ripristinare.';
    end if;
    if exists (select 1 from gw_booking_participants bp join gw_people p on p.id = bp.person_id
                where bp.booking_id = p_id and bp.deleted_at = v_deleted_at and p.deleted_at is not null) then
      raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Una persona dell''iscrizione è stata eliminata: non si può ripristinare.';
    end if;
    update gw_bookings set deleted_at = null, deleted_by = null where id = p_id;
    begin
      update gw_booking_participants set deleted_at = null, deleted_by = null
       where booking_id = p_id and deleted_at = v_deleted_at and deleted_by = v_deleted_by;
    exception when unique_violation then
      raise exception 'gw_invalid' using errcode = 'GW400',
        detail = 'La persona è già stata iscritta di nuovo a questo workshop: l''iscrizione non si può ripristinare.';
    end;
    update gw_payments set deleted_at = null, deleted_by = null
     where booking_id = p_id and deleted_at = v_deleted_at and deleted_by = v_deleted_by;

  elsif p_entity = 'workshop' then
    update gw_workshops set deleted_at = null, deleted_by = null where id = p_id;
    update gw_bookings set deleted_at = null, deleted_by = null
     where workshop_id = p_id and deleted_at = v_deleted_at and deleted_by = v_deleted_by;
    update gw_booking_participants set deleted_at = null, deleted_by = null
     where workshop_id = p_id and deleted_at = v_deleted_at and deleted_by = v_deleted_by;
    update gw_payments p set deleted_at = null, deleted_by = null
      from gw_bookings b
     where b.id = p.booking_id and b.workshop_id = p_id and p.deleted_at = v_deleted_at and p.deleted_by = v_deleted_by;
    update gw_expenses set deleted_at = null, deleted_by = null
     where workshop_id = p_id and deleted_at = v_deleted_at and deleted_by = v_deleted_by;
    update gw_transfers set deleted_at = null, deleted_by = null
     where workshop_id = p_id and deleted_at = v_deleted_at and deleted_by = v_deleted_by;
    update gw_carryovers c set deleted_at = null, deleted_by = null
     where p_id in (c.origin_workshop_id, c.destination_workshop_id)
       and c.deleted_at = v_deleted_at and c.deleted_by = v_deleted_by
       and not exists (select 1 from gw_workshops w
                        where w.id in (c.origin_workshop_id, c.destination_workshop_id) and w.deleted_at is not null);

  elsif p_entity = 'carryover' then
    if exists (select 1 from gw_workshops
                where id in ((v_row->>'origin_workshop_id')::uuid, (v_row->>'destination_workshop_id')::uuid)
                  and deleted_at is not null) then
      raise exception 'gw_not_found' using errcode = 'GW404';
    end if;
    update gw_carryovers set deleted_at = null, deleted_by = null where id = p_id;

  else
    -- Persona, spesa, trasferimento.
    if v_row ? 'workshop_id'
       and exists (select 1 from gw_workshops where id = (v_row->>'workshop_id')::uuid and deleted_at is not null) then
      raise exception 'gw_not_found' using errcode = 'GW404';
    end if;
    execute format('update public.%I set deleted_at = null, deleted_by = null where id = $1', v_table) using p_id;
  end if;

  perform gw_audit(p_operator_id, p_entity, p_id, 'update',
                   jsonb_build_object('deleted_at', v_deleted_at),
                   jsonb_build_object('ripristinato', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- Sicurezza: eseguibili solo dalla service role
-- ---------------------------------------------------------------------------
revoke execute on function public.gw_deleted_row_guard() from public, anon, authenticated;
revoke execute on function public.gw_live_parents_guard() from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.gw_delete_payment(uuid, uuid)',
    'public.gw_delete_booking(uuid, uuid, integer)',
    'public.gw_delete_person(uuid, uuid, integer)',
    'public.gw_delete_workshop(uuid, uuid, integer, text)',
    'public.gw_restore_deleted(uuid, text, uuid)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;

-- PostgREST: ricarica lo schema per vedere colonne e funzioni nuove.
notify pgrst, 'reload schema';
