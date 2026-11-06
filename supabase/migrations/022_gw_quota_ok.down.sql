-- Rollback di 022_gw_quota_ok.sql: toglie la funzione di storico. Le
-- validazioni manuali create dalla conversione restano (sono righe del sito,
-- source manual_override, valide anche per la pagina admin): eventualmente
-- si annullano dalla pagina admin o dal gestionale.

begin;

drop function public.gw_log_member_validation(uuid, uuid, text, jsonb);

comment on table public.gw_membership_overrides is null;

commit;

notify pgrst, 'reload schema';
