-- Rollback di 015_gw_quota_workshop_v3c.sql
--
-- Tocca solo oggetti gw_. Ripristina gw_update_workshop_settings (come in
-- 012), gw_create_booking_entered, gw_update_registration e
-- gw_apply_standard_fee (come in 013) ed
-- elimina le funzioni nuove. Le quote e i fee_custom già sistemati NON
-- tornano indietro (i valori precedenti sono nello storico, gw_audit_log).

begin;

drop function if exists public.gw_set_booking_fee(uuid, uuid, integer, bigint);
drop function if exists public.gw_update_registration(
  uuid, uuid, integer, public.gw_booking_status, text, public.gw_invoice_status
);
drop function if exists public.gw_update_workshop_settings(uuid, uuid, integer, jsonb);
drop function if exists public.gw_sync_workshop_fee(uuid, uuid);

-- Come in 012_gw_correzioni_v2b.sql
create function public.gw_update_workshop_settings(
  p_operator_id uuid,
  p_id uuid,
  p_version integer,
  p_data jsonb
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_workshops;
  v_after gw_workshops;
begin
  select * into v_before from gw_workshops where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_workshops', p_id);
  end if;

  update gw_workshops
     set description = gw_clean(p_data->>'description'),
         capacity = (gw_clean(p_data->>'capacity'))::integer,
         default_fee_cents = (gw_clean(p_data->>'default_fee_cents'))::bigint,
         peony_pct = coalesce((gw_clean(p_data->>'peony_pct'))::numeric, 30),
         version = version + 1
   where id = p_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'workshop', p_id, 'update', to_jsonb(v_before), to_jsonb(v_after));
  return v_after.version;
end;
$$;

-- Come in 013_gw_ruoli_pagamenti_v3.sql
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

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.gw_update_workshop_settings(uuid, uuid, integer, jsonb)',
    'public.gw_update_registration(uuid, uuid, integer, public.gw_booking_status, text, public.gw_invoice_status, bigint)',
    'public.gw_apply_standard_fee(uuid, uuid, text, integer)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
