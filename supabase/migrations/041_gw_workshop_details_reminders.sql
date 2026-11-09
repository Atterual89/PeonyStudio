-- Workshop information mail: first send is number 0, explicit reminders are number 1+.
-- Reuse gw_email_kind=workshop_details to avoid changing existing enum/data and API schema.
begin;

alter table public.gw_email_sends
  drop constraint if exists gw_email_kind_number_check;
alter table public.gw_email_sends
  add constraint gw_email_kind_number_check
  check (
    (kind = 'partner' and number = 0)
    or (kind = 'partner_reminder' and number > 0)
    or (kind = 'workshop_details' and number >= 0)
  );

drop index if exists public.gw_email_once_unique;
create unique index gw_email_once_unique
  on public.gw_email_sends(workshop_id, person_id, kind)
  where deleted_at is null
    and (kind = 'partner' or (kind = 'workshop_details' and number = 0));

drop index if exists public.gw_email_reminder_number_unique;
create unique index gw_email_reminder_number_unique
  on public.gw_email_sends(workshop_id, person_id, kind, number)
  where deleted_at is null
    and (kind = 'partner_reminder' or (kind = 'workshop_details' and number > 0));

create or replace function public.gw_mark_email_sends(
  p_operator_id uuid, p_workshop_id uuid, p_person_ids uuid[],
  p_kind public.gw_email_kind, p_sent_on date
)
returns integer language plpgsql set search_path=public,pg_temp as $$
declare
  v_id uuid;
  v_created gw_email_sends;
  v_n integer;
  v_count integer:=0;
begin
  if not exists (select 1 from gw_operators where id=p_operator_id and role='admin')
    then raise exception 'gw_not_found' using errcode='GW404'; end if;
  if not exists (select 1 from gw_workshops where id=p_workshop_id and deleted_at is null)
    then raise exception 'gw_not_found' using errcode='GW404'; end if;
  if p_sent_on is null or p_sent_on>current_date
    or coalesce(array_length(p_person_ids,1),0)<1
    or coalesce(array_length(p_person_ids,1),0)>500
    then raise exception 'gw_invalid' using errcode='GW400'; end if;

  for v_id in select distinct unnest(p_person_ids) loop
    perform 1 from gw_people
      where id=v_id and merged_into is null and deleted_at is null for update;
    if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
    if not exists (
      select 1 from gw_booking_participants bp
      join gw_bookings b on b.id=bp.booking_id
      where bp.person_id=v_id and b.workshop_id=p_workshop_id
        and b.deleted_at is null and bp.deleted_at is null
        and bp.removed_at is null and b.status in ('prenotato','acconto','saldato')
    ) then raise exception 'gw_invalid' using errcode='GW400'; end if;
    if p_kind='workshop_details' and not exists (
      select 1 from gw_booking_participants bp
      join gw_bookings b on b.id=bp.booking_id
      where bp.person_id=v_id and b.workshop_id=p_workshop_id
        and b.deleted_at is null and bp.deleted_at is null
        and bp.removed_at is null and b.status in ('acconto','saldato')
    ) then raise exception 'gw_invalid' using errcode='GW400'; end if;

    if p_kind='partner_reminder' then
      if not exists (
        select 1 from gw_email_sends
        where workshop_id=p_workshop_id and person_id=v_id
          and kind='partner' and deleted_at is null
      ) then raise exception 'gw_invalid' using errcode='GW400'; end if;
      select coalesce(max(number),0)+1 into v_n
        from gw_email_sends
        where workshop_id=p_workshop_id and person_id=v_id
          and kind='partner_reminder' and deleted_at is null;
    elsif p_kind='workshop_details' then
      select coalesce(max(number),-1)+1 into v_n
        from gw_email_sends
        where workshop_id=p_workshop_id and person_id=v_id
          and kind='workshop_details' and deleted_at is null;
    else
      if exists (
        select 1 from gw_email_sends
        where workshop_id=p_workshop_id and person_id=v_id
          and kind=p_kind and deleted_at is null
      ) then raise exception 'gw_conflict' using errcode='GW409'; end if;
      v_n:=0;
    end if;

    insert into gw_email_sends(workshop_id,person_id,kind,number,sent_on,created_by)
      values(p_workshop_id,v_id,p_kind,v_n,p_sent_on,p_operator_id)
      returning * into v_created;
    perform gw_audit(p_operator_id,'email_send',v_created.id,'insert',null,to_jsonb(v_created));
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

revoke all on function public.gw_mark_email_sends(uuid,uuid,uuid[],public.gw_email_kind,date)
  from public,anon,authenticated;
grant execute on function public.gw_mark_email_sends(uuid,uuid,uuid[],public.gw_email_kind,date)
  to service_role;
notify pgrst, 'reload schema';
commit;
