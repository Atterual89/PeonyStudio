-- Rollback di 020_gw_eliminazioni.sql: toglie colonne, guardie e funzioni
-- delle eliminazioni e rimette le funzioni come in 011–019.
--
-- Si interrompe se esistono righe eliminate: senza le colonne deleted_at
-- tornerebbero visibili e nei conti. In quel caso decidere prima a mano.

begin;

do $$
declare
  t text;
  n bigint;
begin
  if to_regprocedure('public.gw_restore_deleted(uuid, text, uuid)') is null then
    raise exception 'Rollback 020 interrotto: la migrazione 020 non risulta applicata';
  end if;
  foreach t in array array[
    'gw_workshops', 'gw_people', 'gw_bookings', 'gw_booking_participants',
    'gw_payments', 'gw_expenses', 'gw_transfers', 'gw_carryovers'
  ]
  loop
    execute format('select count(*) from public.%I where deleted_at is not null', t) into n;
    if n > 0 then
      raise exception 'Rollback 020 interrotto: % righe eliminate in %, tornerebbero visibili', n, t;
    end if;
  end loop;
end;
$$;

drop function public.gw_restore_deleted(uuid, text, uuid);
drop function public.gw_delete_workshop(uuid, uuid, integer, text);
drop function public.gw_delete_person(uuid, uuid, integer);
drop function public.gw_delete_booking(uuid, uuid, integer);
drop function public.gw_delete_payment(uuid, uuid);

do $$
declare
  t text;
begin
  foreach t in array array[
    'gw_workshops', 'gw_people', 'gw_bookings', 'gw_booking_participants',
    'gw_expenses', 'gw_transfers', 'gw_carryovers'
  ]
  loop
    execute format('drop trigger %I on public.%I', t || '_deleted_guard', t);
  end loop;
  foreach t in array array[
    'gw_bookings', 'gw_booking_participants', 'gw_payments', 'gw_expenses',
    'gw_transfers', 'gw_carryovers', 'gw_membership_overrides'
  ]
  loop
    execute format('drop trigger %I on public.%I', t || '_live_parents', t);
  end loop;
end;
$$;

drop function public.gw_live_parents_guard();
drop function public.gw_deleted_row_guard();

-- Funzioni come prima della 020.

CREATE OR REPLACE FUNCTION public.gw_payments_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.gw_raise_missing_or_conflict(p_table regclass, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_exists boolean;
begin
  execute format('select exists (select 1 from %s where id = $1)', p_table)
    into v_exists using p_id;

  if v_exists then
    raise exception 'gw_conflict' using errcode = 'GW409';
  end if;
  raise exception 'gw_not_found' using errcode = 'GW404';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gw_apply_auto_status(p_operator_id uuid, p_booking_id uuid)
 RETURNS gw_booking_status
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.gw_correct_payment(p_operator_id uuid, p_payment_id uuid, p_replacement jsonb, p_description text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.gw_sync_workshop_fee(p_operator_id uuid, p_workshop_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.gw_assert_can_enroll(p_workshop_id uuid, p_person_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_person gw_people;
begin
  select * into v_person from gw_people where id = p_person_id;
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
  ) then
    raise exception 'gw_already_enrolled' using errcode = 'GWDUP',
      detail = coalesce(v_person.nickname, btrim(concat_ws(' ', v_person.first_name, v_person.last_name)));
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gw_match_entered_person(p_operator_id uuid, p_workshop_id uuid, p_text text, p_exclude uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(out_person_id uuid, out_match_status gw_match_status, out_auto_created boolean, out_duplicate_of uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.gw_person_from_member(p_operator_id uuid, p_member_id uuid, p_fallback_text text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.gw_person_from_membership(p_operator_id uuid, p_member_id uuid, p_email text, p_first_name text, p_last_name text, p_fallback_text text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.gw_merge_people(p_operator_id uuid, p_primary_id uuid, p_primary_version integer, p_secondary_id uuid, p_secondary_version integer, p_values jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_primary gw_people;
  v_secondary gw_people;
  v_after gw_people;
  v_conflict text;
begin
  if p_primary_id = p_secondary_id then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Non puoi unire una persona con sé stessa.';
  end if;

  select * into v_primary from gw_people where id = p_primary_id and version = p_primary_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_people', p_primary_id);
  end if;
  select * into v_secondary from gw_people where id = p_secondary_id and version = p_secondary_version for update;
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
    join gw_workshops w on w.id = a.workshop_id
   where a.person_id = p_primary_id
     and a.removed_at is null;

  if v_conflict is not null then
    raise exception 'gw_merge_blocked' using errcode = 'GWMRG', detail = v_conflict;
  end if;

  update gw_booking_participants set person_id = p_primary_id where person_id = p_secondary_id;

  update gw_membership_overrides o
     set person_id = p_primary_id
   where o.person_id = p_secondary_id
     and not exists (
       select 1 from gw_membership_overrides p
        where p.person_id = p_primary_id and p.year = o.year
     );

  -- Persone unite in precedenza nella secondaria puntano ora alla principale.
  update gw_people set merged_into = p_primary_id where merged_into = p_secondary_id;

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
$function$
;

CREATE OR REPLACE FUNCTION public.gw_confirm_person_matches(p_operator_id uuid, p_person_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_booking_id uuid;
  v_before jsonb;
  v_count integer := 0;
begin
  for v_booking_id in
    select distinct booking_id from gw_booking_participants
     where person_id = p_person_id and removed_at is null and match_status <> 'confermato'
  loop
    v_before := gw_booking_snapshot(v_booking_id);
    update gw_booking_participants
       set match_status = 'confermato', auto_created_person = false, version = version + 1
     where booking_id = v_booking_id and person_id = p_person_id
       and removed_at is null and match_status <> 'confermato';
    perform gw_finish_match_change(p_operator_id, v_booking_id, v_before);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gw_delete_expense(p_operator_id uuid, p_id uuid, p_version integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_before gw_expenses;
begin
  select * into v_before from gw_expenses where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_expenses', p_id);
  end if;

  delete from gw_expenses where id = p_id;
  perform gw_audit(p_operator_id, 'expense', p_id, 'delete', to_jsonb(v_before), null);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gw_delete_transfer(p_operator_id uuid, p_id uuid, p_version integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_before gw_transfers;
begin
  select * into v_before from gw_transfers where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_transfers', p_id);
  end if;

  delete from gw_transfers where id = p_id;
  perform gw_audit(p_operator_id, 'transfer', p_id, 'delete', to_jsonb(v_before), null);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gw_delete_carryover(p_operator_id uuid, p_id uuid, p_version integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_before gw_carryovers;
begin
  select * into v_before from gw_carryovers where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_carryovers', p_id);
  end if;

  delete from gw_carryovers where id = p_id;
  perform gw_audit(p_operator_id, 'carryover', p_id, 'delete', to_jsonb(v_before), null);
end;
$function$
;

drop index public.gw_payments_deleted_idx;
drop index public.gw_booking_participants_active_key;
create unique index gw_booking_participants_active_key
  on public.gw_booking_participants (workshop_id, person_id)
  where removed_at is null;

do $$
declare
  t text;
begin
  foreach t in array array[
    'gw_workshops', 'gw_people', 'gw_bookings', 'gw_booking_participants',
    'gw_payments', 'gw_expenses', 'gw_transfers', 'gw_carryovers'
  ]
  loop
    execute format('alter table public.%I drop constraint %I', t, t || '_deleted_check');
    execute format('alter table public.%I drop column deleted_by', t);
    execute format('alter table public.%I drop column deleted_at', t);
  end loop;
end;
$$;

commit;

notify pgrst, 'reload schema';
