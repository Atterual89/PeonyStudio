-- Rollback di 052_gw_person_sources_fixes.sql: ripristina le funzioni della 051.
begin;

create or replace function public.gw_identity_candidates(p_name text, p_email text)
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

create or replace function public.gw_allocation_source_trigger()
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

drop function if exists public.gw_sync_allocation_source(uuid);
drop function if exists public.gw_member_key_candidates(text);
drop function if exists public.gw_email_known(text);

commit;
notify pgrst, 'reload schema';
