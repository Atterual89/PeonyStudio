-- Gestionale Workshop — schema v1 (docs/gestionale/00-contesto.md, sezioni 4.1–4.3)
--
-- Migrazione SOLO ADDITIVA: crea esclusivamente oggetti con prefisso gw_ e non
-- tocca tabelle, funzioni o policy esistenti del sito.
-- Rollback: 010_gw_schema_v1.down.sql
--
-- Modello di accesso: tutte le tabelle gw_ hanno RLS attiva SENZA policy e
-- nessun privilegio per anon/authenticated. Solo il server (service role)
-- legge e scrive. Le operazioni su più tabelle sono funzioni gw_* invocate via
-- rpc, eseguibili solo dalla service role.

begin;

-- ---------------------------------------------------------------------------
-- 0. Controllo preliminare: nessun oggetto gw_ deve esistere già
-- ---------------------------------------------------------------------------
do $$
declare
  existing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into existing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and c.relname like 'gw\_%';

  if existing is not null then
    raise exception
      'Migrazione gw_schema_v1 interrotta: esistono già tabelle gw_ non create da questa migrazione: %',
      existing;
  end if;

  select string_agg(t.typname, ', ' order by t.typname)
    into existing
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typtype = 'e'
    and t.typname like 'gw\_%';

  if existing is not null then
    raise exception
      'Migrazione gw_schema_v1 interrotta: esistono già tipi gw_: %',
      existing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------------
create type public.gw_party as enum ('peony', 'redsabbath');
create type public.gw_settlement_status as enum ('provvisorio', 'verificato', 'da_conguagliare', 'conguagliato');
create type public.gw_booking_status as enum ('interessato', 'confermato', 'lista_attesa', 'cancellato');
create type public.gw_invoice_status as enum ('non_richiesta', 'richiesta', 'emessa');
create type public.gw_attendance as enum ('non_registrata', 'presente', 'assente');
create type public.gw_payment_kind as enum ('pagamento', 'rimborso', 'rettifica');
create type public.gw_payment_method as enum ('contanti', 'paypal', 'bonifico', 'altro');
create type public.gw_transfer_status as enum ('da_eseguire', 'eseguito');
create type public.gw_carryover_status as enum ('aperto', 'chiuso');
create type public.gw_membership_status as enum ('in_regola', 'non_associato');
create type public.gw_audit_action as enum ('insert', 'update', 'delete', 'merge', 'login', 'logout');

-- ---------------------------------------------------------------------------
-- 2. Funzioni trigger
-- ---------------------------------------------------------------------------
create function public.gw_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Tabelle append-only (storico, tentativi di accesso, sblocchi): niente
-- UPDATE né DELETE.
create function public.gw_forbid_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'La tabella % è append-only: % non consentito', tg_table_name, tg_op;
end;
$$;

-- gw_payments: mai DELETE, mai UPDATE dei campi economici.
-- Correggere un pagamento = inserire una rettifica (corrects_payment_id).
create function public.gw_payments_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'gw_payments: i pagamenti non si cancellano, inserisci una rettifica';
  end if;

  if new.booking_id is distinct from old.booking_id
     or new.kind is distinct from old.kind
     or new.amount_cents is distinct from old.amount_cents
     or new.received_by is distinct from old.received_by
     or new.corrects_payment_id is distinct from old.corrects_payment_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'gw_payments: importo, tipo, prenotazione e incassante non sono modificabili, inserisci una rettifica';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Operatori e autenticazione
-- ---------------------------------------------------------------------------
create table public.gw_operators (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  pin_hash text not null check (pin_hash like 'scrypt$%'),
  active boolean not null default true,
  pin_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index gw_operators_display_name_key
  on public.gw_operators (lower(btrim(display_name)));

create table public.gw_sessions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.gw_operators (id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  updated_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '90 days')
);

create index gw_sessions_operator_idx on public.gw_sessions (operator_id) where revoked_at is null;

create table public.gw_login_attempts (
  id bigint generated always as identity primary key,
  operator_id uuid references public.gw_operators (id),
  ip_hash text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index gw_login_attempts_ip_idx on public.gw_login_attempts (ip_hash, created_at desc);
create index gw_login_attempts_failures_idx on public.gw_login_attempts (created_at desc) where not success;

-- Registro degli sblocchi eseguiti con unlock.mjs: i tentativi falliti
-- precedenti all'ultimo sblocco non contano più per i blocchi.
create table public.gw_login_unlocks (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Workshop, persone, iscrizioni
-- ---------------------------------------------------------------------------
create table public.gw_workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  starts_on date not null,
  ends_on date,
  description text,
  capacity integer check (capacity is null or capacity > 0),
  default_fee_cents bigint check (default_fee_cents is null or default_fee_cents >= 0),
  peony_pct numeric(5, 2) not null default 30 check (peony_pct >= 0 and peony_pct <= 100),
  loss_peony_cents bigint check (loss_peony_cents is null or loss_peony_cents >= 0),
  settlement_status public.gw_settlement_status not null default 'provvisorio',
  verified_snapshot jsonb,
  verified_at timestamptz,
  verified_by uuid references public.gw_operators (id),
  personal_tax_notes text,
  created_by uuid references public.gw_operators (id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index gw_workshops_starts_on_idx on public.gw_workshops (starts_on desc);

create table public.gw_people (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  nickname text,
  email text,
  instagram text,
  phone text,
  teamartist_id text,
  -- Riga di association_members (stesso tipo della sua PK). Volutamente
  -- SENZA foreign key: la tabella esistente del sito non si tocca (D11).
  association_member_id uuid,
  notes text,
  merged_into uuid references public.gw_people (id),
  created_by uuid references public.gw_operators (id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    nullif(btrim(first_name), '') is not null
    or nullif(btrim(nickname), '') is not null
  ),
  check (merged_into is null or merged_into <> id)
);

create index gw_people_nickname_idx on public.gw_people (lower(nickname));
create index gw_people_first_name_idx on public.gw_people (lower(first_name));
create index gw_people_last_name_idx on public.gw_people (lower(last_name));
create index gw_people_email_idx on public.gw_people (lower(email));
create index gw_people_instagram_idx on public.gw_people (lower(instagram));
create index gw_people_merged_into_idx on public.gw_people (merged_into) where merged_into is not null;
create index gw_people_association_member_idx on public.gw_people (association_member_id)
  where association_member_id is not null;

create table public.gw_bookings (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.gw_workshops (id),
  status public.gw_booking_status not null default 'confermato',
  agreed_fee_cents bigint check (agreed_fee_cents is null or agreed_fee_cents >= 0),
  invoice_status public.gw_invoice_status not null default 'non_richiesta',
  notes text,
  created_by uuid references public.gw_operators (id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Serve alla FK composta di gw_booking_participants.
  unique (id, workshop_id)
);

create index gw_bookings_workshop_idx on public.gw_bookings (workshop_id);

create table public.gw_booking_participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  workshop_id uuid not null,
  person_id uuid not null references public.gw_people (id),
  attendance public.gw_attendance not null default 'non_registrata',
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- workshop_id denormalizzato: la FK composta garantisce che coincida con
  -- quello della prenotazione.
  foreign key (booking_id, workshop_id) references public.gw_bookings (id, workshop_id),
  check (removed_at is null or removed_at >= added_at)
);

-- Una persona non può avere due iscrizioni attive allo stesso workshop.
create unique index gw_booking_participants_active_key
  on public.gw_booking_participants (workshop_id, person_id)
  where removed_at is null;

create index gw_booking_participants_booking_idx on public.gw_booking_participants (booking_id);
create index gw_booking_participants_person_idx on public.gw_booking_participants (person_id);

-- ---------------------------------------------------------------------------
-- 5. Movimenti economici
-- ---------------------------------------------------------------------------
create table public.gw_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.gw_bookings (id),
  kind public.gw_payment_kind not null,
  amount_cents bigint not null,
  paid_on date not null,
  method public.gw_payment_method,
  received_by public.gw_party not null,
  description text,
  corrects_payment_id uuid references public.gw_payments (id),
  created_by uuid references public.gw_operators (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'pagamento' and amount_cents > 0)
    or (kind = 'rimborso' and amount_cents < 0)
    or (kind = 'rettifica' and amount_cents <> 0)
  ),
  check (corrects_payment_id is null or kind = 'rettifica'),
  check (corrects_payment_id is null or corrects_payment_id <> id)
);

create index gw_payments_booking_idx on public.gw_payments (booking_id);

create table public.gw_expenses (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.gw_workshops (id),
  description text not null check (btrim(description) <> ''),
  amount_cents bigint not null check (amount_cents > 0),
  advanced_by public.gw_party not null,
  spent_on date,
  created_by uuid references public.gw_operators (id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gw_expenses_workshop_idx on public.gw_expenses (workshop_id);

create table public.gw_transfers (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.gw_workshops (id),
  from_party public.gw_party not null,
  to_party public.gw_party not null,
  amount_cents bigint not null check (amount_cents > 0),
  status public.gw_transfer_status not null default 'da_eseguire',
  executed_on date,
  notes text,
  created_by uuid references public.gw_operators (id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_party <> to_party)
);

create index gw_transfers_workshop_idx on public.gw_transfers (workshop_id);

create table public.gw_carryovers (
  id uuid primary key default gen_random_uuid(),
  origin_workshop_id uuid not null references public.gw_workshops (id),
  destination_workshop_id uuid not null references public.gw_workshops (id),
  debtor public.gw_party not null,
  creditor public.gw_party not null,
  amount_cents bigint not null check (amount_cents > 0),
  status public.gw_carryover_status not null default 'aperto',
  notes text,
  created_by uuid references public.gw_operators (id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_workshop_id <> destination_workshop_id),
  check (debtor <> creditor)
);

create index gw_carryovers_origin_idx on public.gw_carryovers (origin_workshop_id);
create index gw_carryovers_destination_idx on public.gw_carryovers (destination_workshop_id);

-- ---------------------------------------------------------------------------
-- 6. Associazione (D11)
-- ---------------------------------------------------------------------------
-- Lo stato socio si legge in sola lettura da association_members (tramite
-- gw_people.association_member_id). Qui vanno solo le correzioni manuali,
-- quando il libro soci è incompleto: un override per persona e anno.
create table public.gw_membership_overrides (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.gw_people (id),
  year integer not null check (year between 2000 and 2100),
  status public.gw_membership_status not null,
  notes text,
  created_by uuid references public.gw_operators (id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, year)
);

-- ---------------------------------------------------------------------------
-- 7. Storico modifiche
-- ---------------------------------------------------------------------------
create table public.gw_audit_log (
  id bigint generated always as identity primary key,
  -- null = operazione eseguita da uno script da terminale
  operator_id uuid references public.gw_operators (id),
  entity text not null,
  entity_id uuid,
  action public.gw_audit_action not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index gw_audit_log_entity_idx on public.gw_audit_log (entity, entity_id, created_at desc);
create index gw_audit_log_created_idx on public.gw_audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- 8. Trigger
-- ---------------------------------------------------------------------------
create trigger gw_operators_updated_at before update on public.gw_operators
  for each row execute function public.gw_set_updated_at();
create trigger gw_sessions_updated_at before update on public.gw_sessions
  for each row execute function public.gw_set_updated_at();
create trigger gw_workshops_updated_at before update on public.gw_workshops
  for each row execute function public.gw_set_updated_at();
create trigger gw_people_updated_at before update on public.gw_people
  for each row execute function public.gw_set_updated_at();
create trigger gw_bookings_updated_at before update on public.gw_bookings
  for each row execute function public.gw_set_updated_at();
create trigger gw_booking_participants_updated_at before update on public.gw_booking_participants
  for each row execute function public.gw_set_updated_at();
create trigger gw_payments_updated_at before update on public.gw_payments
  for each row execute function public.gw_set_updated_at();
create trigger gw_expenses_updated_at before update on public.gw_expenses
  for each row execute function public.gw_set_updated_at();
create trigger gw_transfers_updated_at before update on public.gw_transfers
  for each row execute function public.gw_set_updated_at();
create trigger gw_carryovers_updated_at before update on public.gw_carryovers
  for each row execute function public.gw_set_updated_at();
create trigger gw_membership_overrides_updated_at before update on public.gw_membership_overrides
  for each row execute function public.gw_set_updated_at();

create trigger gw_payments_guard before update or delete on public.gw_payments
  for each row execute function public.gw_payments_guard();

create trigger gw_audit_log_append_only before update or delete on public.gw_audit_log
  for each row execute function public.gw_forbid_change();
create trigger gw_login_attempts_append_only before update or delete on public.gw_login_attempts
  for each row execute function public.gw_forbid_change();
create trigger gw_login_unlocks_append_only before update or delete on public.gw_login_unlocks
  for each row execute function public.gw_forbid_change();

-- ---------------------------------------------------------------------------
-- 9. Funzioni applicative (operazioni su più tabelle, atomiche)
-- ---------------------------------------------------------------------------

-- Login riuscito: tentativo + sessione + storico.
create function public.gw_login_succeeded(
  p_operator_id uuid,
  p_token_hash text,
  p_ip_hash text,
  p_user_agent text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
begin
  if not exists (select 1 from gw_operators where id = p_operator_id and active) then
    raise exception 'Operatore non attivo';
  end if;

  insert into gw_login_attempts (operator_id, ip_hash, success)
  values (p_operator_id, p_ip_hash, true);

  insert into gw_sessions (operator_id, token_hash, expires_at, user_agent)
  values (p_operator_id, p_token_hash, p_expires_at, left(p_user_agent, 300))
  returning id into v_session_id;

  insert into gw_audit_log (operator_id, entity, entity_id, action, after)
  values (p_operator_id, 'session', v_session_id, 'login', jsonb_build_object('expires_at', p_expires_at));

  return v_session_id;
end;
$$;

-- Logout: revoca della sessione + storico.
create function public.gw_logout(p_operator_id uuid, p_session_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update gw_sessions
     set revoked_at = now()
   where id = p_session_id
     and operator_id = p_operator_id
     and revoked_at is null;

  if found then
    insert into gw_audit_log (operator_id, entity, entity_id, action)
    values (p_operator_id, 'session', p_session_id, 'logout');
  end if;
end;
$$;

-- set-pin.mjs: crea l'operatore se non esiste, altrimenti sostituisce il PIN;
-- in entrambi i casi revoca tutte le sue sessioni. Lo storico non contiene
-- mai l'hash del PIN.
create function public.gw_set_operator_pin(
  p_operator_id uuid,
  p_display_name text,
  p_pin_hash text
)
returns table (out_operator_id uuid, out_created boolean, out_revoked_sessions integer)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_created boolean := false;
  v_revoked integer := 0;
begin
  select o.id into v_id
    from gw_operators o
   where lower(btrim(o.display_name)) = lower(btrim(p_display_name))
   for update;

  if v_id is null then
    insert into gw_operators (display_name, pin_hash)
    values (btrim(p_display_name), p_pin_hash)
    returning id into v_id;
    v_created := true;

    insert into gw_audit_log (operator_id, entity, entity_id, action, after)
    values (p_operator_id, 'operator', v_id, 'insert',
            jsonb_build_object('display_name', btrim(p_display_name), 'active', true));
  else
    update gw_operators
       set pin_hash = p_pin_hash,
           pin_updated_at = now()
     where id = v_id;

    insert into gw_audit_log (operator_id, entity, entity_id, action, after)
    values (p_operator_id, 'operator', v_id, 'update', jsonb_build_object('pin_changed', true));
  end if;

  update gw_sessions s
     set revoked_at = now()
   where s.operator_id = v_id
     and s.revoked_at is null;
  get diagnostics v_revoked = row_count;

  return query select v_id, v_created, v_revoked;
end;
$$;

-- revoke-sessions.mjs
create function public.gw_revoke_operator_sessions(p_operator_id uuid, p_display_name text)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_revoked integer := 0;
begin
  select o.id into v_id
    from gw_operators o
   where lower(btrim(o.display_name)) = lower(btrim(p_display_name));

  if v_id is null then
    raise exception 'Operatore "%" non trovato', p_display_name;
  end if;

  update gw_sessions s
     set revoked_at = now()
   where s.operator_id = v_id
     and s.revoked_at is null;
  get diagnostics v_revoked = row_count;

  insert into gw_audit_log (operator_id, entity, entity_id, action, after)
  values (p_operator_id, 'operator', v_id, 'update', jsonb_build_object('sessions_revoked', v_revoked));

  return v_revoked;
end;
$$;

-- unlock.mjs: azzera tutti i blocchi (per IP e globale).
create function public.gw_unlock_logins(p_operator_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  insert into gw_login_unlocks default values returning id into v_id;

  insert into gw_audit_log (operator_id, entity, entity_id, action, after)
  values (p_operator_id, 'login_unlock', null, 'insert', jsonb_build_object('unlock_id', v_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Sicurezza: RLS senza policy, nessun privilegio per anon/authenticated
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'gw_operators', 'gw_sessions', 'gw_login_attempts', 'gw_login_unlocks',
    'gw_workshops', 'gw_people', 'gw_bookings', 'gw_booking_participants',
    'gw_payments', 'gw_expenses', 'gw_transfers', 'gw_carryovers',
    'gw_membership_overrides', 'gw_audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end;
$$;

revoke all on sequence public.gw_login_attempts_id_seq from public, anon, authenticated;
revoke all on sequence public.gw_login_unlocks_id_seq from public, anon, authenticated;
revoke all on sequence public.gw_audit_log_id_seq from public, anon, authenticated;
grant usage, select on sequence public.gw_login_attempts_id_seq to service_role;
grant usage, select on sequence public.gw_login_unlocks_id_seq to service_role;
grant usage, select on sequence public.gw_audit_log_id_seq to service_role;

-- Per default Postgres rende le funzioni eseguibili da PUBLIC.
revoke execute on function public.gw_set_updated_at() from public, anon, authenticated;
revoke execute on function public.gw_forbid_change() from public, anon, authenticated;
revoke execute on function public.gw_payments_guard() from public, anon, authenticated;
revoke execute on function public.gw_login_succeeded(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.gw_logout(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.gw_set_operator_pin(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.gw_revoke_operator_sessions(uuid, text) from public, anon, authenticated;
revoke execute on function public.gw_unlock_logins(uuid) from public, anon, authenticated;

grant execute on function public.gw_login_succeeded(uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.gw_logout(uuid, uuid) to service_role;
grant execute on function public.gw_set_operator_pin(uuid, text, text) to service_role;
grant execute on function public.gw_revoke_operator_sessions(uuid, text) to service_role;
grant execute on function public.gw_unlock_logins(uuid) to service_role;

commit;
