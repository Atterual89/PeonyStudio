-- Rollback di 023_gw_richieste_associazione.sql: toglie i contatti per le
-- richieste di associazione (tabella, funzioni, tipo). I contatti registrati
-- si perdono; lo storico (gw_audit_log) resta. gw_import_roster torna come
-- in 019 (senza forced_status). Parte B2: si perdono gli altri nomi e le
-- email scritte da Ale (le email già copiate nelle schede restano).

begin;

-- gw_import_roster com'era in 019 (senza forced_status).
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
  end loop;

  perform gw_audit(p_operator_id, 'workshop', p_workshop_id, 'insert', null,
                   jsonb_build_object('origine', 'importazione testo', 'iscrizioni_create', v_created,
                                      'iscrizioni_aggiornate', v_updated, 'pagamenti', v_payments,
                                      'data_pagamenti', p_paid_on));

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'payments', v_payments);
end;
$$;


-- B2: abbinamento e iscrizioni di Ale come in 020 / 015.
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

  -- D19 (015): una quota indicata (matita di "Aggiungi", "X€/" nel testo
  -- importato) è sempre una tariffa dedicata; senza, segue il workshop.
  insert into gw_bookings (workshop_id, status, agreed_fee_cents, fee_custom, notes, created_by)
  values (p_workshop_id, coalesce(p_status, 'prenotato'), v_fee,
          p_fee_cents is not null,
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

drop function public.gw_create_person_with_aliases(uuid, jsonb, jsonb);
drop function public.gw_delete_person_alias(uuid, uuid);
drop function public.gw_add_person_alias(uuid, uuid, text);
drop function public.gw_person_label(uuid);
drop function public.gw_set_entered_email(uuid, uuid, text);
drop function public.gw_apply_entered_email(uuid, uuid);
drop function public.gw_entered_email(text);
drop table public.gw_person_aliases;
alter table public.gw_booking_participants drop column entered_email;

drop function public.gw_restore_membership_contact(uuid, uuid);
drop function public.gw_delete_membership_contact(uuid, uuid);
drop function public.gw_add_membership_contacts(uuid, uuid[], text, date);
drop function public.gw_add_membership_contact(uuid, uuid, text, date, text);
drop table public.gw_membership_contacts;
drop function public.gw_live_person_guard();
drop type public.gw_contact_kind;

commit;

notify pgrst, 'reload schema';
