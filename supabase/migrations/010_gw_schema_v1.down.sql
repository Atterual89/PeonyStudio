-- Rollback di 010_gw_schema_v1.sql
--
-- ATTENZIONE: elimina TUTTI i dati del gestionale (tabelle gw_).
-- Elimina solo oggetti con prefisso gw_; nessun CASCADE, così un eventuale
-- oggetto esterno che dipendesse da questi fa fallire il rollback invece di
-- essere eliminato in silenzio.

begin;

drop function if exists public.gw_unlock_logins(uuid);
drop function if exists public.gw_revoke_operator_sessions(uuid, text);
drop function if exists public.gw_set_operator_pin(uuid, text, text);
drop function if exists public.gw_logout(uuid, uuid);
drop function if exists public.gw_login_succeeded(uuid, text, text, text, timestamptz);

-- Ordine inverso rispetto alle chiavi esterne.
drop table if exists public.gw_audit_log;
drop table if exists public.gw_membership_overrides;
drop table if exists public.gw_carryovers;
drop table if exists public.gw_transfers;
drop table if exists public.gw_expenses;
drop table if exists public.gw_payments;
drop table if exists public.gw_booking_participants;
drop table if exists public.gw_bookings;
drop table if exists public.gw_people;
drop table if exists public.gw_workshops;
drop table if exists public.gw_login_unlocks;
drop table if exists public.gw_login_attempts;
drop table if exists public.gw_sessions;
drop table if exists public.gw_operators;

-- Le funzioni trigger si eliminano dopo le tabelle che le usano.
drop function if exists public.gw_payments_guard();
drop function if exists public.gw_forbid_change();
drop function if exists public.gw_set_updated_at();

drop type if exists public.gw_audit_action;
drop type if exists public.gw_membership_status;
drop type if exists public.gw_carryover_status;
drop type if exists public.gw_transfer_status;
drop type if exists public.gw_payment_method;
drop type if exists public.gw_payment_kind;
drop type if exists public.gw_attendance;
drop type if exists public.gw_invoice_status;
drop type if exists public.gw_booking_status;
drop type if exists public.gw_settlement_status;
drop type if exists public.gw_party;

commit;
