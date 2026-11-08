-- Correzione dei trasferimenti fra Ale e Peony.
-- Il record già eseguito rappresenta l'importo realmente versato, non
-- necessariamente il residuo teorico. Una correzione modifica il saldo ma
-- non le quote dei partecipanti. Eventuali riporti restano movimenti separati.
create or replace function public.gw_update_transfer(
  p_operator_id uuid,
  p_id uuid,
  p_version integer,
  p_data jsonb
) returns integer
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_before public.gw_transfers%rowtype;
  v_after public.gw_transfers%rowtype;
  v_amount bigint;
  v_from public.gw_party;
  v_to public.gw_party;
  v_status public.gw_transfer_status;
  v_date date;
begin
  select * into v_before from public.gw_transfers
    where id=p_id and version=p_version for update;
  if not found then
    perform public.gw_raise_missing_or_conflict('public.gw_transfers',p_id);
  end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' then
    raise exception 'gw_invalid' using errcode='GW400',detail='Dati del trasferimento non validi.';
  end if;
  v_amount := (p_data->>'amount_cents')::bigint;
  v_from := (p_data->>'from_party')::public.gw_party;
  v_to := (p_data->>'to_party')::public.gw_party;
  v_status := (p_data->>'status')::public.gw_transfer_status;
  v_date := nullif(btrim(p_data->>'executed_on'),'')::date;
  if v_amount is null or v_amount<=0 or v_amount>100000000 or
    v_from is null or v_to is null or v_from=v_to or v_status is null then
    raise exception 'gw_invalid' using errcode='GW400',detail='Importo, direzione o stato non validi.';
  end if;
  if v_status='eseguito' and v_date is null then
    raise exception 'gw_invalid' using errcode='GW400',detail='Indica la data del versamento.';
  end if;

  update public.gw_transfers
  set amount_cents=v_amount,
      from_party=v_from,
      to_party=v_to,
      status=v_status,
      executed_on=case when v_status='eseguito' then v_date else null end,
      notes=public.gw_clean(p_data->>'notes'),
      version=version+1
  where id=p_id
  returning * into v_after;

  perform public.gw_audit(
    p_operator_id,'transfer',p_id,'update',
    to_jsonb(v_before),to_jsonb(v_after)
  );
  return v_after.version;
end;
$$;

revoke all on function public.gw_update_transfer(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.gw_update_transfer(uuid,uuid,integer,jsonb) to service_role;
