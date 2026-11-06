-- Rollback di 017_gw_riga_persona.sql
--
-- Tocca solo oggetti gw_. Ripristina gw_update_person (come in 011),
-- gw_set_membership_link e gw_fill_person_fields (come in 016) ed elimina
-- gw_confirm_person_matches. Abbinamenti confermati e nomi separati restano
-- (i valori precedenti sono nello storico, gw_audit_log).

begin;

-- Come in 011_gw_functions_v2.sql
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
  return v_after.version;
end;
$$;

-- Come in 016_gw_soci_fonti_admin.sql
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

  return (select version from gw_people where id = p_person_id);
end;
$$;

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
begin
  select * into v_before from gw_people where id = p_person_id for update;
  if not found then
    return false;
  end if;

  if (gw_clean(v_before.first_name) is not null or gw_clean(p_first_name) is null)
     and (gw_clean(v_before.last_name) is not null or gw_clean(p_last_name) is null)
     and (gw_clean(v_before.email) is not null or v_email is null) then
    return false;
  end if;

  update gw_people
     set first_name = coalesce(gw_clean(first_name), gw_clean(p_first_name)),
         last_name = coalesce(gw_clean(last_name), gw_clean(p_last_name)),
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

drop function if exists public.gw_confirm_person_matches(uuid, uuid);

notify pgrst, 'reload schema';

commit;
