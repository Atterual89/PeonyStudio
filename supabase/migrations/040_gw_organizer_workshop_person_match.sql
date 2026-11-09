-- Riconciliazione deliberata delle persone nelle iscrizioni di Alessandra.
-- Distinta dal matching amministrativo delle fonti associative.
-- Non aggiorna gw_people, libro soci, quote, email ufficiali o pagamenti.

create or replace function public.gw_organizer_link_workshop_person(
  p_operator_id uuid, p_participant_id uuid, p_person_id uuid
) returns void
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_part public.gw_booking_participants%rowtype;
  v_old uuid;
begin
  if not exists (select 1 from public.gw_operators
    where id=p_operator_id and active and role::text='organizzatrice')
  then raise exception 'gw_forbidden' using errcode='GW403'; end if;
  select p.* into v_part from public.gw_booking_participants p
    join public.gw_bookings b on b.id=p.booking_id and b.deleted_at is null
    join public.gw_workshops w on w.id=b.workshop_id and w.deleted_at is null
    where p.id=p_participant_id and p.removed_at is null and p.deleted_at is null
    for update of p;
  if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
  perform 1 from public.gw_people
    where id=p_person_id and deleted_at is null and merged_into is null;
  if not found then raise exception 'gw_invalid' using errcode='GW400'; end if;
  if exists (select 1 from public.gw_booking_participants p
    where p.workshop_id=v_part.workshop_id and p.person_id=p_person_id
      and p.id<>p_participant_id and p.removed_at is null and p.deleted_at is null)
  then raise exception 'gw_already_enrolled' using errcode='GW409'; end if;
  if v_part.person_id=p_person_id and v_part.match_status::text='confermato'
  then return; end if;
  v_old:=v_part.person_id;
  update public.gw_booking_participants
    set person_id=p_person_id,match_status='confermato',
      auto_created_person=false,possible_duplicate_person_id=null,
      version=version+1,updated_at=now()
    where id=p_participant_id;
  perform public.gw_audit(p_operator_id,'booking',v_part.booking_id,'update',
    jsonb_build_object('participant_id',p_participant_id,'person_id',v_old),
    jsonb_build_object('participant_id',p_participant_id,'person_id',p_person_id,
      'source','organizer_explicit_match'));
end;
$$;
revoke all on function public.gw_organizer_link_workshop_person(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.gw_organizer_link_workshop_person(uuid,uuid,uuid)
  to service_role;

-- Un solo nome composto tipo Pavel/Maru è una sola riga nel database.
-- Divide SOLO se si tratta ancora di un profilo creato automaticamente e
-- non abbinato, previa conferma esplicita di Alessandra.
-- Il primo conserva il provvisorio esistente; il secondo usa una persona
-- esistente scelta a mano o una nuova provvisoria esplicitamente richiesta.
create or replace function public.gw_organizer_split_compound_person(
  p_operator_id uuid, p_participant_id uuid,
  p_first_name text,p_second_name text,p_second_person_id uuid default null,
  p_create_provisional boolean default false
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_part public.gw_booking_participants%rowtype;
  v_first text:=nullif(btrim(regexp_replace(coalesce(p_first_name,''),'\s+',' ','g')),'');
  v_second text:=nullif(btrim(regexp_replace(coalesce(p_second_name,''),'\s+',' ','g')),'');
  v_person uuid;
  v_new uuid;
begin
  if not exists(select 1 from public.gw_operators
    where id=p_operator_id and active and role::text='organizzatrice')
  then raise exception 'gw_forbidden' using errcode='GW403'; end if;
  select p.* into v_part from public.gw_booking_participants p
    join public.gw_bookings b on b.id=p.booking_id and b.deleted_at is null
    join public.gw_workshops w on w.id=b.workshop_id and w.deleted_at is null
    where p.id=p_participant_id and p.removed_at is null and p.deleted_at is null
    for update of p;
  if not found then raise exception 'gw_not_found' using errcode='GW404'; end if;
  if not v_part.is_primary or not v_part.auto_created_person
    or v_part.match_status::text<>'da_abbinare'
    or v_part.entered_as !~* '(/|\+|[[:space:]]e[[:space:]])'
    or (select count(*) from public.gw_booking_participants
      where booking_id=v_part.booking_id and removed_at is null and deleted_at is null)<>1
  then raise exception 'gw_not_compound' using errcode='GW409'; end if;
  if v_first is null or v_second is null
    or length(v_first)>200 or length(v_second)>200
    or v_first=v_second or v_first ~ '[/+]' or v_second ~ '[/+]'
    or (p_second_person_id is null)=(not coalesce(p_create_provisional,false))
  then raise exception 'gw_invalid' using errcode='GW400'; end if;
  if p_second_person_id is not null then
    select id into v_person from public.gw_people
      where id=p_second_person_id and deleted_at is null and merged_into is null;
    if not found or v_person=v_part.person_id
    then raise exception 'gw_invalid' using errcode='GW400'; end if;
    if exists(select 1 from public.gw_booking_participants
      where workshop_id=v_part.workshop_id and person_id=v_person
        and removed_at is null and deleted_at is null)
    then raise exception 'gw_already_enrolled' using errcode='GW409'; end if;
  else
    insert into public.gw_people(nickname,created_by)
      values(v_second,p_operator_id) returning id into v_person;
  end if;
  update public.gw_booking_participants set
    entered_as=v_first,updated_at=now(),version=version+1
    where id=p_participant_id;
  insert into public.gw_booking_participants(
    booking_id,workshop_id,person_id,is_primary,entered_as,entered_email,
    match_status,auto_created_person,possible_duplicate_person_id
  ) values(
    v_part.booking_id,v_part.workshop_id,v_person,false,v_second,null,
    case when p_second_person_id is null then 'da_abbinare'::public.gw_match_status
      else 'confermato'::public.gw_match_status end,
    p_second_person_id is null,null
  ) returning id into v_new;
  perform public.gw_audit(p_operator_id,'booking',v_part.booking_id,'update',
    jsonb_build_object('participant_id',p_participant_id,
      'entered_as',v_part.entered_as,'person_id',v_part.person_id),
    jsonb_build_object('participant_id',p_participant_id,'entered_as',v_first,
      'partner_participant_id',v_new,'partner_name',v_second,
      'partner_person_id',v_person,'source','organizer_explicit_split'));
  return v_new;
end;
$$;
revoke all on function public.gw_organizer_split_compound_person(uuid,uuid,text,text,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.gw_organizer_split_compound_person(uuid,uuid,text,text,uuid,boolean)
  to service_role;
notify pgrst,'reload schema';
