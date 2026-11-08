-- Correzione del nome/nickname e dell'email come inseriti da Ale nel
-- workshop. Non cambia il riferimento alla persona anagrafica, il partner
-- reale della prenotazione, la tessera o l'importo; conserva un audit.
begin;

create or replace function public.gw_update_entered_participant(
  p_operator_id uuid, p_participant_id uuid, p_entered_as text, p_entered_email text
) returns void
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_before public.gw_booking_participants%rowtype;
  v_name text := nullif(btrim(regexp_replace(coalesce(p_entered_as,''), '\s+', ' ', 'g')), '');
  v_email text := public.gw_entered_email(p_entered_email);
begin
  if v_name is null or length(v_name)>200 then
    raise exception 'gw_invalid' using errcode='GW400',
      detail='Inserisci un nome o nickname di massimo 200 caratteri.';
  end if;
  if not exists (
    select 1 from public.gw_operators
    where id=p_operator_id and role::text='organizzatrice' and active
  ) then
    raise exception 'gw_forbidden' using errcode='GW403';
  end if;
  select * into v_before from public.gw_booking_participants
   where id=p_participant_id and removed_at is null and deleted_at is null
   for update;
  if not found then
    raise exception 'gw_not_found' using errcode='GW404';
  end if;
  if v_before.entered_as is not distinct from v_name and
     v_before.entered_email is not distinct from v_email then
    return;
  end if;
  update public.gw_booking_participants
   set entered_as=v_name, entered_email=v_email
   where id=p_participant_id;
  perform public.gw_audit(p_operator_id,'booking',v_before.booking_id,'update',
    jsonb_build_object('participant_id',p_participant_id,
      'entered_as',v_before.entered_as,'entered_email',v_before.entered_email),
    jsonb_build_object('participant_id',p_participant_id,
      'entered_as',v_name,'entered_email',v_email));
  if v_email is distinct from v_before.entered_email and v_email is not null then
    perform public.gw_apply_entered_email(p_operator_id,p_participant_id);
  end if;
end;
$$;

revoke all on function public.gw_update_entered_participant(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.gw_update_entered_participant(uuid,uuid,text,text) to service_role;
commit;
notify pgrst,'reload schema';
