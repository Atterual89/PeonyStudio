-- 051 — Fase C audit anagrafica: registro dei collegamenti sempre aggiornato.
--
-- La 050 ha creato gw_person_sources e copiato i collegamenti esistenti una
-- volta sola. Questa migrazione lo tiene allineato da qui in avanti:
-- - ogni nuovo modulo Google registra la sua riga (anche i casi dubbi, che
--   oggi gw_ensure_person_from_google_form restituisce come 'review' e perde);
-- - le iscrizioni di Ale, gli abbinamenti dei biglietti Ticket Tailor, i
--   contatti dell'Excel di Ale e le quote da email si rispecchiano nel
--   registro quando cambiano, con trigger sulle tabelle gw_;
-- - i biglietti TT mai collegati ottengono una riga (automatica se email e
--   nome+cognome indicano una sola persona, altrimenti da confermare);
-- - l'admin può confermare o rifiutare un collegamento (gw_resolve_person_source).
--
-- Regole (Laura, 11 nov 2026): automatico solo se email E nome+cognome indicano
-- una sola persona; email condivise e omonimi sempre da confermare; libro
-- ufficiale solo archivio.
--
-- Additiva sulle tabelle del sito: nessuna scrittura su association_members né
-- nuovi trigger su tabelle del sito. Sostituisce solo il corpo della funzione
-- gw_google_form_person_trigger (045), già collegata al trigger esistente.
-- Rollback: 051_gw_person_sources_live.down.sql.
begin;

do $$ begin
  if to_regclass('public.gw_person_sources') is null then
    raise exception 'Applicare prima la migrazione 050';
  end if;
  if to_regprocedure('public.gw_register_member_row_source(uuid)') is not null then
    raise exception 'Migrazione 051 già applicata';
  end if;
  if to_regclass('public.ticket_tailor_issued_tickets') is null then
    raise exception 'Tabella ticket_tailor_issued_tickets assente';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Utilità
-- ---------------------------------------------------------------------------

-- Inserisce o aggiorna una riga del registro. Una decisione esplicita
-- (confermato / rifiutato) non viene mai sovrascritta da un ricalcolo
-- automatico: solo p_force (rispecchiamento di un collegamento esplicito
-- salvato altrove) la sostituisce.
create function public.gw_upsert_person_source(
  p_kind public.gw_source_kind,
  p_ref text,
  p_person_id uuid,
  p_status public.gw_link_status,
  p_candidates uuid[],
  p_seen_name text,
  p_seen_email text,
  p_note text,
  p_label text,
  p_linked_by uuid,
  p_origin text,
  p_force boolean
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_current public.gw_person_sources%rowtype;
begin
  select * into v_current from public.gw_person_sources
    where source_kind = p_kind and source_ref = p_ref
    for update;
  if not found then
    insert into public.gw_person_sources
      (source_kind, source_ref, source_label, person_id, status, candidate_ids,
       seen_name, seen_email, note, linked_by, linked_at, origin)
    values
      (p_kind, p_ref, p_label,
       case when p_status in ('automatico', 'confermato') then p_person_id end,
       p_status, coalesce(p_candidates, '{}'), p_seen_name, p_seen_email, p_note,
       case when p_status = 'confermato' then p_linked_by end,
       case when p_status = 'confermato' then now() end,
       p_origin);
    return;
  end if;

  if v_current.status in ('confermato', 'rifiutato') and not p_force then
    -- Aggiorna solo come la fonte nomina la persona, non la decisione.
    update public.gw_person_sources
       set seen_name = coalesce(p_seen_name, seen_name),
           seen_email = coalesce(p_seen_email, seen_email),
           updated_at = now()
     where id = v_current.id
       and (seen_name is distinct from coalesce(p_seen_name, seen_name)
            or seen_email is distinct from coalesce(p_seen_email, seen_email));
    return;
  end if;

  if v_current.status = p_status
     and v_current.person_id is not distinct from
         (case when p_status in ('automatico', 'confermato') then p_person_id end)
     and v_current.candidate_ids = coalesce(p_candidates, '{}')
     and v_current.seen_name is not distinct from p_seen_name
     and v_current.seen_email is not distinct from p_seen_email
     and v_current.note is not distinct from p_note then
    return;
  end if;

  update public.gw_person_sources
     set person_id = case when p_status in ('automatico', 'confermato') then p_person_id end,
         status = p_status,
         candidate_ids = coalesce(p_candidates, '{}'),
         seen_name = p_seen_name,
         seen_email = p_seen_email,
         note = p_note,
         source_label = coalesce(p_label, source_label),
         linked_by = case when p_status = 'confermato' then p_linked_by end,
         linked_at = case when p_status = 'confermato' then now() end,
         version = version + 1,
         updated_at = now()
   where id = v_current.id;
end;
$$;

-- Ricerca per email normalizzata: senza indice ogni biglietto confronterebbe
-- l'email con tutta l'anagrafica (riallineamento iniziale lento).
create index if not exists gw_people_norm_email_idx
  on public.gw_people (public.gw_norm_email(email)) where deleted_at is null;
create index if not exists gw_people_norm_membership_email_idx
  on public.gw_people (public.gw_norm_email(membership_email)) where deleted_at is null;

-- Candidati per email e nome qualunque (biglietti, contatti di Ale):
-- tutte le persone attive con la stessa email normalizzata, più quelle con
-- nome+cognome identico quando la fonte non ha email.
create function public.gw_identity_candidates(p_name text, p_email text)
returns table (person_id uuid, name_checked boolean)
language sql
stable
set search_path = public, pg_temp
as $$
  with t as (
    select public.gw_norm_email(p_email) as em, public.gw_name_key(p_name) as nk, p_name as nm
  )
  select p.id,
         coalesce(public.gw_names_compatible(concat_ws(' ', p.first_name, p.last_name), t.nm), false)
  from public.gw_people p, t
  where p.deleted_at is null and p.merged_into is null
    and t.em is not null
    and (public.gw_norm_email(p.email) = t.em or public.gw_norm_email(p.membership_email) = t.em)
  union
  select p.id, true
  from public.gw_people p, t
  where p.deleted_at is null and p.merged_into is null
    and t.em is null and t.nk is not null
    and public.gw_name_key(concat_ws(' ', p.first_name, p.last_name)) = t.nk;
$$;

-- ---------------------------------------------------------------------------
-- Moduli, quote manuali, libro ufficiale (righe di association_members)
-- ---------------------------------------------------------------------------
create function public.gw_register_member_row_source(p_row_id uuid)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_kind public.gw_source_kind;
  v_ids uuid[];
  v_explicit uuid[];
  v_named uuid[];
begin
  select m.id, m.source, m.source_row_id, m.membership_status, m.notes_admin,
         nullif(concat_ws(' ', m.first_name, m.last_name), '') as nm, m.email
    into v_row
    from public.association_members m where m.id = p_row_id;
  if not found then return 'skipped'; end if;

  v_kind := case
    when v_row.source = 'google_sheet' then 'modulo_google'
    when v_row.source = 'manual_form' then 'modulo_cartaceo'
    when v_row.source = 'official_members_book' then 'libro_ufficiale'
    when v_row.source = 'manual_override' then 'quota_manuale'
  end;
  if v_kind is null then return 'skipped'; end if;
  -- Le quote confermate da email sono rappresentate dalle allocazioni.
  if v_kind = 'quota_manuale' and coalesce(v_row.notes_admin, '') like 'Quota confermata da email (%' then
    return 'skipped';
  end if;
  if v_kind = 'modulo_cartaceo' and v_row.membership_status is distinct from 'verified' then
    return 'skipped';
  end if;

  select coalesce(array_agg(c.person_id order by c.person_id), '{}'),
         coalesce(array_agg(c.person_id order by c.person_id) filter (where c.explicit), '{}'),
         coalesce(array_agg(c.person_id order by c.person_id) filter (where c.name_checked), '{}')
    into v_ids, v_explicit, v_named
    from public.gw_member_row_candidates(v_row.id) c;

  if cardinality(v_explicit) = 1 then
    perform public.gw_upsert_person_source(v_kind, v_row.id::text, v_explicit[1], 'confermato',
      '{}', v_row.nm, v_row.email, null, v_row.source_row_id, null, 'automatico_051', false);
    return 'confermato';
  elsif cardinality(v_ids) = 1 and cardinality(v_named) = 1 then
    perform public.gw_upsert_person_source(v_kind, v_row.id::text, v_ids[1], 'automatico',
      '{}', v_row.nm, v_row.email, null, v_row.source_row_id, null, 'automatico_051', false);
    return 'automatico';
  elsif v_kind = 'libro_ufficiale' then
    return 'skipped';
  end if;

  perform public.gw_upsert_person_source(v_kind, v_row.id::text, null, 'da_confermare', v_ids,
    v_row.nm, v_row.email,
    case when cardinality(v_ids) = 0 then 'nessuna persona con questa email'
         when cardinality(v_ids) > 1 then 'più persone possibili (email condivisa o omonimi)'
         when cardinality(v_named) = 0 then 'stessa email, nome diverso o mancante'
         else 'stessa email, nome da verificare' end,
    v_row.source_row_id, null, 'automatico_051', false);
  return 'da_confermare';
end;
$$;

-- Il trigger 045 resta dov'è: cambia solo la funzione che chiama.
create or replace function public.gw_google_form_person_trigger()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.source = 'google_sheet' then
    perform public.gw_ensure_person_from_google_form(new.id);
    perform public.gw_register_member_row_source(new.id);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Iscrizioni di Ale: il registro rispecchia il partecipante
-- ---------------------------------------------------------------------------
create function public.gw_sync_participant_source(p_participant_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v record;
  v_person uuid;
begin
  select bp.*, bk.deleted_at as booking_deleted_at
    into v
    from public.gw_booking_participants bp
    join public.gw_bookings bk on bk.id = bp.booking_id
   where bp.id = p_participant_id;
  if not found or v.removed_at is not null or v.deleted_at is not null or v.booking_deleted_at is not null then
    -- Non più una fonte: si toglie la riga, salvo una decisione esplicita.
    delete from public.gw_person_sources
     where source_kind = 'iscrizione_workshop' and source_ref = p_participant_id::text
       and status in ('automatico', 'da_confermare');
    return;
  end if;

  v_person := public.gw_active_person(v.person_id);
  -- Solo un abbinamento confermato (dall'admin o da Ale con la ricerca) è un
  -- collegamento. L'abbinamento automatico delle iscrizioni (nickname o nome
  -- uguale, di solito senza email) resta una proposta: regola "automatico solo
  -- con email e nome+cognome".
  perform public.gw_upsert_person_source(
    'iscrizione_workshop', v.id::text,
    case when v.match_status = 'confermato' then v_person end,
    case when v.match_status = 'confermato' and v_person is not null then 'confermato'
         else 'da_confermare' end::public.gw_link_status,
    case when v.match_status <> 'confermato' and v_person is not null then array[v_person] else '{}'::uuid[] end,
    coalesce(v.entered_as,
             (select coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), p.nickname)
              from public.gw_people p where p.id = v.person_id)),
    null,
    case when v.match_status = 'automatico' then 'proposta automatica da nickname o nome'
         when v.auto_created_person then 'scheda creata dall''iscrizione' end,
    null, null, 'iscrizione',
    -- Il partecipante è la fonte di verità: le scelte si fanno sull'iscrizione.
    true);
end;
$$;

create function public.gw_participant_source_trigger()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  perform public.gw_sync_participant_source(new.id);
  return new;
end;
$$;

create trigger gw_participant_person_source
after insert or update of person_id, match_status, removed_at, deleted_at, auto_created_person, entered_as
on public.gw_booking_participants
for each row execute function public.gw_participant_source_trigger();

-- ---------------------------------------------------------------------------
-- Biglietti Ticket Tailor (intestatario e partner)
-- ---------------------------------------------------------------------------
create function public.gw_register_ticket_source(p_event_id uuid, p_ticket_id text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ticket record;
  v_holder record;
  v_partner record;
  v_name text;
  v_ids uuid[];
  v_named uuid[];
  v_has_ticket boolean;
  v_has_holder boolean;
  v_ref text := p_event_id::text || ':' || p_ticket_id;
begin
  select t.holder_first_name, t.holder_last_name, t.holder_email, t.status
    into v_ticket
    from public.ticket_tailor_issued_tickets t
    join public.events e on e.ticket_tailor_event_id = t.ticket_tailor_event_id
   where e.id = p_event_id and t.ticket_tailor_issued_ticket_id = p_ticket_id
   limit 1;
  v_has_ticket := found;

  -- Intestatario.
  select * into v_holder from public.gw_peony_booking_holders
   where event_id = p_event_id and ticket_id = p_ticket_id;
  v_has_holder := found;
  if v_has_holder and public.gw_active_person(v_holder.person_id) is not null then
    perform public.gw_upsert_person_source('biglietto_intestatario', v_ref,
      public.gw_active_person(v_holder.person_id), 'confermato', '{}',
      nullif(concat_ws(' ', v_ticket.holder_first_name, v_ticket.holder_last_name), ''),
      v_ticket.holder_email, null, null, v_holder.updated_by, 'abbinamento_tt', true);
  elsif not v_has_ticket or lower(coalesce(v_ticket.status, '')) ~ '(void|cancel|refund|delet|inactive)' then
    delete from public.gw_person_sources
     where source_kind = 'biglietto_intestatario' and source_ref = v_ref
       and status in ('automatico', 'da_confermare');
  else
    v_name := nullif(concat_ws(' ', v_ticket.holder_first_name, v_ticket.holder_last_name), '');
    if v_has_holder and v_holder.member_row_id is not null then
      select coalesce(array_agg(c.person_id order by c.person_id), '{}') into v_ids
        from public.gw_member_row_candidates(v_holder.member_row_id) c;
      v_named := '{}';
    else
      select coalesce(array_agg(c.person_id order by c.person_id), '{}'),
             coalesce(array_agg(c.person_id order by c.person_id) filter (where c.name_checked), '{}')
        into v_ids, v_named
        from public.gw_identity_candidates(v_name, v_ticket.holder_email) c;
    end if;
    if cardinality(v_ids) = 1 and cardinality(v_named) = 1
       and public.gw_norm_email(v_ticket.holder_email) is not null then
      perform public.gw_upsert_person_source('biglietto_intestatario', v_ref, v_ids[1], 'automatico',
        '{}', v_name, v_ticket.holder_email, null, null, null, 'automatico_051', true);
    else
      perform public.gw_upsert_person_source('biglietto_intestatario', v_ref, null, 'da_confermare',
        v_ids, v_name, v_ticket.holder_email,
        case when v_has_holder and v_holder.member_row_id is not null then 'collegato al libro soci, non a una persona'
             when cardinality(v_ids) = 0 then 'nessuna persona con questa email'
             when cardinality(v_ids) > 1 then 'più persone possibili (email condivisa o omonimi)'
             else 'stessa email, nome diverso o mancante' end,
        null, null, 'automatico_051', true);
    end if;
  end if;

  -- Partner: solo se qualcuno l'ha indicato.
  select * into v_partner from public.gw_peony_booking_partners
   where event_id = p_event_id and ticket_id = p_ticket_id;
  if not found or (v_partner.person_id is null and v_partner.member_row_id is null
                   and public.gw_clean(v_partner.partner_name) is null
                   and public.gw_clean(v_partner.partner_email) is null) then
    delete from public.gw_person_sources
     where source_kind = 'biglietto_partner' and source_ref = v_ref
       and status in ('automatico', 'da_confermare');
  elsif public.gw_active_person(v_partner.person_id) is not null then
    perform public.gw_upsert_person_source('biglietto_partner', v_ref,
      public.gw_active_person(v_partner.person_id), 'confermato', '{}',
      v_partner.partner_name, v_partner.partner_email, null, null, v_partner.updated_by,
      'abbinamento_tt', true);
  else
    if v_partner.member_row_id is not null then
      select coalesce(array_agg(c.person_id order by c.person_id), '{}') into v_ids
        from public.gw_member_row_candidates(v_partner.member_row_id) c;
      v_named := '{}';
    else
      select coalesce(array_agg(c.person_id order by c.person_id), '{}'),
             coalesce(array_agg(c.person_id order by c.person_id) filter (where c.name_checked), '{}')
        into v_ids, v_named
        from public.gw_identity_candidates(v_partner.partner_name, v_partner.partner_email) c;
    end if;
    if cardinality(v_ids) = 1 and cardinality(v_named) = 1
       and public.gw_norm_email(v_partner.partner_email) is not null then
      perform public.gw_upsert_person_source('biglietto_partner', v_ref, v_ids[1], 'automatico',
        '{}', v_partner.partner_name, v_partner.partner_email, null, null, null, 'automatico_051', true);
    else
      perform public.gw_upsert_person_source('biglietto_partner', v_ref, null, 'da_confermare',
        v_ids, v_partner.partner_name, v_partner.partner_email,
        case when v_partner.member_row_id is not null then 'collegato al libro soci, non a una persona'
             when cardinality(v_ids) = 0 then 'nessuna persona corrispondente'
             when cardinality(v_ids) > 1 then 'più persone possibili (email condivisa o omonimi)'
             else 'nome da verificare' end,
        null, null, 'automatico_051', true);
    end if;
  end if;
end;
$$;

create function public.gw_register_ticket_sources(p_ticket_tailor_event_id text)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v record;
  v_count integer := 0;
begin
  for v in
    select e.id as event_id, t.ticket_tailor_issued_ticket_id as ticket_id
      from public.events e
      join public.ticket_tailor_issued_tickets t on t.ticket_tailor_event_id = e.ticket_tailor_event_id
     where e.ticket_tailor_event_id = p_ticket_tailor_event_id
       and t.ticket_tailor_issued_ticket_id is not null
  loop
    perform public.gw_register_ticket_source(v.event_id, v.ticket_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.gw_ticket_link_source_trigger()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_row record;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  perform public.gw_register_ticket_source(v_row.event_id, v_row.ticket_id);
  return null;
end;
$$;

create trigger gw_holder_person_source
after insert or update or delete on public.gw_peony_booking_holders
for each row execute function public.gw_ticket_link_source_trigger();
create trigger gw_partner_person_source
after insert or update or delete on public.gw_peony_booking_partners
for each row execute function public.gw_ticket_link_source_trigger();

-- ---------------------------------------------------------------------------
-- Contatti dell'Excel di Ale
-- ---------------------------------------------------------------------------
create function public.gw_sync_ale_contact_source(p_contact_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v record;
  v_ids uuid[];
  v_named uuid[];
begin
  select * into v from public.gw_ale_contacts where id = p_contact_id;
  if not found then
    delete from public.gw_person_sources
     where source_kind = 'contatto_ale' and source_ref = p_contact_id::text;
    return;
  end if;
  if public.gw_active_person(v.person_id) is not null then
    perform public.gw_upsert_person_source('contatto_ale', v.id::text,
      public.gw_active_person(v.person_id), 'confermato', '{}', v.display_name, v.email,
      null, null, v.linked_by, 'abbinamento_admin', true);
    return;
  end if;
  select coalesce(array_agg(c.person_id order by c.person_id), '{}'),
         coalesce(array_agg(c.person_id order by c.person_id) filter (where c.name_checked), '{}')
    into v_ids, v_named
    from public.gw_identity_candidates(v.display_name, v.email) c;
  if cardinality(v_ids) = 1 and cardinality(v_named) = 1 and public.gw_norm_email(v.email) is not null then
    perform public.gw_upsert_person_source('contatto_ale', v.id::text, v_ids[1], 'automatico',
      '{}', v.display_name, v.email, null, null, null, 'automatico_051', false);
  else
    perform public.gw_upsert_person_source('contatto_ale', v.id::text, null, 'da_confermare',
      v_ids, v.display_name, v.email,
      case when cardinality(v_ids) = 0 then 'nessuna persona corrispondente'
           when cardinality(v_ids) > 1 then 'più persone possibili (email condivisa o omonimi)'
           else 'nome o email da verificare' end,
      null, null, 'automatico_051', false);
  end if;
end;
$$;

create function public.gw_ale_contact_source_trigger()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  perform public.gw_sync_ale_contact_source(case when tg_op = 'DELETE' then old.id else new.id end);
  return null;
end;
$$;

create trigger gw_ale_contact_person_source
after insert or update of person_id, display_name, email or delete on public.gw_ale_contacts
for each row execute function public.gw_ale_contact_source_trigger();

-- Chiude da sola la coda dei contatti di Ale quando email E nome+cognome
-- indicano una sola persona. Restituisce quante righe ha chiuso.
create function public.gw_auto_match_ale_contacts()
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v record;
  v_before integer;
begin
  select count(*) into v_before from public.gw_person_sources
   where source_kind = 'contatto_ale' and status = 'automatico';
  for v in select c.id from public.gw_ale_contacts c loop
    perform public.gw_sync_ale_contact_source(v.id);
  end loop;
  return (select count(*) from public.gw_person_sources
           where source_kind = 'contatto_ale' and status = 'automatico') - v_before;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quote da email: il registro rispecchia l'allocazione
-- ---------------------------------------------------------------------------
create function public.gw_allocation_source_trigger()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_payer text;
begin
  if tg_op = 'DELETE' then
    delete from public.gw_person_sources
     where source_kind = 'quota_email' and source_ref = old.id::text;
    return null;
  end if;
  select e.payer_name into v_payer
    from public.gw_association_payment_emails e where e.id = new.payment_id;
  perform public.gw_upsert_person_source('quota_email', new.id::text,
    public.gw_active_person(new.person_id),
    case when public.gw_active_person(new.person_id) is null then 'da_confermare'
         else 'confermato' end::public.gw_link_status,
    '{}', v_payer, null,
    'quota ' || to_char(new.period_from, 'YYYY-MM-DD') || ', posto ' || new.slot
      || case when new.member_key is not null then ', assegnata a ' || new.member_key else '' end,
    null, new.validated_by, 'quota_email',
    -- Un'allocazione con persona è esplicita; senza persona non cancella
    -- una conferma fatta nel registro.
    public.gw_active_person(new.person_id) is not null);
  return null;
end;
$$;

create trigger gw_allocation_person_source
after insert or update or delete on public.gw_association_payment_allocations
for each row execute function public.gw_allocation_source_trigger();

-- ---------------------------------------------------------------------------
-- Decisione dell'admin sulle fonti senza un flusso proprio
-- (moduli, moduli cartacei, quote manuali, quote da email, libro ufficiale).
-- Iscrizioni, biglietti e contatti di Ale si decidono con i loro flussi
-- (abbinamento iscrizione, intestatario/partner TT, abbinamento contatto):
-- il registro li segue dai trigger sopra.
-- ---------------------------------------------------------------------------
create function public.gw_resolve_person_source(
  p_operator_id uuid,
  p_source_id uuid,
  p_version integer,
  p_action text,
  p_person_id uuid
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before public.gw_person_sources%rowtype;
  v_after public.gw_person_sources%rowtype;
  v_person uuid;
begin
  if not exists (select 1 from public.gw_operators
                 where id = p_operator_id and active and role = 'admin') then
    raise exception 'gw_forbidden' using errcode = 'GW403';
  end if;
  select * into v_before from public.gw_person_sources where id = p_source_id for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_before.version <> p_version then
    raise exception 'gw_conflict' using errcode = 'GW409';
  end if;
  if v_before.source_kind in ('iscrizione_workshop', 'biglietto_intestatario', 'biglietto_partner', 'contatto_ale') then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'Questa fonte si abbina dal suo flusso (iscrizione, biglietto o contatto).';
  end if;

  if p_action = 'conferma' then
    v_person := public.gw_active_person(p_person_id);
    if v_person is null then
      raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Persona non trovata.';
    end if;
    update public.gw_person_sources
       set person_id = v_person, status = 'confermato', candidate_ids = '{}',
           linked_by = p_operator_id, linked_at = now(),
           version = version + 1, updated_at = now()
     where id = p_source_id
     returning * into v_after;
  elsif p_action = 'rifiuta' then
    update public.gw_person_sources
       set person_id = null, status = 'rifiutato',
           linked_by = p_operator_id, linked_at = now(),
           version = version + 1, updated_at = now()
     where id = p_source_id
     returning * into v_after;
  else
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Azione non valida.';
  end if;

  perform public.gw_audit(p_operator_id, 'person_source', p_source_id, 'update',
    to_jsonb(v_before), to_jsonb(v_after));
  return jsonb_build_object('id', v_after.id, 'version', v_after.version, 'status', v_after.status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Riallineamento completo (dopo la 050 e quando serve): moduli e quote non
-- ancora registrati, tutti i biglietti TT, contatti di Ale, iscrizioni attive.
-- ---------------------------------------------------------------------------
-- Registra solo le righe di association_members non ancora presenti (quote
-- "Quota ok", moduli cartacei, righe arrivate senza passare dal trigger).
-- Leggera: il calcolo dello stato socio la chiama prima di leggere.
-- Le righe saltate di proposito (quote email, cartacei non verificati,
-- libro non collegato) restano fuori e vengono ricontrollate ogni volta:
-- sono poche e il controllo è una sola query.
create function public.gw_register_pending_member_rows()
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v record;
  v_rows integer := 0;
begin
  for v in
    select m.id from public.association_members m
     where (m.source in ('google_sheet', 'manual_override')
            or (m.source = 'manual_form' and m.membership_status = 'verified'))
       and not (m.source = 'manual_override'
                and coalesce(m.notes_admin, '') like 'Quota confermata da email (%')
       and not exists (select 1 from public.gw_person_sources s
                        where s.source_ref = m.id::text
                          and s.source_kind in ('modulo_google', 'modulo_cartaceo', 'quota_manuale'))
  loop
    perform public.gw_register_member_row_source(v.id);
    v_rows := v_rows + 1;
  end loop;
  return v_rows;
end;
$$;

create function public.gw_refresh_person_sources()
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v record;
  v_tickets integer := 0;
  v_rows integer;
  v_ale integer;
begin
  v_rows := public.gw_register_pending_member_rows();
  for v in
    select distinct e.ticket_tailor_event_id
      from public.events e
      join public.ticket_tailor_issued_tickets t on t.ticket_tailor_event_id = e.ticket_tailor_event_id
     where e.ticket_tailor_event_id is not null
  loop
    v_tickets := v_tickets + public.gw_register_ticket_sources(v.ticket_tailor_event_id);
  end loop;
  v_ale := public.gw_auto_match_ale_contacts();
  for v in
    select bp.id from public.gw_booking_participants bp
     where bp.removed_at is null and bp.deleted_at is null
  loop
    perform public.gw_sync_participant_source(v.id);
  end loop;
  return jsonb_build_object('righe_associazione', v_rows, 'biglietti', v_tickets,
                            'contatti_ale_chiusi', v_ale);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.gw_upsert_person_source(public.gw_source_kind, text, uuid, public.gw_link_status, uuid[], text, text, text, text, uuid, text, boolean)',
    'public.gw_identity_candidates(text, text)',
    'public.gw_register_member_row_source(uuid)',
    'public.gw_sync_participant_source(uuid)',
    'public.gw_participant_source_trigger()',
    'public.gw_register_ticket_source(uuid, text)',
    'public.gw_register_ticket_sources(text)',
    'public.gw_ticket_link_source_trigger()',
    'public.gw_sync_ale_contact_source(uuid)',
    'public.gw_ale_contact_source_trigger()',
    'public.gw_auto_match_ale_contacts()',
    'public.gw_allocation_source_trigger()',
    'public.gw_resolve_person_source(uuid, uuid, integer, text, uuid)',
    'public.gw_register_pending_member_rows()',
    'public.gw_refresh_person_sources()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Allineamento iniziale.
select public.gw_refresh_person_sources();

commit;
notify pgrst, 'reload schema';
