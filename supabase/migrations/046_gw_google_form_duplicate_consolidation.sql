-- Consolida SOLO copie byte-equivalenti di una stessa risposta Google.
-- Copie rimosse archiviate integralmente per recupero manuale.
begin;
create table if not exists public.gw_google_form_duplicate_archive (
 id uuid primary key default gen_random_uuid(),
 source_row_id text not null,
 canonical_id uuid not null,
 removed_id uuid not null unique,
 original_record jsonb not null,
 operator_id uuid not null,
 archived_at timestamptz not null default now()
);
create index if not exists gw_google_form_duplicate_archive_source_idx
 on public.gw_google_form_duplicate_archive(source_row_id);
alter table public.gw_google_form_duplicate_archive enable row level security;
revoke all on public.gw_google_form_duplicate_archive from public,anon,authenticated;
grant select,insert on public.gw_google_form_duplicate_archive to service_role;

create or replace function public.gw_consolidate_identical_google_form_copies(
 p_source_row_id text, p_operator_id uuid
) returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 v_rows public.association_members[];
 v_row public.association_members%rowtype;
 v_first public.association_members%rowtype;
 v_canonical uuid;
 v_linked uuid[];
 v_count integer;
 v_removed integer:=0;
begin
 if p_operator_id is null or p_source_row_id !~ '^(eng:)?[0-9]{1,7}$'
 then raise exception 'Riferimento modulo o operatore non valido'; end if;
 -- Serializza le revisioni sulla stessa risposta Google.
 perform pg_advisory_xact_lock(hashtext('google_form:'||p_source_row_id));
 select array_agg(r order by r.created_at nulls last,r.id) into v_rows
 from (select * from public.association_members
       where source='google_sheet' and source_row_id=p_source_row_id for update) r;
 v_count:=coalesce(array_length(v_rows,1),0);
 if v_count<2 then raise exception 'Nessuna copia da consolidare'; end if;
 v_first:=v_rows[1];
 -- Le colonne di identità e registrazione devono coincidere integralmente.
 foreach v_row in array v_rows loop
  if row(v_row.first_name,v_row.last_name,v_row.email,v_row.contact,
   v_row.membership_status,v_row.membership_starts_at,v_row.membership_expires_at,
   v_row.source,v_row.source_row_id,v_row.source_hash,v_row.notes_admin,
   v_row.fiscal_code,v_row.birth_date,v_row.membership_card_number)
   is distinct from
   row(v_first.first_name,v_first.last_name,v_first.email,v_first.contact,
   v_first.membership_status,v_first.membership_starts_at,v_first.membership_expires_at,
   v_first.source,v_first.source_row_id,v_first.source_hash,v_first.notes_admin,
   v_first.fiscal_code,v_first.birth_date,v_first.membership_card_number)
  then raise exception 'Le copie contengono dati differenti: revisione manuale necessaria'; end if;
 end loop;
 select array_agg(distinct association_member_id) into v_linked
 from public.gw_people
 where association_member_id=any(array(select (x).id from unnest(v_rows) x))
;
 if coalesce(array_length(v_linked,1),0)>1 then
  raise exception 'Più copie sono collegate a persone: verificare prima di consolidare'; end if;
 v_canonical:=coalesce(v_linked[1],v_first.id);
 foreach v_row in array v_rows loop
  if v_row.id=v_canonical then continue; end if;
  insert into public.gw_google_form_duplicate_archive
   (source_row_id,canonical_id,removed_id,original_record,operator_id)
  values (p_source_row_id,v_canonical,v_row.id,to_jsonb(v_row),p_operator_id);
  delete from public.association_members where id=v_row.id;
  v_removed:=v_removed+1;
 end loop;
 return v_removed;
end;
$$;
revoke execute on function public.gw_consolidate_identical_google_form_copies(text,uuid)
 from public,anon,authenticated;
grant execute on function public.gw_consolidate_identical_google_form_copies(text,uuid)
 to service_role;
commit;
notify pgrst,'reload schema';
