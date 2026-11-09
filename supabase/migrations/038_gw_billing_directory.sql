-- Anagrafica fiscale condivisa Peony / organizzatrice.
-- Dati di fatturazione separati da dati soci, quota e nickname.
create table if not exists public.gw_billing_profiles (
  person_id uuid primary key references public.gw_people(id) on delete restrict,
  owner_operator_id uuid not null references public.gw_operators(id),
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gw_billing_profiles_owner_idx on public.gw_billing_profiles(owner_operator_id);
create table if not exists public.gw_billing_import_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_operator_id uuid not null references public.gw_operators(id),
  fingerprint text not null,
  first_name text not null,
  last_name text not null,
  email text,
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields)='object'),
  reason text not null check(reason in ('omonimi','duplicato_file')),
  status text not null default 'pending' check(status in ('pending','resolved')),
  candidate_ids uuid[] not null default '{}'::uuid[],
  resolved_person_id uuid references public.gw_people(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (owner_operator_id, fingerprint)
);
create index if not exists gw_billing_import_reviews_owner_idx on public.gw_billing_import_reviews(owner_operator_id,status,created_at desc);
alter table public.gw_billing_profiles enable row level security;
alter table public.gw_billing_import_reviews enable row level security;
revoke all on public.gw_billing_profiles, public.gw_billing_import_reviews from public, anon, authenticated;
grant select, insert, update, delete on public.gw_billing_profiles, public.gw_billing_import_reviews to service_role;

-- Import transazionale: mai unisce omonimi o righe duplicate nello stesso file.
create or replace function public.gw_import_billing_rows(p_operator_id uuid, p_rows jsonb)
returns jsonb language plpgsql set search_path to 'public','pg_temp'
as $$
declare
  v_row jsonb;
  v_first text; v_last text; v_email text; v_key text;
  v_fields jsonb; v_counts jsonb := '{}'::jsonb;
  v_candidates uuid[]; v_person uuid; v_fingerprint text;
  v_created int := 0; v_matched int := 0; v_review int := 0; v_skipped int := 0;
  v_reason text;
begin
  perform 1 from gw_operators where id=p_operator_id and active and role in ('admin','organizzatrice');
  if not found then raise exception 'gw_forbidden' using errcode='GW403'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 1000
  then raise exception 'gw_invalid' using errcode='GW400', detail='Numero di righe non valido.'; end if;
  -- Controlla prima l'intero file, per non fondere due omonimi presenti nello stesso file.
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_first := nullif(btrim(v_row->>'first_name'),'');
    v_last := nullif(btrim(v_row->>'last_name'),'');
    if v_first is not null and v_last is not null then
      v_key := gw_norm(v_first || ' ' || v_last);
      v_counts := jsonb_set(v_counts, array[v_key],
        to_jsonb(coalesce((v_counts->>v_key)::integer,0)+1), true);
    end if;
  end loop;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_first := nullif(btrim(v_row->>'first_name'),'');
    v_last := nullif(btrim(v_row->>'last_name'),'');
    v_email := nullif(lower(btrim(v_row->>'email')),'');
    v_fields := v_row->'fields';
    if v_first is null or v_last is null or length(v_first)>150 or length(v_last)>150
       or jsonb_typeof(v_fields) is distinct from 'object' or length(v_fields::text)>16000
    then v_skipped := v_skipped + 1; continue; end if;
    v_key := gw_norm(v_first || ' ' || v_last);
    if v_key is null or length(v_key)<3 then v_skipped := v_skipped+1; continue; end if;
    -- Blocco le importazioni concorrenti dello stesso nominativo.
    perform pg_advisory_xact_lock(hashtext(v_key));
    select array_agg(p.id order by p.created_at,p.id) into v_candidates from gw_people p
      where p.deleted_at is null and p.merged_into is null
        and p.first_name is not null and p.last_name is not null
        and gw_norm(concat_ws(' ',p.first_name,p.last_name))=v_key;
    v_reason := null;
    if coalesce((v_counts->>v_key)::integer,0)>1 then v_reason := 'duplicato_file';
    elsif coalesce(cardinality(v_candidates),0)>1 then v_reason := 'omonimi';
    end if;
    if v_reason is not null then
      v_fingerprint := md5(v_key || '|' || coalesce(v_email,'') || '|' || v_fields::text);
      insert into gw_billing_import_reviews
        (owner_operator_id,fingerprint,first_name,last_name,email,fields,reason,candidate_ids)
      values (p_operator_id,v_fingerprint,v_first,v_last,v_email,v_fields,v_reason,coalesce(v_candidates,'{}'::uuid[]))
      on conflict (owner_operator_id,fingerprint) do update set
        fields=excluded.fields,reason=excluded.reason,
        candidate_ids=excluded.candidate_ids
      where gw_billing_import_reviews.status='pending';
      v_review := v_review+1; continue;
    end if;
    if coalesce(cardinality(v_candidates),0)=1 then
      v_person := v_candidates[1];
      v_matched := v_matched+1;
    else
      insert into gw_people(first_name,last_name,email,created_by)
      values (v_first,v_last,v_email,p_operator_id) returning id into v_person;
      v_created := v_created+1;
    end if;
    insert into gw_billing_profiles(person_id,owner_operator_id,fields)
    values (v_person,p_operator_id,v_fields)
    on conflict (person_id) do update set
      fields=gw_billing_profiles.fields || excluded.fields,
      updated_at=now();
  end loop;
  return jsonb_build_object('created',v_created,'matched',v_matched,'review',v_review,'skipped',v_skipped);
end;
$$;
revoke all on function public.gw_import_billing_rows(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.gw_import_billing_rows(uuid,jsonb) to service_role;

create or replace function public.gw_resolve_billing_review(p_operator_id uuid,p_review_id uuid,p_person_id uuid default null)
returns uuid language plpgsql set search_path to 'public','pg_temp'
as $$
declare v_review gw_billing_import_reviews; v_person uuid;
begin
  perform 1 from gw_operators where id=p_operator_id and active and role in ('admin','organizzatrice');
  if not found then raise exception 'gw_forbidden' using errcode='GW403'; end if;
  select * into v_review from gw_billing_import_reviews
    where id=p_review_id and owner_operator_id=p_operator_id and status='pending'
    for update;
  if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
  if p_person_id is null then
    insert into gw_people(first_name,last_name,email,created_by)
    values (v_review.first_name,v_review.last_name,v_review.email,p_operator_id)
    returning id into v_person;
  else
    select id into v_person from gw_people where id=p_person_id and deleted_at is null and merged_into is null;
    if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
    -- Vietato collegare una riga fiscale a un nominativo diverso senza intervento admin.
    if gw_norm(concat_ws(' ',v_review.first_name,v_review.last_name)) <>
       (select gw_norm(concat_ws(' ',first_name,last_name)) from gw_people where id=v_person)
    then raise exception 'gw_invalid' using errcode='GW400', detail='Nome e cognome diversi.'; end if;
  end if;
  insert into gw_billing_profiles(person_id,owner_operator_id,fields)
  values(v_person,p_operator_id,v_review.fields)
  on conflict (person_id) do update set
    fields=gw_billing_profiles.fields || excluded.fields,updated_at=now();
  update gw_billing_import_reviews set status='resolved',resolved_person_id=v_person,resolved_at=now()
    where id=p_review_id;
  return v_person;
end;
$$;
revoke all on function public.gw_resolve_billing_review(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.gw_resolve_billing_review(uuid,uuid,uuid) to service_role;

-- Abbinamento esplicito sicuro da anagrafica fiscale, senza cambiare il flusso legacy.
CREATE OR REPLACE FUNCTION public.gw_create_booking_entered(p_operator_id uuid, p_workshop_id uuid, p_entries jsonb, p_status gw_booking_status, p_fee_cents bigint, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_workshop gw_workshops;
  v_booking_id uuid;
  v_fee bigint;
  v_entry jsonb;
  v_text text;
  v_email text;
  v_ord bigint;
  v_match record;
  v_ids uuid[];
  v_participant_id uuid;
  v_person_ids uuid[] := '{}';
  v_selected_id uuid;
begin
  select * into v_workshop from gw_workshops where id = p_workshop_id;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if v_workshop.default_fee_cents is null then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Imposta prima la quota del workshop.';
  end if;
  -- 4d (B2): ogni voce è il testo scritto da Ale oppure {"text", "email"}.
  if jsonb_typeof(p_entries) is distinct from 'array'
     or jsonb_array_length(p_entries) not between 1 and 2
     or exists (select 1 from jsonb_array_elements(p_entries) e
                 where gw_clean(case jsonb_typeof(e) when 'string' then e #>> '{}' when 'object' then e->>'text' end) is null) then
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

  for v_entry, v_ord in
    select e, o from jsonb_array_elements(p_entries) with ordinality as x(e, o)
  loop
    v_text := case jsonb_typeof(v_entry) when 'string' then v_entry #>> '{}' else v_entry->>'text' end;
    v_email := case when jsonb_typeof(v_entry) = 'object' then gw_entered_email(v_entry->>'email') end;
    v_match := null;

    -- Email scritta da Ale: la regola più forte. Una sola persona con quella
    -- email, non già iscritta né già scelta nella coppia → collegata.
    -- Selezione esplicita nell'anagrafica fiscale di Alessandra. Il server
    -- controlla proprietà, identità ufficiale e iscrizione duplicata.
    if jsonb_typeof(v_entry) = 'object' and nullif(v_entry->>'person_id','') is not null then
      begin
        v_selected_id := (v_entry->>'person_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'gw_invalid' using errcode='GW400', detail='Persona selezionata non valida.';
      end;
      select p.id into v_selected_id from gw_people p
        join gw_billing_profiles b on b.person_id=p.id
        where p.id=v_selected_id and b.owner_operator_id=p_operator_id
          and p.deleted_at is null and p.merged_into is null
          and gw_norm(concat_ws(' ',p.first_name,p.last_name))=gw_norm(v_text);
      if not found then
        raise exception 'gw_invalid' using errcode='GW400', detail='Ricarica la persona selezionata.';
      end if;
      if v_selected_id = any(v_person_ids)
         or exists(select 1 from gw_booking_participants
             where workshop_id=p_workshop_id and person_id=v_selected_id
               and removed_at is null and deleted_at is null) then
        raise exception 'gw_invalid' using errcode='GW400', detail='Persona gia iscritta a questo workshop.';
      end if;
      select v_selected_id as out_person_id, 'confermato'::gw_match_status as out_match_status,
             false as out_auto_created, null::uuid as out_duplicate_of into v_match;
    end if;
    if v_match is null and v_email is not null then
      select array_agg(p.id) into v_ids
        from gw_people p
       where p.merged_into is null and p.deleted_at is null and lower(btrim(p.email)) = v_email;
      if coalesce(array_length(v_ids, 1), 0) = 1
         and not v_ids[1] = any (v_person_ids)
         and not exists (select 1 from gw_booking_participants
                          where workshop_id = p_workshop_id and person_id = v_ids[1]
                            and removed_at is null and deleted_at is null) then
        select v_ids[1] as out_person_id, 'automatico'::gw_match_status as out_match_status,
               false as out_auto_created, null::uuid as out_duplicate_of
          into v_match;
      end if;
    end if;
    if v_match is null then
      select * into v_match from gw_match_entered_person(p_operator_id, p_workshop_id, v_text, v_person_ids);
    end if;

    insert into gw_booking_participants (
      booking_id, workshop_id, person_id, is_primary,
      entered_as, entered_email, match_status, auto_created_person, possible_duplicate_person_id
    ) values (
      v_booking_id, p_workshop_id, v_match.out_person_id, v_ord = 1,
      regexp_replace(gw_clean(v_text), '\s+', ' ', 'g'), v_email, v_match.out_match_status,
      v_match.out_auto_created, v_match.out_duplicate_of
    )
    returning id into v_participant_id;
    perform gw_apply_entered_email(p_operator_id, v_participant_id);
    v_person_ids := v_person_ids || v_match.out_person_id;
  end loop;

  perform gw_audit(p_operator_id, 'booking', v_booking_id, 'insert', null, gw_booking_snapshot(v_booking_id));
  return v_booking_id;
end;
$function$
;
