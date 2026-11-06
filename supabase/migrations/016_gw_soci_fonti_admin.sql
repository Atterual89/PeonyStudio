-- Gestionale Workshop — stato socio dalle fonti della pagina admin (D11
-- rivista, docs/gestionale/00-contesto.md sez. 4.3)
--
-- Tocca SOLO oggetti gw_. Legge (mai scrive) `association_members`.
-- Rollback: 016_gw_soci_fonti_admin.down.sql
--
-- Lo stato socio si calcola nel server con deriveMembershipState (stesse
-- fonti della pagina admin: Google Sheet live per modulo e libro soci + righe
-- manual_override della tabella). Qui cambia solo il collegamento:
--   - gw_people.association_member_id resta SOLO per le righe manual_override;
--   - gw_people.membership_email: chiave dell'admin (email) per i soci del
--     libro soci / modulo. Un trigger mantiene la regola per tutte le
--     funzioni esistenti (un id di riga non manuale diventa la sua email).
--   - gw_set_membership_link ("Cerca nel libro soci"), gw_person_from_membership
--     e gw_resolve_match_membership (aggiunta rapida e "Collega" a un socio).
--   - Dati esistenti: i collegamenti a righe non manuali diventano email.

begin;

do $$
begin
  if to_regprocedure('public.gw_set_booking_fee(uuid, uuid, integer, bigint)') is null then
    raise exception 'Migrazione 016 interrotta: applica prima 015_gw_quota_workshop_v3c.sql';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'gw_people' and column_name = 'membership_email'
  ) then
    raise exception 'Migrazione 016 interrotta: sembra già applicata (membership_email esiste)';
  end if;
end;
$$;

alter table public.gw_people add column membership_email text;

comment on column public.gw_people.membership_email is
  'Chiave del socio come la usa la pagina admin (email, minuscola) per i soci del libro soci o del modulo (Google Sheet). association_member_id resta solo per le righe manual_override.';

create index gw_people_membership_email_idx on public.gw_people (membership_email)
  where membership_email is not null and merged_into is null;

-- association_member_id solo per manual_override: un id di riga del libro
-- soci o del modulo diventa la sua email (se la riga non esiste più, resta).
create function public.gw_people_membership_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_source text;
begin
  if new.association_member_id is not null then
    select m.source into v_source from association_members m where m.id = new.association_member_id;
    if v_source = 'manual_override' then
      new.membership_email := null;
    elsif v_source is not null then
      new.membership_email := coalesce(gw_member_email(new.association_member_id), new.membership_email);
      new.association_member_id := null;
    end if;
  end if;
  new.membership_email := lower(gw_clean(new.membership_email));
  return new;
end;
$$;

create trigger gw_people_membership_link
  before insert or update of association_member_id, membership_email on public.gw_people
  for each row execute function public.gw_people_membership_link();

-- ---------------------------------------------------------------------------
-- Campi vuoti della persona dai dati del socio (stessa regola della 014)
-- ---------------------------------------------------------------------------
create function public.gw_fill_person_fields(
  p_operator_id uuid,
  p_person_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text
)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_people;
  v_after gw_people;
  v_email text := lower(gw_clean(p_email));
begin
  select * into v_before from gw_people where id = p_person_id for update;
  if not found then
    return false;
  end if;

  if (gw_clean(v_before.first_name) is not null or gw_clean(p_first_name) is null)
     and (gw_clean(v_before.last_name) is not null or gw_clean(p_last_name) is null)
     and (gw_clean(v_before.email) is not null or v_email is null) then
    return false;
  end if;

  update gw_people
     set first_name = coalesce(gw_clean(first_name), gw_clean(p_first_name)),
         last_name = coalesce(gw_clean(last_name), gw_clean(p_last_name)),
         email = coalesce(gw_clean(email), v_email),
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

create function public.gw_fill_person_from_member_row(p_operator_id uuid, p_person_id uuid, p_member_id uuid)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_member record;
begin
  select m.first_name, m.last_name, gw_member_email(m.id) as email
    into v_member
    from association_members m
   where m.id = p_member_id;
  if not found then
    return false;
  end if;
  return gw_fill_person_fields(p_operator_id, p_person_id, v_member.first_name, v_member.last_name, v_member.email);
end;
$$;

-- Come in 014, ma tramite gw_fill_person_fields.
create or replace function public.gw_fill_person_from_member(p_operator_id uuid, p_person_id uuid)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
begin
  select association_member_id into v_member_id from gw_people where id = p_person_id;
  if v_member_id is null then
    return false;
  end if;
  return gw_fill_person_from_member_row(p_operator_id, p_person_id, v_member_id);
end;
$$;

-- Persona nuova (aggiunta rapida degli admin, abbinamento): + membership_email.
create or replace function public.gw_create_person(p_operator_id uuid, p_data jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_people;
begin
  insert into gw_people (
    first_name, last_name, nickname, email, instagram, phone,
    teamartist_id, notes, association_member_id, membership_email, created_by
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
    lower(gw_clean(p_data->>'membership_email')),
    p_operator_id
  )
  returning * into v_row;

  perform gw_audit(p_operator_id, 'person', v_row.id, 'insert', null, to_jsonb(v_row));
  return v_row.id;
end;
$$;

-- Abbinamento automatico e "Collega" a un socio della tabella: come in 014,
-- ma la persona già collegata si trova anche per email (membership_email).
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
-- Collegamento a un socio come lo vede la pagina admin
-- ---------------------------------------------------------------------------
-- "Cerca nel libro soci": p_member_id = riga manual_override della tabella,
-- oppure p_email = chiave del socio del libro soci / modulo (Google Sheet).
-- Tutto null = scollega. Nome, cognome ed email del socio (passati dal server,
-- mai codice fiscale, data di nascita o tessera) riempiono i campi vuoti.
create function public.gw_set_membership_link(
  p_operator_id uuid,
  p_person_id uuid,
  p_version integer,
  p_member_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text
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
  if p_member_id is not null and not exists (
    select 1 from association_members where id = p_member_id and source = 'manual_override'
  ) then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Validazione manuale non trovata.';
  end if;

  update gw_people
     set association_member_id = p_member_id,
         membership_email = case when p_member_id is null then p_email end,
         version = version + 1
   where id = p_person_id
  returning * into v_after;

  perform gw_audit(
    p_operator_id, 'person', p_person_id, 'update',
    jsonb_build_object('association_member_id', v_before.association_member_id, 'membership_email', v_before.membership_email),
    jsonb_build_object('association_member_id', v_after.association_member_id, 'membership_email', v_after.membership_email)
  );

  if p_member_id is not null then
    perform gw_fill_person_from_member(p_operator_id, p_person_id);
  elsif v_after.membership_email is not null or gw_clean(p_first_name) is not null then
    perform gw_fill_person_fields(p_operator_id, p_person_id, p_first_name, p_last_name, p_email);
  end if;

  return (select version from gw_people where id = p_person_id);
end;
$$;

-- Persona per un socio: già collegata (per id o per email) → quella, con i
-- campi vuoti riempiti; altrimenti una persona nuova collegata.
create function public.gw_person_from_membership(
  p_operator_id uuid,
  p_member_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_fallback_text text
)
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
     where p.merged_into is null and p.membership_email = v_email;
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

-- Riga "da abbinare" → "Collega" a un socio (manual_override o Google Sheet).
create function public.gw_resolve_match_membership(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_participant_id uuid,
  p_member_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_text text;
begin
  select entered_as into v_text
    from gw_booking_participants
   where id = p_participant_id and booking_id = p_booking_id;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  return gw_resolve_match(
    p_operator_id, p_booking_id, p_version, p_participant_id, 'collega',
    gw_person_from_membership(p_operator_id, p_member_id, p_email, p_first_name, p_last_name, v_text)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Dati esistenti: collegamenti a righe del libro soci o del modulo → email
-- ---------------------------------------------------------------------------
do $$
declare
  v_person record;
begin
  for v_person in
    select p.id, p.association_member_id, gw_member_email(p.association_member_id) as email
      from gw_people p
      join association_members m on m.id = p.association_member_id
     where m.source is distinct from 'manual_override'
     order by p.created_at
  loop
    update gw_people
       set association_member_id = null,
           membership_email = v_person.email,
           version = version + 1
     where id = v_person.id;
    perform gw_audit(null, 'person', v_person.id, 'update',
                     jsonb_build_object('association_member_id', v_person.association_member_id),
                     jsonb_build_object('membership_email', v_person.email,
                                        'nota', 'migrazione 016: collegamento per email come la pagina admin'));
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
    'public.gw_people_membership_link()',
    'public.gw_fill_person_fields(uuid, uuid, text, text, text)',
    'public.gw_fill_person_from_member_row(uuid, uuid, uuid)',
    'public.gw_fill_person_from_member(uuid, uuid)',
    'public.gw_create_person(uuid, jsonb)',
    'public.gw_person_from_member(uuid, uuid, text)',
    'public.gw_match_entered_person(uuid, uuid, text, uuid[])',
    'public.gw_set_membership_link(uuid, uuid, integer, uuid, text, text, text)',
    'public.gw_person_from_membership(uuid, uuid, text, text, text, text)',
    'public.gw_resolve_match_membership(uuid, uuid, integer, uuid, uuid, text, text, text)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- PostgREST: ricarica lo schema per vedere colonna e funzioni nuove.
notify pgrst, 'reload schema';

commit;
