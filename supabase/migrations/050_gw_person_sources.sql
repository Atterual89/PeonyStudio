-- 050 — Fase B audit anagrafica: registro unico dei collegamenti fonte → persona.
--
-- Ogni riga dice: "questa riga di questa fonte appartiene a questa persona"
-- (o "da confermare", con i candidati). Il collegamento si decide una volta e
-- si salva, invece di ricalcolarlo a ogni caricamento confrontando email e nomi.
--
-- Migrazione ADDITIVA:
-- - non modifica tabelle esistenti e non scrive su tabelle del sito;
-- - nessuna lettura del gestionale cambia: la tabella si popola con
--   gw_backfill_person_sources() e per ora serve solo a confrontare;
-- - rollback: 050_gw_person_sources.down.sql.
--
-- Regole di Laura (11 nov 2026): abbinamento automatico solo se email e
-- nome+cognome indicano una sola persona; omonimi ed email condivise vanno
-- in coda all'admin. Il libro ufficiale è solo archivio.
begin;

do $$ begin
  if to_regclass('public.gw_person_sources') is not null then
    raise exception 'Migrazione 050 già applicata';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'gw_people'
                   and column_name = 'membership_name_key') then
    raise exception 'Applicare prima la migrazione 033';
  end if;
  if to_regclass('public.gw_ale_contacts') is null
     or to_regclass('public.gw_peony_booking_holders') is null
     or to_regclass('public.gw_peony_booking_partners') is null
     or to_regclass('public.gw_association_payment_allocations') is null then
    raise exception 'Applicare prima le migrazioni 029–039';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Normalizzazione email: identica a normalizeMembershipEmail
-- (src/lib/association/membership-state.ts). Gmail ignora punti e "+etichetta";
-- googlemail.com equivale a gmail.com. Gli altri domini restano come sono.
-- ---------------------------------------------------------------------------
create function public.gw_norm_email(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when e is null then null
    when position('@' in e) = 0 then e
    when split_part(e, '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(e, '@', 1), '+', 1), '.', '') || '@gmail.com'
    else split_part(e, '@', 1) || '@' || split_part(e, '@', 2)
  end
  from (select nullif(lower(btrim(coalesce(p_value, ''))), '') as e) v;
$$;

-- Nomi compatibili: le parole di uno sono tutte nell'altro (secondi nomi e
-- doppi cognomi ammessi). Null se uno dei due non ha almeno nome e cognome.
create function public.gw_names_compatible(p_a text, p_b text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when ka is null or kb is null then null
    else string_to_array(ka, ' ') <@ string_to_array(kb, ' ')
      or string_to_array(kb, ' ') <@ string_to_array(ka, ' ')
  end
  from (select public.gw_name_key(p_a) as ka, public.gw_name_key(p_b) as kb) k;
$$;

-- ---------------------------------------------------------------------------
-- Tabella
-- ---------------------------------------------------------------------------
create type public.gw_source_kind as enum (
  'modulo_google',          -- association_members, source = google_sheet
  'modulo_cartaceo',        -- association_members, source = manual_form verificato
  'quota_manuale',          -- association_members, source = manual_override senza prova email
  'quota_email',            -- gw_association_payment_allocations
  'libro_ufficiale',        -- association_members, source = official_members_book (archivio)
  'biglietto_intestatario', -- gw_peony_booking_holders
  'biglietto_partner',      -- gw_peony_booking_partners
  'iscrizione_workshop',    -- gw_booking_participants (iscrizioni di Ale)
  'contatto_ale'            -- gw_ale_contacts (Excel di Ale)
);

create type public.gw_link_status as enum (
  'automatico',     -- un solo candidato con email E nome+cognome coerenti
  'da_confermare',  -- nessun candidato o più candidati: decide l'admin
  'confermato',     -- scelta esplicita di una persona (admin o Ale)
  'rifiutato'       -- l'admin ha deciso che non va collegata a nessuno
);

create table public.gw_person_sources (
  id uuid primary key default gen_random_uuid(),
  source_kind public.gw_source_kind not null,
  -- Chiave della riga nella tabella d'origine (id, oppure evento:biglietto).
  source_ref text not null check (btrim(source_ref) <> ''),
  -- Riferimento leggibile della fonte (es. source_row_id del modulo Google).
  source_label text,
  person_id uuid references public.gw_people (id) on delete restrict,
  status public.gw_link_status not null,
  candidate_ids uuid[] not null default '{}'::uuid[],
  -- Come la fonte nomina la persona, per mostrarla nella coda.
  seen_name text,
  seen_email text,
  note text,
  linked_by uuid references public.gw_operators (id),
  linked_at timestamptz,
  origin text not null default 'manuale',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_kind, source_ref),
  -- Collegata se e solo se lo stato lo dice.
  constraint gw_person_sources_link_check check (
    (status in ('automatico', 'confermato')) = (person_id is not null)
  )
);

create index gw_person_sources_person_idx
  on public.gw_person_sources (person_id) where person_id is not null;
create index gw_person_sources_queue_idx
  on public.gw_person_sources (source_kind, created_at) where status = 'da_confermare';

alter table public.gw_person_sources enable row level security;
revoke all on public.gw_person_sources from public, anon, authenticated;
grant select, insert, update, delete on public.gw_person_sources to service_role;

-- Riepilogo per il confronto con il sistema attuale.
create view public.gw_person_sources_summary as
  select source_kind, status, count(*)::int as righe
  from public.gw_person_sources
  group by source_kind, status;
revoke all on public.gw_person_sources_summary from public, anon, authenticated;
grant select on public.gw_person_sources_summary to service_role;

-- ---------------------------------------------------------------------------
-- Persona attiva finale (segue una fusione), null se eliminata.
-- ---------------------------------------------------------------------------
create function public.gw_active_person(p_person_id uuid)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select t.id
  from public.gw_people p
  join public.gw_people t on t.id = coalesce(p.merged_into, p.id)
  where p.id = p_person_id and t.deleted_at is null and t.merged_into is null;
$$;

-- Candidati per una riga di association_members (modulo, quota, libro):
-- collegamento esplicito già salvato sulla persona (quota manuale o socio del
-- libro collegato per nome), oppure stessa email
-- (normalizzata). name_checked = nome e cognome compatibili su entrambi i lati.
create function public.gw_member_row_candidates(p_row_id uuid)
returns table (person_id uuid, explicit boolean, name_checked boolean)
language sql
stable
set search_path = public, pg_temp
as $$
  with m as (
    select id, source, public.gw_norm_email(email) as em,
           concat_ws(' ', first_name, last_name) as nm,
           public.gw_name_key(concat_ws(' ', first_name, last_name)) as nk
    from public.association_members where id = p_row_id
  ), people as (
    select p.id,
           p.association_member_id,
           p.membership_name_key,
           public.gw_norm_email(p.email) as em1,
           public.gw_norm_email(p.membership_email) as em2,
           concat_ws(' ', p.first_name, p.last_name) as nm
    from public.gw_people p
    where p.deleted_at is null and p.merged_into is null
  )
  select people.id,
         -- Esplicito: quota manuale (association_member_id, migrazione 016) o
         -- socio del libro collegato per nome dall'admin (migrazione 033).
         bool_or(people.association_member_id = m.id
                 or (m.source = 'official_members_book' and m.nk is not null
                     and people.membership_name_key = m.nk)),
         bool_or(coalesce(public.gw_names_compatible(people.nm, m.nm), false))
  from m join people on
       people.association_member_id = m.id
    or (m.source = 'official_members_book' and m.nk is not null
        and people.membership_name_key = m.nk)
    -- Tutte le persone con la stessa email sono candidate, anche con nome
    -- diverso: un'email condivisa va sempre in coda (regola di Laura).
    or (m.em is not null and m.em in (people.em1, people.em2))
  group by people.id;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: copia i collegamenti già esistenti. Idempotente: non sovrascrive
-- mai una riga già presente (una decisione presa dopo resta valida).
-- ---------------------------------------------------------------------------
create function public.gw_backfill_person_sources()
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before integer;
  v_row record;
  v_ids uuid[];
  v_explicit uuid[];
  v_named uuid[];
  v_kind public.gw_source_kind;
begin
  select count(*) into v_before from public.gw_person_sources;

  -- Contatti Excel di Ale: collegati solo dall'admin.
  insert into public.gw_person_sources
    (source_kind, source_ref, person_id, status, seen_name, seen_email,
     linked_by, linked_at, origin)
  select 'contatto_ale', c.id::text, public.gw_active_person(c.person_id),
         case when public.gw_active_person(c.person_id) is null
              then 'da_confermare' else 'confermato' end::public.gw_link_status,
         c.display_name, c.email,
         case when public.gw_active_person(c.person_id) is null then null else c.linked_by end,
         case when public.gw_active_person(c.person_id) is null then null else c.linked_at end,
         'backfill_050'
  from public.gw_ale_contacts c
  on conflict (source_kind, source_ref) do nothing;

  -- Biglietti TT: intestatario e partner.
  insert into public.gw_person_sources
    (source_kind, source_ref, person_id, status, candidate_ids, note,
     linked_by, linked_at, origin)
  select 'biglietto_intestatario', h.event_id::text || ':' || h.ticket_id,
         public.gw_active_person(h.person_id),
         case when public.gw_active_person(h.person_id) is null
              then 'da_confermare' else 'confermato' end::public.gw_link_status,
         case when h.person_id is null and h.member_row_id is not null
              then coalesce((select array_agg(c.person_id order by c.person_id)
                             from public.gw_member_row_candidates(h.member_row_id) c), '{}')
              else '{}'::uuid[] end,
         case when h.person_id is null and h.member_row_id is not null
              then 'collegato al libro soci (riga ' || h.member_row_id || '), non a una persona' end,
         case when public.gw_active_person(h.person_id) is null then null else h.updated_by end,
         case when public.gw_active_person(h.person_id) is null then null else h.updated_at end,
         'backfill_050'
  from public.gw_peony_booking_holders h
  on conflict (source_kind, source_ref) do nothing;

  insert into public.gw_person_sources
    (source_kind, source_ref, person_id, status, candidate_ids, seen_name, seen_email,
     note, linked_by, linked_at, origin)
  select 'biglietto_partner', b.event_id::text || ':' || b.ticket_id,
         public.gw_active_person(b.person_id),
         case when public.gw_active_person(b.person_id) is null
              then 'da_confermare' else 'confermato' end::public.gw_link_status,
         case when b.person_id is null and b.member_row_id is not null
              then coalesce((select array_agg(c.person_id order by c.person_id)
                             from public.gw_member_row_candidates(b.member_row_id) c), '{}')
              else '{}'::uuid[] end,
         b.partner_name, b.partner_email,
         case when b.person_id is null and b.member_row_id is not null
              then 'collegato al libro soci (riga ' || b.member_row_id || '), non a una persona' end,
         case when public.gw_active_person(b.person_id) is null then null else b.updated_by end,
         case when public.gw_active_person(b.person_id) is null then null else b.updated_at end,
         'backfill_050'
  from public.gw_peony_booking_partners b
  -- Un partner rimosso esplicitamente (riga vuota) non è una fonte.
  where b.person_id is not null or b.member_row_id is not null
     or public.gw_clean(b.partner_name) is not null or public.gw_clean(b.partner_email) is not null
  on conflict (source_kind, source_ref) do nothing;

  -- Iscrizioni di Ale ai workshop (partecipanti attivi).
  insert into public.gw_person_sources
    (source_kind, source_ref, person_id, status, candidate_ids, seen_name, note, origin)
  select 'iscrizione_workshop', bp.id::text,
         case when bp.match_status = 'da_abbinare' then null
              else public.gw_active_person(bp.person_id) end,
         case when bp.match_status = 'da_abbinare' or public.gw_active_person(bp.person_id) is null
                then 'da_confermare'
              when bp.match_status = 'confermato' and not bp.auto_created_person
                then 'confermato'
              else 'automatico' end::public.gw_link_status,
         case when bp.match_status = 'da_abbinare' and public.gw_active_person(bp.person_id) is not null
              then array[public.gw_active_person(bp.person_id)] else '{}'::uuid[] end,
         coalesce(bp.entered_as,
                  (select coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), p.nickname)
                   from public.gw_people p where p.id = bp.person_id)),
         case when bp.auto_created_person then 'scheda creata dall''iscrizione' end,
         'backfill_050'
  from public.gw_booking_participants bp
  join public.gw_bookings bk on bk.id = bp.booking_id and bk.deleted_at is null
  where bp.removed_at is null and bp.deleted_at is null
  on conflict (source_kind, source_ref) do nothing;

  -- Quote da email già assegnate.
  insert into public.gw_person_sources
    (source_kind, source_ref, person_id, status, seen_name, note,
     linked_by, linked_at, origin)
  select 'quota_email', a.id::text, public.gw_active_person(a.person_id),
         case when public.gw_active_person(a.person_id) is null
              then 'da_confermare' else 'confermato' end::public.gw_link_status,
         e.payer_name,
         'quota ' || to_char(a.period_from, 'YYYY-MM-DD') || ', posto ' || a.slot
           || case when a.member_key is not null then ', assegnata a ' || a.member_key else '' end,
         case when public.gw_active_person(a.person_id) is null then null else a.validated_by end,
         case when public.gw_active_person(a.person_id) is null then null else a.validated_at end,
         'backfill_050'
  from public.gw_association_payment_allocations a
  left join public.gw_association_payment_emails e on e.id = a.payment_id
  on conflict (source_kind, source_ref) do nothing;

  -- Moduli, quote manuali e libro ufficiale in association_members.
  for v_row in
    select m.id, m.source, m.source_row_id, m.membership_status, m.notes_admin,
           nullif(concat_ws(' ', m.first_name, m.last_name), '') as nm, m.email
    from public.association_members m
    where m.source in ('google_sheet', 'manual_form', 'manual_override', 'official_members_book')
  loop
    v_kind := case
      when v_row.source = 'google_sheet' then 'modulo_google'
      when v_row.source = 'manual_form' then 'modulo_cartaceo'
      when v_row.source = 'official_members_book' then 'libro_ufficiale'
      else 'quota_manuale' end;
    -- Le quote confermate da email sono già rappresentate dalle allocazioni.
    continue when v_kind = 'quota_manuale'
      and coalesce(v_row.notes_admin, '') like 'Quota confermata da email (%';
    continue when v_kind = 'modulo_cartaceo' and v_row.membership_status is distinct from 'verified';
    continue when exists (select 1 from public.gw_person_sources s
                          where s.source_kind = v_kind and s.source_ref = v_row.id::text);

    select coalesce(array_agg(c.person_id order by c.person_id), '{}'),
           coalesce(array_agg(c.person_id order by c.person_id) filter (where c.explicit), '{}'),
           coalesce(array_agg(c.person_id order by c.person_id) filter (where c.name_checked), '{}')
      into v_ids, v_explicit, v_named
      from public.gw_member_row_candidates(v_row.id) c;

    if cardinality(v_explicit) = 1 then
      -- Collegamento esplicito già salvato dall'admin sulla persona.
      insert into public.gw_person_sources
        (source_kind, source_ref, source_label, person_id, status, seen_name, seen_email, origin)
      values (v_kind, v_row.id::text, v_row.source_row_id, v_explicit[1], 'confermato',
              v_row.nm, v_row.email, 'backfill_050');
    elsif cardinality(v_ids) = 1 and cardinality(v_named) = 1 then
      -- Una sola persona, email E nome+cognome coerenti.
      insert into public.gw_person_sources
        (source_kind, source_ref, source_label, person_id, status, seen_name, seen_email, origin)
      values (v_kind, v_row.id::text, v_row.source_row_id, v_ids[1], 'automatico',
              v_row.nm, v_row.email, 'backfill_050');
    elsif v_kind = 'libro_ufficiale' then
      -- Archivio: se non è già collegato a una persona non entra in coda.
      continue;
    else
      insert into public.gw_person_sources
        (source_kind, source_ref, source_label, status, candidate_ids, seen_name, seen_email,
         note, origin)
      values (v_kind, v_row.id::text, v_row.source_row_id, 'da_confermare', v_ids,
              v_row.nm, v_row.email,
              case when cardinality(v_ids) = 0 then 'nessuna persona con questa email'
                   when cardinality(v_ids) > 1 then 'più persone possibili (email condivisa o omonimi)'
                   when cardinality(v_named) = 0 then 'stessa email, nome diverso o mancante'
                   else 'stessa email, nome da verificare' end,
              'backfill_050');
    end if;
  end loop;

  return jsonb_build_object(
    'inserite', (select count(*) from public.gw_person_sources) - v_before,
    'per_fonte', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
       select source_kind::text || ':' || status::text as k, count(*) as n
       from public.gw_person_sources group by 1) x)
  );
end;
$$;

revoke all on function public.gw_norm_email(text) from public, anon, authenticated;
revoke all on function public.gw_names_compatible(text, text) from public, anon, authenticated;
revoke all on function public.gw_active_person(uuid) from public, anon, authenticated;
revoke all on function public.gw_member_row_candidates(uuid) from public, anon, authenticated;
revoke all on function public.gw_backfill_person_sources() from public, anon, authenticated;
grant execute on function public.gw_norm_email(text) to service_role;
grant execute on function public.gw_names_compatible(text, text) to service_role;
grant execute on function public.gw_active_person(uuid) to service_role;
grant execute on function public.gw_member_row_candidates(uuid) to service_role;
grant execute on function public.gw_backfill_person_sources() to service_role;

commit;
notify pgrst, 'reload schema';
