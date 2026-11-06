-- Rollback di 014_gw_correzioni_admin_v3b.sql
--
-- Tocca solo oggetti gw_. Ripristina gw_link_association_member (come in 011)
-- e gw_person_from_member (come in 013) ed elimina le funzioni nuove.
-- I campi delle persone già riempiti dal libro soci NON vengono svuotati
-- (i valori precedenti sono nello storico, gw_audit_log).

begin;

drop function if exists public.gw_update_booking_notes(uuid, uuid, integer, text);

-- Come in 011_gw_functions_v2.sql
create or replace function public.gw_link_association_member(
  p_operator_id uuid,
  p_person_id uuid,
  p_version integer,
  p_association_member_id uuid
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

  update gw_people
     set association_member_id = p_association_member_id,
         version = version + 1
   where id = p_person_id
  returning * into v_after;

  perform gw_audit(
    p_operator_id, 'person', p_person_id, 'update',
    jsonb_build_object('association_member_id', v_before.association_member_id),
    jsonb_build_object('association_member_id', v_after.association_member_id)
  );
  return v_after.version;
end;
$$;

-- Come in 013_gw_ruoli_pagamenti_v3.sql
create or replace function public.gw_person_from_member(p_operator_id uuid, p_member_id uuid, p_fallback_text text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_member record;
  v_linked uuid[];
begin
  select m.id, m.first_name, m.last_name, m.email
    into v_member
    from association_members m
   where m.id = p_member_id;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404', detail = 'Socio non trovato nel libro soci.';
  end if;

  select array_agg(p.id) into v_linked
    from gw_people p
   where p.merged_into is null and p.association_member_id = p_member_id;
  if coalesce(array_length(v_linked, 1), 0) = 1 then
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

-- Come in 013_gw_ruoli_pagamenti_v3.sql
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
      select array_agg(p.id) into v_linked
        from gw_people p
       where p.merged_into is null and p.association_member_id = any (v_member_rows);

      if coalesce(array_length(v_linked, 1), 0) = 1 then
        v_candidate := v_linked[1];
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

drop function if exists public.gw_fill_person_from_member(uuid, uuid);
drop function if exists public.gw_member_email(uuid);

notify pgrst, 'reload schema';

commit;
