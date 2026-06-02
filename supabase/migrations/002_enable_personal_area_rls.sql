-- Row Level Security for Peony Studio personal area tables.
-- This migration is intentionally conservative: anon users can only read public
-- events, while personal data is only visible to the owning authenticated user
-- or admins.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.events enable row level security;
alter table public.profiles enable row level security;
alter table public.ticket_tailor_orders enable row level security;
alter table public.ticket_tailor_issued_tickets enable row level security;
alter table public.event_participants enable row level security;
alter table public.user_event_enrollments enable row level security;

-- Admin policies: full access to personal-area tables.
drop policy if exists "Admins can manage events" on public.events;
create policy "Admins can manage events"
on public.events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage ticket tailor orders" on public.ticket_tailor_orders;
create policy "Admins can manage ticket tailor orders"
on public.ticket_tailor_orders
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage ticket tailor issued tickets" on public.ticket_tailor_issued_tickets;
create policy "Admins can manage ticket tailor issued tickets"
on public.ticket_tailor_issued_tickets
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage event participants" on public.event_participants;
create policy "Admins can manage event participants"
on public.event_participants
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage user event enrollments" on public.user_event_enrollments;
create policy "Admins can manage user event enrollments"
on public.user_event_enrollments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Profiles: users can read their own profile.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- TODO: keep profile updates behind controlled server routes until column-level
-- permissions are defined. Users should not be able to change role,
-- association_status, association_expires_at, or association_notes directly.

-- Events: public events are readable by anon/authenticated users.
-- Private event visibility can be added later when the event/enrollment
-- relation is explicitly represented in the schema.
drop policy if exists "Public events are readable" on public.events;
create policy "Public events are readable"
on public.events
for select
to anon, authenticated
using (is_public = true);

-- User enrollments: users can only read their own rows. Writes are admin-only.
drop policy if exists "Users can read own event enrollments" on public.user_event_enrollments;
create policy "Users can read own event enrollments"
on public.user_event_enrollments
for select
to authenticated
using (profile_id = auth.uid());

-- Ticket Tailor orders: buyers can read their own orders. Writes are admin-only.
drop policy if exists "Users can read own ticket tailor orders" on public.ticket_tailor_orders;
create policy "Users can read own ticket tailor orders"
on public.ticket_tailor_orders
for select
to authenticated
using (buyer_profile_id = auth.uid());

-- Ticket Tailor issued tickets: users can read tickets attached to their own orders.
drop policy if exists "Users can read own ticket tailor issued tickets" on public.ticket_tailor_issued_tickets;
create policy "Users can read own ticket tailor issued tickets"
on public.ticket_tailor_issued_tickets
for select
to authenticated
using (
  exists (
    select 1
    from public.ticket_tailor_orders
    where ticket_tailor_orders.ticket_tailor_order_id = ticket_tailor_issued_tickets.ticket_tailor_order_id
      and ticket_tailor_orders.buyer_profile_id = auth.uid()
  )
);

-- Event participants: users can read their own participant row, rows linked to
-- them as buyer, or rows attached to one of their enrollments/orders. User
-- updates remain disabled for now; partner edits should go through future
-- controlled routes.
drop policy if exists "Users can read related event participants" on public.event_participants;
create policy "Users can read related event participants"
on public.event_participants
for select
to authenticated
using (
  profile_id = auth.uid()
  or linked_buyer_profile_id = auth.uid()
  or exists (
    select 1
    from public.user_event_enrollments
    where user_event_enrollments.ticket_tailor_order_id = event_participants.ticket_tailor_order_id
      and user_event_enrollments.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.ticket_tailor_orders
    where ticket_tailor_orders.ticket_tailor_order_id = event_participants.ticket_tailor_order_id
      and ticket_tailor_orders.buyer_profile_id = auth.uid()
  )
);
