-- Rollback di 018_gw_consuntivo_v4.sql
--
-- Tocca solo oggetti gw_. Elimina le funzioni nuove e la colonna
-- gw_expenses.category (le spese restano, senza categoria) e ripristina
-- gw_update_workshop_settings come in 015.
--
-- STORICO: Postgres non permette di togliere un valore da un enum senza
-- ricreare il tipo (e tutte le colonne e funzioni che lo usano). Scelta più
-- sicura, come in 012: il valore 'export' di gw_audit_action RESTA nel tipo;
-- le righe di storico già scritte con 'export' restano (lo storico è
-- append-only).

begin;

drop function if exists public.gw_create_expense(uuid, uuid, jsonb);
drop function if exists public.gw_update_expense(uuid, uuid, integer, jsonb);
drop function if exists public.gw_delete_expense(uuid, uuid, integer);
drop function if exists public.gw_create_transfer(uuid, uuid, jsonb);
drop function if exists public.gw_set_transfer_executed(uuid, uuid, integer, date);
drop function if exists public.gw_delete_transfer(uuid, uuid, integer);
drop function if exists public.gw_create_carryover(uuid, jsonb);
drop function if exists public.gw_delete_carryover(uuid, uuid, integer);
drop function if exists public.gw_set_peony_pct(uuid, uuid, integer, numeric);
drop function if exists public.gw_set_loss_peony(uuid, uuid, integer, bigint);
drop function if exists public.gw_set_settlement_status(uuid, uuid, integer, public.gw_settlement_status, jsonb);
drop function if exists public.gw_set_tax_notes(uuid, uuid, integer, text);
drop function if exists public.gw_log_export(uuid, uuid, text);

alter table public.gw_expenses drop column if exists category;
drop type if exists public.gw_expense_category;

-- Come in 015_gw_quota_workshop_v3c.sql
create or replace function public.gw_update_workshop_settings(
  p_operator_id uuid,
  p_id uuid,
  p_version integer,
  p_data jsonb
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_workshops;
  v_after gw_workshops;
  v_unsettled integer := 0;
begin
  select * into v_before from gw_workshops where id = p_id and version = p_version for update;
  if not found then
    perform gw_raise_missing_or_conflict('public.gw_workshops', p_id);
  end if;

  update gw_workshops
     set description = gw_clean(p_data->>'description'),
         capacity = (gw_clean(p_data->>'capacity'))::integer,
         default_fee_cents = (gw_clean(p_data->>'default_fee_cents'))::bigint,
         peony_pct = coalesce((gw_clean(p_data->>'peony_pct'))::numeric, 30),
         version = version + 1
   where id = p_id
  returning * into v_after;

  perform gw_audit(p_operator_id, 'workshop', p_id, 'update', to_jsonb(v_before), to_jsonb(v_after));

  if v_after.default_fee_cents is distinct from v_before.default_fee_cents then
    v_unsettled := gw_sync_workshop_fee(p_operator_id, p_id);
  end if;

  return jsonb_build_object('version', v_after.version, 'unsettled', v_unsettled);
end;
$$;

revoke execute on function public.gw_update_workshop_settings(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.gw_update_workshop_settings(uuid, uuid, integer, jsonb) to service_role;

commit;

notify pgrst, 'reload schema';
