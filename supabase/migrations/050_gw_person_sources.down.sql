-- Rollback di 050_gw_person_sources.sql. Non tocca altre tabelle.
begin;

drop function if exists public.gw_backfill_person_sources();
drop function if exists public.gw_member_row_candidates(uuid);
drop function if exists public.gw_active_person(uuid);
drop view if exists public.gw_person_sources_summary;
drop table if exists public.gw_person_sources;
drop type if exists public.gw_link_status;
drop type if exists public.gw_source_kind;
drop function if exists public.gw_names_compatible(text, text);
drop function if exists public.gw_norm_email(text);

commit;
notify pgrst, 'reload schema';
