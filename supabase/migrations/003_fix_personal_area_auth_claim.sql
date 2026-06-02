-- Personal area auth claim support.
-- The dashboard claim is executed server-side with the service role key, but
-- RLS still protects direct client access to personal data.

alter table public.profiles enable row level security;
alter table public.user_event_enrollments enable row level security;
alter table public.event_participants enable row level security;
alter table public.ticket_tailor_orders enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can read own event enrollments" on public.user_event_enrollments;
create policy "Users can read own event enrollments"
on public.user_event_enrollments
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists "Users can read own ticket tailor orders" on public.ticket_tailor_orders;
create policy "Users can read own ticket tailor orders"
on public.ticket_tailor_orders
for select
to authenticated
using (buyer_profile_id = auth.uid());

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

create unique index if not exists user_event_enrollments_profile_order_unique
on public.user_event_enrollments (profile_id, ticket_tailor_order_id)
where ticket_tailor_order_id is not null;
