-- Alimentazione automatica dell'anagrafica centrale dai moduli Google.
-- Nessun pagamento viene creato o verificato, Team Artist non è coinvolto.
-- Correlazioni con email condivise o nominativi ripetuti restano in revisione.
-- L'accesso alla vista completa rimane riservato agli admin del gestionale.

create or replace function public.gw_ensure_person_from_google_form(p_form_id uuid)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_form public.association_members%rowtype;
  v_email text;
  v_key text;
  v_person_id uuid;
  v_people_count integer;
  v_person_name text;
begin
  select * into v_form from public.association_members
    where id=p_form_id and source='google_sheet';
  if not found then return 'skipped'; end if;

  v_email := nullif(lower(btrim(coalesce(v_form.email,''))),'');
  v_key := public.gw_name_key(concat_ws(' ',v_form.first_name,v_form.last_name));
  if v_email is null or position('@' in v_email)<2 or v_key is null or
     public.gw_clean(v_form.first_name) is null then
    return 'review';
  end if;

  -- Due sync contemporanee della stessa email non devono creare due schede.
  perform pg_advisory_xact_lock(hashtextextended('gw_google_person:'||v_email,0));

  -- Una email condivisa da domande intestate a persone diverse richiede review.
  if exists(
    select 1 from public.association_members m
    where m.source='google_sheet' and lower(btrim(coalesce(m.email,'')))=v_email
      and (public.gw_name_key(concat_ws(' ',m.first_name,m.last_name))
           is distinct from v_key)
  ) then return 'review'; end if;

  select count(*) into v_people_count from public.gw_people p
    where p.deleted_at is null and p.merged_into is null and
      lower(btrim(coalesce(p.email,'')))=v_email;
  if v_people_count>1 then return 'review'; end if;
  if v_people_count=1 then
    -- Non alterare una scheda esistente se la email è già condivisa: l'admin
    -- può verificare il secondo nome e completare i link nella stessa scheda.
    return 'existing';
  end if;

  -- Stesso nome già presente con email diversa: possibile seconda email o
  -- omonimia, non generare una seconda persona automaticamente.
  if exists(
    select 1 from public.gw_people p
    where p.deleted_at is null and p.merged_into is null and
      public.gw_name_key(concat_ws(' ',p.first_name,p.last_name))=v_key
  ) then return 'review'; end if;

  insert into public.gw_people
    (first_name,last_name,email,membership_email,notes,created_by)
  values
    (public.gw_clean(v_form.first_name),
     public.gw_clean(v_form.last_name),
     v_email,v_email,'Creata automaticamente da modulo Google',null)
  returning id into v_person_id;

  -- Operatore null = importazione automatica, non imputata a un admin umano.
  perform public.gw_audit(
    null,'person',v_person_id,'insert',null,
    (select to_jsonb(p) from public.gw_people p where p.id=v_person_id)
  );
  return 'created';
end;
$$;

revoke all on function public.gw_ensure_person_from_google_form(uuid)
  from PUBLIC, anon, authenticated;
grant execute on function public.gw_ensure_person_from_google_form(uuid) to service_role;

create or replace function public.gw_google_form_person_trigger()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.source='google_sheet' then
    perform public.gw_ensure_person_from_google_form(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists gw_create_google_form_person on public.association_members;
create trigger gw_create_google_form_person
after insert or update of email,first_name,last_name,source
on public.association_members
for each row when (new.source='google_sheet')
execute function public.gw_google_form_person_trigger();

-- Riallineamento iniziale: un solo form canonico per email; le copie storiche
-- dello stesso modulo non generano ulteriori anagrafiche.
do $$
declare
  v_row record;
begin
  for v_row in
    select distinct on (lower(btrim(email))) id
    from public.association_members
    where source='google_sheet' and email is not null and btrim(email)<>''
    order by lower(btrim(email)),id
  loop
    perform public.gw_ensure_person_from_google_form(v_row.id);
  end loop;
end;
$$;
