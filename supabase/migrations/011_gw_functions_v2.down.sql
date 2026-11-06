-- Rollback di 011_gw_functions_v2.sql: elimina solo le funzioni gw_ create
-- da quella migrazione. Nessun dato viene toccato.

begin;

drop function if exists public.gw_split_participant(uuid, uuid, integer, uuid);
drop function if exists public.gw_set_partner(uuid, uuid, integer, uuid, jsonb);
drop function if exists public.gw_update_booking(uuid, uuid, integer, public.gw_booking_status, bigint, text);
drop function if exists public.gw_create_booking(uuid, uuid, jsonb, public.gw_booking_status, bigint, text);
drop function if exists public.gw_merge_people(uuid, uuid, integer, uuid, integer, jsonb);
drop function if exists public.gw_link_association_member(uuid, uuid, integer, uuid);
drop function if exists public.gw_update_person(uuid, uuid, integer, jsonb);
drop function if exists public.gw_create_person(uuid, jsonb);
drop function if exists public.gw_update_workshop(uuid, uuid, integer, jsonb);
drop function if exists public.gw_create_workshop(uuid, jsonb);
drop function if exists public.gw_assert_can_enroll(uuid, uuid);
drop function if exists public.gw_booking_snapshot(uuid);
drop function if exists public.gw_raise_missing_or_conflict(regclass, uuid);
drop function if exists public.gw_clean(text);
drop function if exists public.gw_audit(uuid, text, uuid, public.gw_audit_action, jsonb, jsonb);

commit;
