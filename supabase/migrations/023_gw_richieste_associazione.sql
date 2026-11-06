-- Gestionale Workshop — Richieste di associazione (Fase 4d, parte B)
--
-- Rollback: 023_gw_richieste_associazione.down.sql
--
--   - gw_membership_contacts: per chi non è in regola, i contatti fatti per
--     chiedere l'iscrizione all'associazione (le email partono da Gmail, qui si
--     registra solo che sono state mandate). Valgono per PERSONA e PERIODO
--     associativo (period_key = inizio pagamenti del periodo, da
--     src/lib/association/membership-periods.ts, es. '2025-09-01',
--     '2027-01-01'), non per workshop: due workshop dello stesso periodo
--     mostrano lo stesso storico.
--   - kind/number: la richiesta è il numero 0, i solleciti 1, 2, 3…; il numero
--     lo calcola il database (massimo valido + 1, anche dopo un'eliminazione).
--   - Eliminazione logica (D22) con "Annulla" entro 10 minuti da chi ha
--     eliminato; storico per ogni scrittura. RLS senza policy + REVOKE.
--   - Parte B2: altri nomi delle persone (gw_person_aliases, usati anche
--     dall'abbinamento automatico), "+ Nuova persona" con altri nomi, email
--     scritta da Ale (gw_booking_participants.entered_email): abbina per
--     prima, completa la scheda vuota, non sovrascrive un'email diversa.
--   - gw_import_roster accetta `forced_status` (moduli compatti, richiesta
--     separata): vedi la sezione in fondo.

begin;

do $$
begin
  if to_regprocedure('public.gw_log_member_validation(uuid, uuid, text, jsonb)') is null then
    raise exception 'Migrazione 023 interrotta: applica prima 022_gw_quota_ok.sql';
  end if;
  if to_regclass('public.gw_membership_contacts') is not null then
    raise exception 'Migrazione 023 interrotta: sembra già applicata (gw_membership_contacts esiste)';
  end if;
end;
$$;

create type public.gw_contact_kind as enum ('richiesta', 'sollecito');

create table public.gw_membership_contacts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.gw_people (id),
  period_key text not null check (period_key ~ '^\d{4}-\d{2}-\d{2}$'),
  kind public.gw_contact_kind not null,
  number integer not null check (number >= 0),
  sent_on date not null,
  note text,
  created_by uuid references public.gw_operators (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.gw_operators (id),
  constraint gw_membership_contacts_kind_number check ((kind = 'richiesta') = (number = 0))
);

create index gw_membership_contacts_person_period_idx
  on public.gw_membership_contacts (person_id, period_key) where deleted_at is null;

alter table public.gw_membership_contacts enable row level security;
revoke all on table public.gw_membership_contacts from public, anon, authenticated;

comment on table public.gw_membership_contacts is
  'Richieste di associazione e solleciti (4d): per persona e periodo associativo; number 0 = richiesta, 1.. = solleciti.';

-- Una riga eliminata non si modifica (stessa guardia di 020); niente contatti
-- (né altri nomi, B2) per una persona eliminata.
create trigger gw_membership_contacts_deleted_guard
  before update on public.gw_membership_contacts
  for each row execute function public.gw_deleted_row_guard();

create function public.gw_live_person_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.deleted_at is null and exists (select 1 from gw_people where id = new.person_id and deleted_at is not null) then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  return new;
end;
$$;

create trigger gw_membership_contacts_live_person
  before insert or update on public.gw_membership_contacts
  for each row execute function public.gw_live_person_guard();

-- Registra un contatto: richiesta se non ce ne sono di validi nel periodo,
-- altrimenti il sollecito successivo (massimo valido + 1). La riga della
-- persona si blocca, così due operatori non assegnano lo stesso numero.
create function public.gw_add_membership_contact(
  p_operator_id uuid,
  p_person_id uuid,
  p_period_key text,
  p_sent_on date,
  p_note text
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_number integer;
  v_row gw_membership_contacts;
begin
  perform 1 from gw_people where id = p_person_id and deleted_at is null and merged_into is null for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if p_sent_on is null or p_period_key is null or p_period_key !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Data o periodo non validi.';
  end if;

  select coalesce(max(number) + 1, 0) into v_number
    from gw_membership_contacts
   where person_id = p_person_id and period_key = p_period_key and deleted_at is null;

  insert into gw_membership_contacts (person_id, period_key, kind, number, sent_on, note, created_by)
  values (p_person_id, p_period_key, case when v_number = 0 then 'richiesta' else 'sollecito' end::gw_contact_kind,
          v_number, p_sent_on, gw_clean(p_note), p_operator_id)
  returning * into v_row;

  perform gw_audit(p_operator_id, 'membership_contact', v_row.id, 'insert', null, to_jsonb(v_row));
  return jsonb_build_object('id', v_row.id, 'kind', v_row.kind, 'number', v_row.number);
end;
$$;

-- "Segna come inviata a tutti": la richiesta (o il sollecito successivo) per
-- ogni persona, nella stessa transazione: o tutte o nessuna.
create function public.gw_add_membership_contacts(
  p_operator_id uuid,
  p_person_ids uuid[],
  p_period_key text,
  p_sent_on date
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_person uuid;
  v_count integer := 0;
begin
  if coalesce(array_length(p_person_ids, 1), 0) = 0 then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Nessuna persona.';
  end if;
  foreach v_person in array (select array_agg(distinct x) from unnest(p_person_ids) x)
  loop
    perform gw_add_membership_contact(p_operator_id, v_person, p_period_key, p_sent_on, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.gw_delete_membership_contact(p_operator_id uuid, p_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_membership_contacts;
begin
  select * into v_before from gw_membership_contacts where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  update gw_membership_contacts set deleted_at = now(), deleted_by = p_operator_id where id = p_id;
  perform gw_audit(p_operator_id, 'membership_contact', p_id, 'delete', to_jsonb(v_before), jsonb_build_object('eliminato', true));
end;
$$;

-- "Eliminato · Annulla": come gw_restore_deleted (020), solo chi ha eliminato
-- ed entro 10 minuti. Il numero resta quello che aveva.
create function public.gw_restore_membership_contact(p_operator_id uuid, p_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row gw_membership_contacts;
begin
  select * into v_row from gw_membership_contacts where id = p_id for update;
  if not found or v_row.deleted_at is null then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_row.deleted_by is distinct from p_operator_id or v_row.deleted_at < now() - interval '10 minutes' then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Non si può più annullare l''eliminazione.';
  end if;
  update gw_membership_contacts set deleted_at = null, deleted_by = null where id = p_id;
  perform gw_audit(p_operator_id, 'membership_contact', p_id, 'update',
                   jsonb_build_object('deleted_at', v_row.deleted_at), jsonb_build_object('ripristinato', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- Moduli compatti (richiesta separata, stessa migrazione): nell'anteprima del
-- box di testo uno stato per riga; se il testo dice uno stato e i pagamenti
-- un altro, Ale sceglie. gw_import_roster accetta `forced_status`
-- (interessato | prenotato) per le righe nuove. Il resto come in 019.
-- ---------------------------------------------------------------------------
create or replace function public.gw_import_roster(
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
      -- Acconto pagato / Saldato si salvano solo con il primo pagamento.
      if gw_clean(v_row->>'status') in ('acconto', 'saldato')
         and jsonb_array_length(coalesce(v_row->'payments', '[]'::jsonb)) = 0 then
        raise exception 'gw_invalid' using errcode = 'GW400',
          detail = 'Acconto pagato o Saldato: registra il primo pagamento.';
      end if;
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
        coalesce((gw_clean(v_payment->>'paid_on'))::date, p_paid_on), p_received_by,
        coalesce(gw_clean(v_payment->>'description'), 'importazione testo'), null, 'importazione testo'
      );
      v_payments := v_payments + 1;
    end loop;

    perform gw_apply_auto_status(p_operator_id, v_booking_id);

    -- Moduli compatti: nell'anteprima Ale ha scelto lo stato scritto nel testo
    -- invece di quello indicato dai pagamenti (D21: la scelta a mano vale).
    -- Solo righe nuove e solo stati non economici.
    if gw_clean(v_row->>'booking_id') is null and gw_clean(v_row->>'forced_status') in ('interessato', 'prenotato') then
      update gw_bookings
         set status = (v_row->>'forced_status')::gw_booking_status, version = version + 1
       where id = v_booking_id and status <> (v_row->>'forced_status')::gw_booking_status;
      if found then
        perform gw_audit(p_operator_id, 'booking', v_booking_id, 'update', null,
                         jsonb_build_object('status', v_row->>'forced_status', 'nota', 'stato scelto nell''anteprima del testo'));
      end if;
    end if;
  end loop;

  perform gw_audit(p_operator_id, 'workshop', p_workshop_id, 'insert', null,
                   jsonb_build_object('origine', 'importazione testo', 'iscrizioni_create', v_created,
                                      'iscrizioni_aggiornate', v_updated, 'pagamenti', v_payments,
                                      'data_pagamenti', p_paid_on));

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'payments', v_payments);
end;
$$;


-- ---------------------------------------------------------------------------
-- Parte B2: altri nomi delle persone (alias) ed email inserite da Ale.
-- ---------------------------------------------------------------------------

-- Email scritta da Ale (D18: Ale vede solo quella che ha scritto lei).
alter table public.gw_booking_participants
  add column entered_email text
  constraint gw_booking_participants_entered_email_check check (entered_email is null or entered_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');

-- Altri nomi (nome d'arte, handle Instagram, soprannome). Unico tra gli alias
-- attivi (indice) e i nickname delle persone non unite (gw_add_person_alias).
create table public.gw_person_aliases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.gw_people (id),
  alias text not null check (btrim(alias) <> ''),
  alias_normalized text not null check (alias_normalized <> ''),
  created_by uuid references public.gw_operators (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.gw_operators (id)
);

create unique index gw_person_aliases_active_key on public.gw_person_aliases (alias_normalized) where deleted_at is null;
create index gw_person_aliases_person_idx on public.gw_person_aliases (person_id) where deleted_at is null;

alter table public.gw_person_aliases enable row level security;
revoke all on table public.gw_person_aliases from public, anon, authenticated;

create trigger gw_person_aliases_deleted_guard
  before update on public.gw_person_aliases
  for each row execute function public.gw_deleted_row_guard();

create trigger gw_person_aliases_live_person
  before insert or update on public.gw_person_aliases
  for each row execute function public.gw_live_person_guard();

-- Email valida, minuscola, senza spazi; null se vuota. Formato non valido → GW400.
create function public.gw_entered_email(p_value text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(replace(gw_clean(p_value), ' ', ''));
begin
  if v_email is null then
    return null;
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Email non valida.';
  end if;
  return v_email;
end;
$$;

-- Email di Ale sulla persona collegata: se la scheda non ha email la prende
-- (con storico); se ne ha una diversa non la tocca (l'admin vede "Ale ha
-- indicato: … — usa questa").
create function public.gw_apply_entered_email(p_operator_id uuid, p_participant_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_person gw_people;
begin
  select * into v_person from gw_people
   where id = (select person_id from gw_booking_participants where id = p_participant_id);
  select entered_email into v_email from gw_booking_participants where id = p_participant_id;
  if v_email is null or gw_clean(v_person.email) is not null or v_person.deleted_at is not null then
    return;
  end if;
  update gw_people set email = v_email, version = version + 1 where id = v_person.id;
  perform gw_audit(p_operator_id, 'person', v_person.id, 'update',
                   jsonb_build_object('email', null),
                   jsonb_build_object('email', v_email, 'origine', 'email indicata da Ale'));
end;
$$;

-- "+ Email" nella riga di Ale: aggiunge, cambia o toglie l'email scritta da lei.
create function public.gw_set_entered_email(p_operator_id uuid, p_participant_id uuid, p_email text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_booking_participants;
  v_email text := gw_entered_email(p_email);
begin
  select * into v_before from gw_booking_participants
   where id = p_participant_id and removed_at is null and deleted_at is null for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  update gw_booking_participants set entered_email = v_email where id = p_participant_id;
  perform gw_audit(p_operator_id, 'booking', v_before.booking_id, 'update',
                   jsonb_build_object('participant_id', p_participant_id, 'entered_email', v_before.entered_email),
                   jsonb_build_object('participant_id', p_participant_id, 'entered_email', v_email));
  perform gw_apply_entered_email(p_operator_id, p_participant_id);
end;
$$;

-- Nome di una persona per i messaggi (nickname, altrimenti nome e cognome).
create function public.gw_person_label(p_person_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(gw_clean(nickname), btrim(concat_ws(' ', first_name, last_name))) from gw_people where id = p_person_id;
$$;

create function public.gw_add_person_alias(p_operator_id uuid, p_person_id uuid, p_alias text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_alias text := regexp_replace(gw_clean(p_alias), '\s+', ' ', 'g');
  v_norm text := gw_norm(p_alias);
  v_other uuid;
  v_id uuid;
begin
  perform 1 from gw_people where id = p_person_id and deleted_at is null and merged_into is null for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_norm is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Scrivi il nome.';
  end if;
  if exists (select 1 from gw_people where id = p_person_id and gw_norm(nickname) = v_norm) then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'È già il nickname di questa persona.';
  end if;

  select person_id into v_other from gw_person_aliases where alias_normalized = v_norm and deleted_at is null;
  if v_other is null then
    select id into v_other from gw_people
     where gw_norm(nickname) = v_norm and deleted_at is null and merged_into is null and id <> p_person_id
     limit 1;
  end if;
  if v_other = p_person_id then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Questo nome c''è già.';
  elsif v_other is not null then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = format('«%s» è già usato da %s.', v_alias, coalesce(gw_person_label(v_other), 'un''altra persona'));
  end if;

  insert into gw_person_aliases (person_id, alias, alias_normalized, created_by)
  values (p_person_id, v_alias, v_norm, p_operator_id)
  returning id into v_id;
  perform gw_audit(p_operator_id, 'person_alias', v_id, 'insert', null,
                   jsonb_build_object('person_id', p_person_id, 'alias', v_alias));
  return v_id;
end;
$$;

create function public.gw_delete_person_alias(p_operator_id uuid, p_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_person_aliases;
begin
  select * into v_before from gw_person_aliases where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  update gw_person_aliases set deleted_at = now(), deleted_by = p_operator_id where id = p_id;
  perform gw_audit(p_operator_id, 'person_alias', p_id, 'delete', to_jsonb(v_before), jsonb_build_object('eliminato', true));
end;
$$;

-- "+ Nuova persona" dalla pagina Persone: scheda e altri nomi insieme.
create function public.gw_create_person_with_aliases(p_operator_id uuid, p_data jsonb, p_aliases jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_person_id uuid;
  v_alias text;
begin
  v_person_id := gw_create_person(p_operator_id, p_data);
  for v_alias in select value #>> '{}' from jsonb_array_elements(coalesce(p_aliases, '[]'::jsonb)) loop
    perform gw_add_person_alias(p_operator_id, v_person_id, v_alias);
  end loop;
  return v_person_id;
end;
$$;

-- D20 + B2: l'abbinamento automatico considera anche gli altri nomi (stesse
-- regole: corrispondenza esatta e unica). Il resto come in 020.
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
             -- 4d (B2): anche gli altri nomi della persona.
             or exists (select 1 from gw_person_aliases a
                         where a.person_id = p.id and a.deleted_at is null and a.alias_normalized = v_norm)
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

-- B2: l'email scritta da Ale (voce {"text", "email"}) abbina per prima, poi
-- completa la scheda se è vuota. Il resto come in 015.
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
  v_entry jsonb;
  v_text text;
  v_email text;
  v_ord bigint;
  v_match record;
  v_ids uuid[];
  v_participant_id uuid;
  v_person_ids uuid[] := '{}';
begin
  select * into v_workshop from gw_workshops where id = p_workshop_id;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_workshop.default_fee_cents is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Imposta prima la quota del workshop.';
  end if;
  -- 4d (B2): ogni voce è il testo scritto da Ale oppure {"text", "email"}.
  if jsonb_typeof(p_entries) is distinct from 'array'
     or jsonb_array_length(p_entries) not between 1 and 2
     or exists (select 1 from jsonb_array_elements(p_entries) e
                 where gw_clean(case jsonb_typeof(e) when 'string' then e #>> '{}' when 'object' then e->>'text' end) is null) then
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

  for v_entry, v_ord in
    select e, o from jsonb_array_elements(p_entries) with ordinality as x(e, o)
  loop
    v_text := case jsonb_typeof(v_entry) when 'string' then v_entry #>> '{}' else v_entry->>'text' end;
    v_email := case when jsonb_typeof(v_entry) = 'object' then gw_entered_email(v_entry->>'email') end;
    v_match := null;

    -- Email scritta da Ale: la regola più forte. Una sola persona con quella
    -- email, non già iscritta né già scelta nella coppia → collegata.
    if v_email is not null then
      select array_agg(p.id) into v_ids
        from gw_people p
       where p.merged_into is null and p.deleted_at is null and lower(btrim(p.email)) = v_email;
      if coalesce(array_length(v_ids, 1), 0) = 1
         and not v_ids[1] = any (v_person_ids)
         and not exists (select 1 from gw_booking_participants
                          where workshop_id = p_workshop_id and person_id = v_ids[1]
                            and removed_at is null and deleted_at is null) then
        select v_ids[1] as out_person_id, 'automatico'::gw_match_status as out_match_status,
               false as out_auto_created, null::uuid as out_duplicate_of
          into v_match;
      end if;
    end if;
    if v_match is null then
      select * into v_match from gw_match_entered_person(p_operator_id, p_workshop_id, v_text, v_person_ids);
    end if;

    insert into gw_booking_participants (
      booking_id, workshop_id, person_id, is_primary,
      entered_as, entered_email, match_status, auto_created_person, possible_duplicate_person_id
    ) values (
      v_booking_id, p_workshop_id, v_match.out_person_id, v_ord = 1,
      regexp_replace(gw_clean(v_text), '\s+', ' ', 'g'), v_email, v_match.out_match_status,
      v_match.out_auto_created, v_match.out_duplicate_of
    )
    returning id into v_participant_id;
    perform gw_apply_entered_email(p_operator_id, v_participant_id);
    v_person_ids := v_person_ids || v_match.out_person_id;
  end loop;

  perform gw_audit(p_operator_id, 'booking', v_booking_id, 'insert', null, gw_booking_snapshot(v_booking_id));
  return v_booking_id;
end;
$$;

-- Sicurezza: eseguibili solo dalla service role.
revoke execute on function public.gw_live_person_guard() from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.gw_add_membership_contact(uuid, uuid, text, date, text)',
    'public.gw_set_entered_email(uuid, uuid, text)',
    'public.gw_add_person_alias(uuid, uuid, text)',
    'public.gw_delete_person_alias(uuid, uuid)',
    'public.gw_create_person_with_aliases(uuid, jsonb, jsonb)',
    'public.gw_apply_entered_email(uuid, uuid)',
    'public.gw_entered_email(text)',
    'public.gw_person_label(uuid)',
    'public.gw_add_membership_contacts(uuid, uuid[], text, date)',
    'public.gw_delete_membership_contact(uuid, uuid)',
    'public.gw_restore_membership_contact(uuid, uuid)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;

-- PostgREST: ricarica lo schema per vedere tabella e funzioni nuove.
notify pgrst, 'reload schema';
