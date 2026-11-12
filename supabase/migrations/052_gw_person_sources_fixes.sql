-- 052 — Fase C, correzioni dopo il primo confronto (12 nov 2026).
--
-- 1. Quote da email assegnate a un socio del libro soci ("m:", "e:", "n:")
--    invece che a una persona: ora si collegano alla persona quando la chiave
--    indica una sola persona (prima la quota non risultava a nessuno e chi era
--    in regola passava a "quota mancante").
-- 2. Biglietti e contatti di Ale con un'email che non è in anagrafica: si
--    propongono le persone con lo stesso nome e cognome (sempre da confermare,
--    mai automatico: manca la prova dell'email).
--
-- Solo funzioni gw_; nessuna tabella del sito. Rollback: 052_...down.sql.
begin;

do $$ begin
  if to_regprocedure('public.gw_register_member_row_source(uuid)') is null then
    raise exception 'Applicare prima la migrazione 051';
  end if;
  if to_regprocedure('public.gw_sync_allocation_source(uuid)') is not null then
    raise exception 'Migrazione 052 già applicata';
  end if;
end $$;

-- L'email è di qualcuno in anagrafica?
create function public.gw_email_known(p_email text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select public.gw_norm_email(p_email) is not null and exists (
    select 1 from public.gw_people p
     where p.deleted_at is null and p.merged_into is null
       and (public.gw_norm_email(p.email) = public.gw_norm_email(p_email)
            or public.gw_norm_email(p.membership_email) = public.gw_norm_email(p_email)));
$$;

-- Candidati: per email; se l'email non è di nessuno (o manca), per nome e
-- cognome (anche il nome del socio collegato a mano). name_checked = email
-- uguale E nome compatibile: è l'unica condizione per l'automatico.
create or replace function public.gw_identity_candidates(p_name text, p_email text)
returns table (person_id uuid, name_checked boolean)
language sql
stable
set search_path = public, pg_temp
as $$
  with t as (
    select public.gw_norm_email(p_email) as em, public.gw_name_key(p_name) as nk, p_name as nm
  ), by_email as (
    select p.id,
           coalesce(public.gw_names_compatible(concat_ws(' ', p.first_name, p.last_name), t.nm), false) as ok
    from public.gw_people p, t
    where p.deleted_at is null and p.merged_into is null
      and t.em is not null
      and (public.gw_norm_email(p.email) = t.em or public.gw_norm_email(p.membership_email) = t.em)
  )
  select id, ok from by_email
  union
  select p.id, false
  from public.gw_people p, t
  where not exists (select 1 from by_email)
    and p.deleted_at is null and p.merged_into is null
    and t.nk is not null and position(' ' in t.nk) > 0
    and (public.gw_name_key(concat_ws(' ', p.first_name, p.last_name)) = t.nk
         or public.gw_name_key(p.membership_name_key) = t.nk);
$$;

-- Persone indicate da una chiave socio dell'admin ("m:<id>", "e:<email>", "n:<nome>").
-- explicit = collegamento salvato dall'admin sulla persona o email unica.
create function public.gw_member_key_candidates(p_member_key text)
returns table (person_id uuid, explicit boolean)
language sql
stable
set search_path = public, pg_temp
as $$
  with k as (
    select left(p_member_key, 2) as kind, substr(p_member_key, 3) as v
  )
  select c.person_id, c.explicit or c.name_checked
    from k, public.gw_member_row_candidates(
      case when k.kind = 'm:' and k.v ~ '^[0-9a-f-]{36}$' then k.v::uuid end) c
   where k.kind = 'm:'
  union
  select p.id, true
    from k, public.gw_people p
   where k.kind = 'e:' and p.deleted_at is null and p.merged_into is null
     and public.gw_norm_email(k.v) is not null
     and (public.gw_norm_email(p.email) = public.gw_norm_email(k.v)
          or public.gw_norm_email(p.membership_email) = public.gw_norm_email(k.v))
  union
  select p.id, coalesce(public.gw_name_key(p.membership_name_key) = public.gw_name_key(k.v), false)
    from k, public.gw_people p
   where k.kind = 'n:' and p.deleted_at is null and p.merged_into is null
     and public.gw_name_key(k.v) is not null
     and (public.gw_name_key(p.membership_name_key) = public.gw_name_key(k.v)
          or public.gw_name_key(concat_ws(' ', p.first_name, p.last_name)) = public.gw_name_key(k.v));
$$;

create function public.gw_sync_allocation_source(p_allocation_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  a record;
  v_payer text;
  v_ids uuid[];
  v_explicit uuid[];
  v_note text;
begin
  select * into a from public.gw_association_payment_allocations where id = p_allocation_id;
  if not found then
    delete from public.gw_person_sources
     where source_kind = 'quota_email' and source_ref = p_allocation_id::text;
    return;
  end if;
  select e.payer_name into v_payer
    from public.gw_association_payment_emails e where e.id = a.payment_id;
  v_note := 'quota ' || to_char(a.period_from, 'YYYY-MM-DD') || ', posto ' || a.slot
    || case when a.member_key is not null then ', assegnata a ' || a.member_key else '' end;

  if public.gw_active_person(a.person_id) is not null then
    perform public.gw_upsert_person_source('quota_email', a.id::text, public.gw_active_person(a.person_id),
      'confermato', '{}', v_payer, null, v_note, null, a.validated_by, 'quota_email', true);
    return;
  end if;

  select coalesce(array_agg(distinct c.person_id), '{}'),
         coalesce(array_agg(distinct c.person_id) filter (where c.explicit), '{}')
    into v_ids, v_explicit
    from public.gw_member_key_candidates(a.member_key) c;
  if cardinality(v_ids) = 1 and cardinality(v_explicit) = 1 then
    -- L'admin ha già scelto il socio; la chiave porta a una sola persona.
    perform public.gw_upsert_person_source('quota_email', a.id::text, v_ids[1], 'automatico',
      '{}', v_payer, null, v_note, null, null, 'quota_email', false);
  else
    perform public.gw_upsert_person_source('quota_email', a.id::text, null, 'da_confermare',
      v_ids, v_payer, null,
      v_note || case when cardinality(v_ids) = 0 then ' · nessuna persona per questo socio'
                     when cardinality(v_ids) > 1 then ' · più persone possibili'
                     else ' · persona da confermare' end,
      null, null, 'quota_email', false);
  end if;
end;
$$;

create or replace function public.gw_allocation_source_trigger()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  perform public.gw_sync_allocation_source(case when tg_op = 'DELETE' then old.id else new.id end);
  return null;
end;
$$;

create or replace function public.gw_register_ticket_source(p_event_id uuid, p_ticket_id text)
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
             when cardinality(v_ids) = 0 then 'nessuna persona con questa email né con questo nome'
             when not public.gw_email_known(v_ticket.holder_email) then
               case when cardinality(v_ids) = 1 then 'email diversa, stesso nome in anagrafica'
                    else 'email diversa, più persone con questo nome' end
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
             when not public.gw_email_known(v_partner.partner_email) then
               case when cardinality(v_ids) = 1 then 'stesso nome in anagrafica, email da verificare'
                    else 'più persone con questo nome' end
             when cardinality(v_ids) > 1 then 'più persone possibili (email condivisa o omonimi)'
             else 'nome da verificare' end,
        null, null, 'automatico_051', true);
    end if;
  end if;
end;
$$;

-- Riallinea le fonti toccate dalle correzioni.
do $$
declare v record;
begin
  for v in select id from public.gw_association_payment_allocations loop
    perform public.gw_sync_allocation_source(v.id);
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.gw_email_known(text)',
    'public.gw_identity_candidates(text, text)',
    'public.gw_member_key_candidates(text)',
    'public.gw_sync_allocation_source(uuid)',
    'public.gw_allocation_source_trigger()',
    'public.gw_register_ticket_source(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

select public.gw_refresh_person_sources();

commit;
notify pgrst, 'reload schema';
