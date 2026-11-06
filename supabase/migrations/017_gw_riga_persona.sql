-- Gestionale Workshop — riga persona semplificata (docs/gestionale/00-contesto.md sez. 9.3)
--
-- Tocca SOLO oggetti gw_. Legge (mai scrive) `association_members`.
-- Rollback: 017_gw_riga_persona.down.sql
--
--   - Quando l'admin modifica i dati di una persona (gw_update_person) o la
--     collega al libro soci (gw_set_membership_link), i suoi abbinamenti
--     "automatico" / "da abbinare" diventano "confermato" (gw_confirm_person_matches).
--   - gw_fill_person_fields: se il nome contiene nome e cognome insieme e il
--     cognome è vuoto, si separano con quelli del libro soci; se il nome
--     contiene già altre due parole, il cognome vuoto non si riempie.
--   - Dati esistenti: persone collegate al libro soci (per id o per email)
--     con nome e cognome presi/separati dalla tabella.

begin;

do $$
begin
  if to_regprocedure('public.gw_set_membership_link(uuid, uuid, integer, uuid, text, text, text)') is null then
    raise exception 'Migrazione 017 interrotta: applica prima 016_gw_soci_fonti_admin.sql';
  end if;
  if to_regprocedure('public.gw_confirm_person_matches(uuid, uuid)') is not null then
    raise exception 'Migrazione 017 interrotta: sembra già applicata (gw_confirm_person_matches esiste)';
  end if;
end;
$$;

-- Abbinamenti della persona ancora "automatico" o "da abbinare" → "confermato",
-- con storico della prenotazione (come "Conferma").
create function public.gw_confirm_person_matches(p_operator_id uuid, p_person_id uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
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
$$;

-- Come in 011, più la conferma degli abbinamenti.
create or replace function public.gw_update_person(
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
  v_before gw_people;
  v_after gw_people;
begin
  select * into v_before from gw_people where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_people', p_id);
  end if;
  if v_before.merged_into is not null then
    raise exception 'gw_person_merged' using errcode = 'GW400',
      detail = 'La persona è stata unita a un''altra scheda.';
  end if;

  update gw_people
     set first_name = gw_clean(p_data->>'first_name'),
         last_name = gw_clean(p_data->>'last_name'),
         nickname = gw_clean(p_data->>'nickname'),
         email = lower(gw_clean(p_data->>'email')),
         instagram = gw_clean(p_data->>'instagram'),
         phone = gw_clean(p_data->>'phone'),
         teamartist_id = gw_clean(p_data->>'teamartist_id'),
         notes = gw_clean(p_data->>'notes'),
         version = version + 1
   where id = p_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'person', p_id, 'update', to_jsonb(v_before), to_jsonb(v_after));
  -- 017: l'admin ha controllato i dati → gli abbinamenti sono confermati.
  perform gw_confirm_person_matches(p_operator_id, p_id);
  return (select version from gw_people where id = p_id);
end;
$$;

-- Come in 016, più la conferma degli abbinamenti.
create or replace function public.gw_set_membership_link(
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

  -- 017: collegata al libro soci dall'admin → abbinamenti confermati.
  if p_member_id is not null or gw_clean(p_email) is not null then
    perform gw_confirm_person_matches(p_operator_id, p_person_id);
  end if;

  return (select version from gw_people where id = p_person_id);
end;
$$;

-- Come in 016, più nome e cognome separati.
create or replace function public.gw_fill_person_fields(
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
  v_split boolean;
  v_fill_last boolean;
begin
  select * into v_before from gw_people where id = p_person_id for update;
  if not found then
    return false;
  end if;

  -- 017: "Livia Libro" nel nome e cognome vuoto → nome e cognome del libro soci.
  v_split := gw_clean(v_before.last_name) is null
             and gw_clean(p_first_name) is not null and gw_clean(p_last_name) is not null
             and gw_name_key(v_before.first_name) = gw_name_key(concat_ws(' ', p_first_name, p_last_name));
  -- Il cognome vuoto si riempie se il nome è vuoto, di una parola sola o uguale
  -- a quello del socio; non se il nome contiene già altre due parole ("Anna
  -- Rossi" + socio "Anna Bianchi" non diventa "Anna Rossi Bianchi").
  v_fill_last := v_split
                 or gw_clean(v_before.first_name) is null
                 or gw_name_key(v_before.first_name) is null
                 or gw_norm(v_before.first_name) = gw_norm(p_first_name);

  if not v_split
     and (gw_clean(v_before.first_name) is not null or gw_clean(p_first_name) is null)
     and (gw_clean(v_before.last_name) is not null or gw_clean(p_last_name) is null or not v_fill_last)
     and (gw_clean(v_before.email) is not null or v_email is null) then
    return false;
  end if;

  update gw_people
     set first_name = case when v_split then gw_clean(p_first_name) else coalesce(gw_clean(first_name), gw_clean(p_first_name)) end,
         last_name = case
                       when v_split then gw_clean(p_last_name)
                       when v_fill_last then coalesce(gw_clean(last_name), gw_clean(p_last_name))
                       else gw_clean(last_name)
                     end,
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

-- ---------------------------------------------------------------------------
-- Dati esistenti: nome, cognome (ed email vuota) dal libro soci (tabella),
-- solo campi vuoti o nome e cognome insieme nel nome. Persona collegata per id, per email
-- (membership_email) o con la stessa email; un solo socio con quel nome.
-- ---------------------------------------------------------------------------
do $$
declare
  v record;
begin
  for v in
    select p.id, n.first_name, n.last_name, n.email
      from gw_people p
      cross join lateral (
        select (array_agg(gw_clean(m.first_name) order by m.id))[1] as first_name,
               (array_agg(gw_clean(m.last_name) order by m.id))[1] as last_name,
               (array_agg(lower(gw_clean(m.email)) order by m.id))[1] as email
          from association_members m
         where gw_clean(m.first_name) is not null
           and gw_clean(m.last_name) is not null
           and (
             m.id = p.association_member_id
             or (p.association_member_id is null
                 and gw_clean(m.email) is not null
                 and lower(btrim(m.email)) = coalesce(p.membership_email, lower(btrim(p.email))))
           )
        having count(distinct gw_name_key(concat_ws(' ', m.first_name, m.last_name))) = 1
      ) n
     where p.merged_into is null
     order by p.created_at
  loop
    perform gw_fill_person_fields(null, v.id, v.first_name, v.last_name, v.email);
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
    'public.gw_confirm_person_matches(uuid, uuid)',
    'public.gw_update_person(uuid, uuid, integer, jsonb)',
    'public.gw_set_membership_link(uuid, uuid, integer, uuid, text, text, text)',
    'public.gw_fill_person_fields(uuid, uuid, text, text, text)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- PostgREST: ricarica lo schema per vedere le funzioni nuove.
notify pgrst, 'reload schema';

commit;
