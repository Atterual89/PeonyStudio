-- Rollback 028: remove email-related objects only.
begin;
drop function if exists public.gw_delete_email_send(uuid,uuid);
drop function if exists public.gw_mark_email_sends(uuid,uuid,uuid[],public.gw_email_kind,date);
drop function if exists public.gw_save_email_defaults(uuid,integer,jsonb);
drop function if exists public.gw_save_email_texts(uuid,uuid,integer,jsonb);
drop table if exists public.gw_email_sends;
drop type if exists public.gw_email_kind;
drop table if exists public.gw_settings;
drop table if exists public.gw_email_texts;
notify pgrst, 'reload schema';
commit;
