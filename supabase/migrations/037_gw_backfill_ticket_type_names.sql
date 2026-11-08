-- Ticket Tailor /v1/orders stores only ticket_type_id on each issued
-- ticket. Earlier imports did not join it with the event ticket_types array,
-- so the roster could not distinguish Rope Jam observers.
-- Non-destructive: only fills missing names; never modifies tickets, orders,
-- check-ins, memberships or payment allocations.
begin;

with resolved as (
  select t.id as ticket_row_id, tt.item->>'name' as ticket_name
  from public.ticket_tailor_issued_tickets t
  join public.events e on e.ticket_tailor_event_id=t.ticket_tailor_event_id
    and e.source='ticket_tailor'
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(e.raw_payload->'ticket_tailor_original'->'ticket_types')='array'
      then e.raw_payload->'ticket_tailor_original'->'ticket_types'
      else '[]'::jsonb end
  ) as tt(item)
  where nullif(btrim(coalesce(t.ticket_type_name,'')),'') is null
    and nullif(btrim(t.raw_payload->>'ticket_type_id'),'')=tt.item->>'id'
    and nullif(btrim(tt.item->>'name'),'') is not null
)
update public.ticket_tailor_issued_tickets t
set ticket_type_name=resolved.ticket_name
from resolved where t.id=resolved.ticket_row_id
  and nullif(btrim(coalesce(t.ticket_type_name,'')),'') is null;

commit;
