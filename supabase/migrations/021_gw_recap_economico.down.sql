-- Rollback di 021_gw_recap_economico.sql: toglie la lettura aggregata della home.

begin;

drop function public.gw_economic_overview();

commit;

notify pgrst, 'reload schema';
