-- Permetti la conservazione dell'ultima versione Google verificata dalla fonte.
-- Accetta come differenze solo hash e scadenza, senza cambiare quote o pagamenti.
begin;
drop function if exists public.gw_consolidate_identical_google_form_copies(text,uuid);
create function public.gw_consolidate_identical_google_form_copies(
 p_source_row_id text, p_operator_id uuid, p_expected_source_hash text
) returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 v_rows public.association_members[];
 v_row public.association_members%rowtype;
 v_first public.association_members%rowtype;
 v_canonical public.association_members%rowtype;
 v_linked uuid[];
 v_count integer;
 v_removed integer:=0;
begin
 if p_operator_id is null or p_source_row_id !~ '^(eng:)?[0-9]{1,7}$'
   or p_expected_source_hash !~ '^[0-9a-f]{64}$'
 then raise exception 'Riferimento o versione Google non validi'; end if;
 perform pg_advisory_xact_lock(hashtext('google_form:'||p_source_row_id));
 select array_agg(r order by r.created_at nulls last,r.id) into v_rows
 from (select * from public.association_members
       where source='google_sheet' and source_row_id=p_source_row_id for update) r;
 v_count:=coalesce(array_length(v_rows,1),0);
 if v_count<2 then raise exception 'Nessuna copia da consolidare'; end if;
 v_first:=v_rows[1];
 -- Tutte le versioni devono riferirsi alla stessa persona, stessa compilazione.
 -- Sono ammesse solo variazioni di hash e scadenza associate alla versione Google.
 foreach v_row in array v_rows loop
  if row(v_row.first_name,v_row.last_name,v_row.email,v_row.contact,
    v_row.membership_status,v_row.membership_starts_at,
    v_row.source,v_row.source_row_id,v_row.notes_admin,
    v_row.fiscal_code,v_row.birth_date,v_row.membership_card_number)
   is distinct from
   row(v_first.first_name,v_first.last_name,v_first.email,v_first.contact,
    v_first.membership_status,v_first.membership_starts_at,
    v_first.source,v_first.source_row_id,v_first.notes_admin,
    v_first.fiscal_code,v_first.birth_date,v_first.membership_card_number)
  then raise exception 'Dati anagrafici diversi: revisione manuale necessaria'; end if;
 end loop;
 select array_agg(distinct association_member_id) into v_linked
 from public.gw_people where association_member_id=any(array(select (x).id from unnest(v_rows) x));
 if coalesce(array_length(v_linked,1),0)>1
 then raise exception 'Copie collegate a più persone: revisione manuale necessaria'; end if;
 -- Non eliminare una copia linkata se l'ultimo modulo Google non è su di essa.
 if coalesce(array_length(v_linked,1),0)=1 then
  select * into v_canonical from unnest(v_rows) x where (x).id=v_linked[1];
  if v_canonical.source_hash is distinct from p_expected_source_hash
  then raise exception 'Copia collegata a una versione precedente: intervenire sull’anagrafica'; end if;
 else
  select * into v_canonical from unnest(v_rows) x
  where (x).source_hash=p_expected_source_hash
  order by (x).updated_at desc nulls last,(x).created_at desc nulls last limit 1;
 end if;
 if v_canonical.id is null then
  raise exception 'La versione attuale del modulo non è ancora importata: sincronizzare prima'; end if;
 foreach v_row in array v_rows loop
  if v_row.id=v_canonical.id then continue; end if;
  insert into public.gw_google_form_duplicate_archive
   (source_row_id,canonical_id,removed_id,original_record,operator_id)
  values (p_source_row_id,v_canonical.id,v_row.id,to_jsonb(v_row),p_operator_id);
  delete from public.association_members where id=v_row.id;
  v_removed:=v_removed+1;
 end loop;
 return v_removed;
end;
$$;
revoke execute on function public.gw_consolidate_identical_google_form_copies(text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.gw_consolidate_identical_google_form_copies(text,uuid,text)
 to service_role;
commit;
notify pgrst,'reload schema';
