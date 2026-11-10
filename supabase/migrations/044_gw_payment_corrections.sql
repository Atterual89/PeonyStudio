-- Correzioni auditabili delle quote da email, senza eliminare il movimento originale.
begin;
create table if not exists public.gw_association_payment_corrections (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null references public.gw_association_payment_emails(id),
 allocation_id uuid,
 slot smallint,
 person_id uuid,
 member_key text,
 operation text not null check(operation in ('unassign','ignore','restore')),
 reason text,
 operator_id uuid not null,
 created_at timestamptz not null default now()
);
create index if not exists gw_payment_corrections_payment_idx
 on public.gw_association_payment_corrections(payment_id,created_at desc);
alter table public.gw_association_payment_corrections enable row level security;
revoke all on public.gw_association_payment_corrections from public,anon,authenticated;
grant select,insert on public.gw_association_payment_corrections to service_role;

create or replace function public.gw_unassign_association_payment(
 p_allocation_id uuid, p_operator_id uuid, p_reason text default null
) returns void language plpgsql security invoker set search_path=public,pg_temp
as $$
declare
 v_alloc public.gw_association_payment_allocations%rowtype;
 v_payment public.gw_association_payment_emails%rowtype;
 v_evidence record;
 v_other integer;
begin
 if p_operator_id is null then raise exception 'Operatore obbligatorio'; end if;
 select * into v_alloc from public.gw_association_payment_allocations
  where id=p_allocation_id for update;
 if not found then raise exception 'Abbinamento non trovato'; end if;
 select * into v_payment from public.gw_association_payment_emails
  where id=v_alloc.payment_id for update;
 if not found then raise exception 'Pagamento non trovato'; end if;
 -- L'abbinamento e la verifica sono corretti insieme in una transazione.
 select count(*) into v_other from public.gw_association_payment_allocations
  where id<>v_alloc.id and person_id is not distinct from v_alloc.person_id
   and member_key is not distinct from v_alloc.member_key and period_from=v_alloc.period_from;
 -- Rimuovi soltanto la verifica creata proprio da questa email; mai moduli Google
 -- o verifiche indipendenti. La verifica manuale sostituita richiede revisione.
 if v_other=0 then
  for v_evidence in
   select id,notes_admin from public.association_members
   where source='manual_override'
    and membership_starts_at=v_alloc.period_from
    and notes_admin like 'Quota confermata da email (riferimento '||v_alloc.payment_id::text||')%'
   for update
  loop
   if v_evidence.notes_admin like '%sostituisce verifica manuale%' then
    update public.association_members set membership_status='pending',
      notes_admin='Quota email disassociata; precedente verifica manuale da ricontrollare',
      updated_at=now() where id=v_evidence.id;
   else
    delete from public.association_members where id=v_evidence.id;
   end if;
  end loop;
 end if;
 insert into public.gw_association_payment_corrections
  (payment_id,allocation_id,slot,person_id,member_key,operation,reason,operator_id)
 values(v_alloc.payment_id,v_alloc.id,v_alloc.slot,v_alloc.person_id,v_alloc.member_key,
  'unassign',nullif(btrim(coalesce(p_reason,'')),''),p_operator_id);
 delete from public.gw_association_payment_allocations where id=v_alloc.id;
 update public.gw_association_payment_emails set status='pending',updated_at=now()
  where id=v_alloc.payment_id;
end;
$$;
revoke execute on function public.gw_unassign_association_payment(uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.gw_unassign_association_payment(uuid,uuid,text) to service_role;
commit;
notify pgrst, 'reload schema';
