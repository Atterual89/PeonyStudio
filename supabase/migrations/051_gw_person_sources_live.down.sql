-- Rollback di 051_gw_person_sources_live.sql.
-- Ripristina la funzione del trigger dei moduli Google come nella 045 e
-- rimuove trigger e funzioni nuove. Le righe di gw_person_sources restano
-- (si tolgono con il rollback della 050).
begin;

create or replace function public.gw_google_form_person_trigger()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.source = 'google_sheet' then
    perform public.gw_ensure_person_from_google_form(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists gw_participant_person_source on public.gw_booking_participants;
drop trigger if exists gw_holder_person_source on public.gw_peony_booking_holders;
drop trigger if exists gw_partner_person_source on public.gw_peony_booking_partners;
drop trigger if exists gw_ale_contact_person_source on public.gw_ale_contacts;
drop trigger if exists gw_allocation_person_source on public.gw_association_payment_allocations;

drop function if exists public.gw_refresh_person_sources();
drop function if exists public.gw_register_pending_member_rows();
drop function if exists public.gw_resolve_person_source(uuid, uuid, integer, text, uuid);
drop function if exists public.gw_allocation_source_trigger();
drop function if exists public.gw_auto_match_ale_contacts();
drop function if exists public.gw_ale_contact_source_trigger();
drop function if exists public.gw_sync_ale_contact_source(uuid);
drop function if exists public.gw_ticket_link_source_trigger();
drop function if exists public.gw_register_ticket_sources(text);
drop function if exists public.gw_register_ticket_source(uuid, text);
drop function if exists public.gw_participant_source_trigger();
drop function if exists public.gw_sync_participant_source(uuid);
drop function if exists public.gw_register_member_row_source(uuid);
drop function if exists public.gw_identity_candidates(text, text);
drop index if exists public.gw_people_norm_email_idx;
drop index if exists public.gw_people_norm_membership_email_idx;
drop function if exists public.gw_upsert_person_source(public.gw_source_kind, text, uuid, public.gw_link_status, uuid[], text, text, text, text, uuid, text, boolean);

commit;
notify pgrst, 'reload schema';
