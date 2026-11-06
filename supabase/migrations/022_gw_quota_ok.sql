-- Gestionale Workshop — "Quota ok" condivisa con il sito (D11 rivista)
--
-- Rollback: 022_gw_quota_ok.down.sql
--
--   - gw_membership_overrides non si usa più: le correzioni "in regola" diventano
--     validazioni manuali (righe manual_override di association_members), le
--     stesse che crea la pagina admin. Le correzioni "non associato" e quelle di
--     persone senza email né nome e cognome non si convertono (avviso con il
--     conteggio). La tabella resta, per lo storico.
--   - gw_log_member_validation: storico delle validazioni fatte dal gestionale
--     (la scrittura su association_members la fa il server con la funzione
--     condivisa src/lib/association/manual-validation.ts).
--
-- Al momento della scrittura (lettura del 29/10/2026) gw_membership_overrides
-- era vuota: la conversione non inserisce niente, è qui per sicurezza.

begin;

do $$
begin
  if to_regprocedure('public.gw_economic_overview()') is null then
    raise exception 'Migrazione 022 interrotta: applica prima 021_gw_recap_economico.sql';
  end if;
  if to_regprocedure('public.gw_log_member_validation(uuid, uuid, text, jsonb)') is not null then
    raise exception 'Migrazione 022 interrotta: sembra già applicata (gw_log_member_validation esiste)';
  end if;
end;
$$;

create function public.gw_log_member_validation(p_operator_id uuid, p_person_id uuid, p_action text, p_data jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_action not in ('quota_ok', 'annulla_quota_ok') then
    raise exception 'gw_invalid' using errcode = 'GW400', detail = 'Azione non valida.';
  end if;
  perform gw_audit(p_operator_id, 'person', p_person_id, 'update', null,
                   jsonb_build_object('validazione_manuale', p_action) || coalesce(p_data, '{}'::jsonb));
end;
$$;

revoke execute on function public.gw_log_member_validation(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.gw_log_member_validation(uuid, uuid, text, jsonb) to service_role;

-- Conversione delle correzioni "in regola" in validazioni manuali, con le date
-- del periodo associativo dell'anno (membership-periods.ts: 2025 e 2026 → primo
-- periodo 01/09/2025–31/12/2026; dal 2027 l'anno solare).
do $$
declare
  v_total integer;
  v_converted integer;
begin
  select count(*) into v_total from gw_membership_overrides;

  with source as (
    select o.id, o.person_id, o.year, p.first_name, p.last_name,
           lower(btrim(coalesce(p.membership_email, p.email))) as email
      from gw_membership_overrides o
      join gw_people p on p.id = o.person_id
     where o.status = 'in_regola'
       and o.year >= 2025
       and p.deleted_at is null
       and (gw_clean(coalesce(p.membership_email, p.email)) is not null
            or (gw_clean(p.first_name) is not null and gw_clean(p.last_name) is not null))
  ), inserted as (
    insert into association_members (
      first_name, last_name, email, membership_status, membership_starts_at, membership_expires_at,
      source, source_row_id, source_hash, notes_admin
    )
    select s.first_name, s.last_name, s.email, 'verified',
           case when s.year <= 2026 then date '2025-09-01' else make_date(s.year, 1, 1) end,
           case when s.year <= 2026 then date '2026-12-31' else make_date(s.year, 12, 31) end,
           'manual_override', 'manual:gestionale:' || s.id, null,
           'Validazione manuale dal gestionale (correzione convertita, 022)'
      from source s
    returning id
  )
  select count(*) into v_converted from inserted;

  insert into gw_audit_log (operator_id, entity, entity_id, action, before, after)
  select null, 'person', o.person_id, 'update', to_jsonb(o),
         jsonb_build_object('validazione_manuale', 'convertita da gw_membership_overrides (022)')
    from gw_membership_overrides o
   where o.status = 'in_regola' and o.year >= 2025;

  raise notice 'Migrazione 022: % correzioni in gw_membership_overrides, % convertite in validazioni manuali, % non convertite.',
    v_total, v_converted, v_total - v_converted;
end;
$$;

comment on table public.gw_membership_overrides is
  'Non più usata (022): lo stato "Quota ok" è una validazione manuale (association_members, source manual_override), unica per sito e gestionale.';

commit;

-- PostgREST: ricarica lo schema per vedere la funzione nuova.
notify pgrst, 'reload schema';
