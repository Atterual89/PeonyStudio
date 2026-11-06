-- Gestionale Workshop — Presenze e storico modifiche (Fase 5, D27, gw_functions_v5)
--
-- Tocca SOLO oggetti gw_ e solo in modo additivo (una colonna nuova con
-- default, funzioni nuove). Rollback: 027_gw_functions_v5.down.sql
--
--   - gw_bookings.present: UNA spunta "Presente" per iscrizione (una coppia =
--     1), come si contano le iscrizioni (D15). La vecchia colonna attendance
--     per persona (010) resta com'è e non si usa.
--   - gw_set_present: la spunta, per i due ruoli (riga chiusa del tab
--     Iscrizioni di Ale e del tab Partecipanti). "Presente" solo sulle
--     iscrizioni confermate; togliere la spunta sempre. Non cambia lo stato
--     dell'iscrizione né i dati associativi. Controllo di `version` e storico.
--   - gw_audit_list: lettura dello storico per /gestione/altro/storico (sola
--     lettura). Agli admin tutto; all'organizzatrice, filtrato QUI e non nel
--     browser, solo iscrizioni, pagamenti, spese, trasferimenti, riporti e
--     stato dei conti, con le persone solo come le ha scritte lei
--     (entered_as) e solo i campi che vede già nel suo tab. Le chiavi
--     sensibili (hash, token, note fiscali D7) si tolgono per tutti.

begin;

do $$
begin
  if to_regclass('public.gw_membership_contacts') is null or to_regclass('public.gw_person_aliases') is null then
    raise exception 'Migrazione 027 interrotta: applica prima 023_gw_richieste_associazione.sql';
  end if;
  if to_regprocedure('public.gw_set_present(uuid, uuid, integer, boolean)') is not null then
    raise exception 'Migrazione 027 interrotta: sembra già applicata (gw_set_present esiste)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Presenze: una spunta per iscrizione
-- ---------------------------------------------------------------------------
alter table public.gw_bookings
  add column present boolean not null default false;

create function public.gw_set_present(
  p_operator_id uuid,
  p_booking_id uuid,
  p_version integer,
  p_present boolean
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before gw_bookings;
  v_version integer;
begin
  if p_present is null then
    raise exception 'gw_invalid' using errcode = 'GW400';
  end if;

  select * into v_before from gw_bookings
   where id = p_booking_id and deleted_at is null
   for update;
  if not found then
    raise exception 'gw_not_found' using errcode = 'GW404';
  end if;
  if p_present and v_before.status::text not in ('prenotato', 'acconto', 'saldato') then
    raise exception 'gw_invalid' using errcode = 'GW400',
      detail = 'La presenza si segna solo sulle iscrizioni confermate.';
  end if;

  update gw_bookings
     set present = p_present,
         version = version + 1,
         updated_at = now()
   where id = p_booking_id and version = p_version
  returning version into v_version;
  if not found then
    raise exception 'gw_conflict' using errcode = 'GW409';
  end if;

  if v_before.present is distinct from p_present then
    perform gw_audit(p_operator_id, 'booking', p_booking_id, 'update',
                     jsonb_build_object('present', v_before.present),
                     jsonb_build_object('present', p_present));
  end if;
  return v_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storico modifiche (sola lettura)
-- ---------------------------------------------------------------------------

-- Tipo di una riga di storico, per il filtro della pagina.
create function public.gw_audit_kind(p_entity text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_entity in ('person', 'person_alias', 'membership_contact') then 'anagrafica'
    when p_entity = 'booking' then 'iscrizioni'
    when p_entity = 'payment' then 'pagamenti'
    when p_entity = 'expense' then 'spese'
    when p_entity = 'transfer' then 'trasferimenti'
    when p_entity = 'carryover' then 'riporti'
    when p_entity = 'workshop' then 'conti'
    when p_entity in ('session', 'operator', 'login_unlock') then 'accessi'
    else 'altro'
  end;
$$;

-- Chiavi che lo storico non deve mai mostrare (difesa in profondità: le
-- funzioni gw_* non le scrivono).
create function public.gw_audit_clean(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'object' then p_value
    else p_value - array['pin', 'pin_hash', 'token', 'token_hash', 'ip_hash', 'personal_tax_notes']
  end;
$$;

-- Vista dell'organizzatrice di un prima / dopo: solo i campi che vede già nel
-- suo tab (dati economici e testo scritto da lei); delle persone di
-- un'iscrizione solo entered_as. Mai id di persone, abbinamenti, libro soci.
create function public.gw_audit_organizer_view(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'object' then null
    else (
      select coalesce(jsonb_object_agg(
               j.key,
               case
                 when j.key = 'participants' and jsonb_typeof(j.value) = 'array' then (
                   select coalesce(jsonb_agg(jsonb_build_object('entered_as', e.value -> 'entered_as', 'removed_at', e.value -> 'removed_at')), '[]'::jsonb)
                     from jsonb_array_elements(j.value) e
                    where jsonb_typeof(e.value) = 'object')
                 else j.value
               end), '{}'::jsonb)
        from jsonb_each(p_value) j
       where j.key = any (array[
         -- iscrizioni
         'status', 'present', 'notes', 'agreed_fee_cents', 'fee_custom', 'invoice_status',
         'participants', 'entered_as', 'entered_email',
         -- pagamenti
         'kind', 'amount_cents', 'payment_type', 'method', 'paid_on', 'received_by', 'description',
         -- spese, trasferimenti, riporti
         'category', 'advanced_by', 'spent_on', 'from_party', 'to_party', 'executed_on',
         'debtor', 'creditor', 'pagato_cents', 'nota', 'origine',
         -- stato dei conti
         'settlement_status', 'verified_at',
         -- eliminazioni (D22)
         'deleted_at', 'eliminato', 'ripristinato'
       ])
    )
  end;
$$;

create function public.gw_audit_list(
  p_viewer_role public.gw_operator_role,
  p_filter_operator uuid,
  p_workshop_id uuid,
  p_kind text,
  p_person_id uuid,
  p_offset integer,
  p_limit integer
)
returns table (
  id bigint,
  created_at timestamptz,
  operator_id uuid,
  operator_name text,
  operator_role text,
  entity text,
  entity_id uuid,
  action text,
  before jsonb,
  after jsonb,
  kind text,
  workshop_id uuid,
  workshop_name text,
  subject text,
  total bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with viewer as (
    select coalesce(p_viewer_role::text, 'organizzatrice') = 'admin' as is_admin
  ),
  base as (
    select a.id, a.created_at, a.operator_id, a.entity, a.entity_id, a.action,
           case when v.is_admin then gw_audit_clean(a.before) else gw_audit_organizer_view(gw_audit_clean(a.before)) end as before,
           case when v.is_admin then gw_audit_clean(a.after) else gw_audit_organizer_view(gw_audit_clean(a.after)) end as after,
           gw_audit_kind(a.entity) as kind,
           v.is_admin,
           case a.entity
             when 'booking' then a.entity_id
             when 'payment' then (select p.booking_id from gw_payments p where p.id = a.entity_id)
           end as booking_id,
           case a.entity
             when 'person' then a.entity_id
             when 'person_alias' then (select pa.person_id from gw_person_aliases pa where pa.id = a.entity_id)
             when 'membership_contact' then (select mc.person_id from gw_membership_contacts mc where mc.id = a.entity_id)
           end as person_id
      from gw_audit_log a
     cross join viewer v
     where (p_kind is null or gw_audit_kind(a.entity) = p_kind)
       -- L'operatore e la persona si filtrano solo per gli admin.
       and (not v.is_admin or p_filter_operator is null or a.operator_id = p_filter_operator)
       and (v.is_admin or gw_audit_kind(a.entity) in ('iscrizioni', 'pagamenti', 'spese', 'trasferimenti', 'riporti', 'conti'))
       -- Del workshop l'organizzatrice vede solo i cambi dello stato dei conti.
       and (v.is_admin or a.entity <> 'workshop' or (
             a.before is not null and a.after is not null
             and ((a.before -> 'settlement_status') is distinct from (a.after -> 'settlement_status')
                  or (a.before -> 'verified_at') is distinct from (a.after -> 'verified_at'))))
  ),
  placed as (
    select b.*,
           case b.entity
             when 'workshop' then b.entity_id
             when 'expense' then (select e.workshop_id from gw_expenses e where e.id = b.entity_id)
             when 'transfer' then (select t.workshop_id from gw_transfers t where t.id = b.entity_id)
             when 'carryover' then (select c.origin_workshop_id from gw_carryovers c where c.id = b.entity_id)
             else (select bk.workshop_id from gw_bookings bk where bk.id = b.booking_id)
           end as workshop_id
      from base b
     -- Una riga che, tolti i campi che l'organizzatrice non vede, non cambia niente non si mostra.
     where b.is_admin or b.before is distinct from b.after
  ),
  filtered as (
    select f.*
      from placed f
     where (p_workshop_id is null
            or f.workshop_id = p_workshop_id
            or (f.entity = 'carryover' and exists (
                  select 1 from gw_carryovers c where c.id = f.entity_id and c.destination_workshop_id = p_workshop_id)))
       and (not f.is_admin or p_person_id is null
            or f.person_id = p_person_id
            or (f.booking_id is not null and exists (
                  select 1 from gw_booking_participants bp where bp.booking_id = f.booking_id and bp.person_id = p_person_id)))
  )
  select f.id,
         f.created_at,
         f.operator_id,
         -- D25: all'organizzatrice solo il ruolo di chi ha fatto la modifica, mai il nome.
         case when f.is_admin then o.display_name end,
         o.role::text,
         f.entity,
         f.entity_id,
         f.action::text,
         f.before,
         f.after,
         f.kind,
         f.workshop_id,
         w.name,
         case
           when f.is_admin and f.person_id is not null then gw_person_label(f.person_id)
           when f.is_admin and f.booking_id is not null then (
             select gw_person_label(bp.person_id)
               from gw_booking_participants bp
              where bp.booking_id = f.booking_id
              order by bp.removed_at is not null, bp.is_primary desc, bp.added_at
              limit 1)
           -- Organizzatrice: la persona solo come l'ha scritta lei.
           when f.booking_id is not null then (
             select bp.entered_as
               from gw_booking_participants bp
              where bp.booking_id = f.booking_id and bp.entered_as is not null
              order by bp.removed_at is not null, bp.is_primary desc, bp.added_at
              limit 1)
         end,
         count(*) over ()
    from filtered f
    left join gw_operators o on o.id = f.operator_id
    left join gw_workshops w on w.id = f.workshop_id
   order by f.created_at desc, f.id desc
  offset greatest(coalesce(p_offset, 0), 0)
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.gw_set_present(uuid, uuid, integer, boolean)',
    'public.gw_audit_kind(text)',
    'public.gw_audit_clean(jsonb)',
    'public.gw_audit_organizer_view(jsonb)',
    'public.gw_audit_list(public.gw_operator_role, uuid, uuid, text, uuid, integer, integer)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;

-- PostgREST: ricarica lo schema per vedere la colonna e le funzioni nuove.
notify pgrst, 'reload schema';
