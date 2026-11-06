-- Rollback di 027_gw_functions_v5.sql: toglie le funzioni delle presenze e
-- della lettura dello storico e la colonna gw_bookings.present (le spunte
-- "Presente" registrate si perdono). Lo storico (gw_audit_log) resta.

begin;

drop function if exists public.gw_audit_list(public.gw_operator_role, uuid, uuid, text, uuid, integer, integer);
drop function if exists public.gw_audit_organizer_view(jsonb);
drop function if exists public.gw_audit_clean(jsonb);
drop function if exists public.gw_audit_kind(text);
drop function if exists public.gw_set_present(uuid, uuid, integer, boolean);

alter table public.gw_bookings drop column if exists present;

commit;

notify pgrst, 'reload schema';
