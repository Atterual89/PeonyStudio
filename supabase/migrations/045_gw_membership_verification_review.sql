-- Revoca selettiva di una verifica amministrativa con registro immutabile.
begin;
create table if not exists public.gw_membership_verification_corrections (
 id uuid primary key default gen_random_uuid(),
 evidence_id uuid not null,
 person_id uuid not null,
 operator_id uuid not null,
 reason text not null,
 evidence_before jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists gw_membership_verification_corrections_evidence_idx
 on public.gw_membership_verification_corrections(evidence_id,created_at desc);
alter table public.gw_membership_verification_corrections enable row level security;
revoke all on public.gw_membership_verification_corrections from public,anon,authenticated;
grant select,insert on public.gw_membership_verification_corrections to service_role;

create or replace function public.gw_revoke_membership_verification(
 p_evidence_id uuid,p_person_id uuid,p_operator_id uuid,p_reason text
) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 v_evidence public.association_members%rowtype;
 v_person public.gw_people%rowtype;
 v_payment_id uuid;
 v_has_linked_allocation boolean;
begin
 if p_operator_id is null or length(btrim(coalesce(p_reason,'')))<5
 then raise exception 'Motivazione obbligatoria (minimo 5 caratteri)'; end if;
 select * into v_person from public.gw_people where id=p_person_id
  and deleted_at is null and merged_into is null;
 if not found then raise exception 'Persona non disponibile'; end if;
 select * into v_evidence from public.association_members
  where id=p_evidence_id for update;
 if not found or v_evidence.source<>'manual_override' or v_evidence.membership_status<>'verified'
 then raise exception 'Solo le verifiche amministrative attive possono essere revocate'; end if;
 -- Evita la revoca di una quota appartenente a un omonimo o a un'email condivisa.
 if not (
  (nullif(lower(btrim(coalesce(v_evidence.email,''))),'') is not null
   and lower(btrim(v_evidence.email)) in
     (lower(btrim(coalesce(v_person.email,''))),lower(btrim(coalesce(v_person.membership_email,''))))
   and (lower(btrim(coalesce(v_evidence.first_name,'')))=lower(btrim(coalesce(v_person.first_name,'')))
     and lower(btrim(coalesce(v_evidence.last_name,'')))=lower(btrim(coalesce(v_person.last_name,'')))))
  or (v_evidence.email is null and
    lower(btrim(coalesce(v_evidence.first_name,'')))=lower(btrim(coalesce(v_person.first_name,'')))
    and lower(btrim(coalesce(v_evidence.last_name,'')))=lower(btrim(coalesce(v_person.last_name,''))))
 ) then raise exception 'La verifica non corrisponde alla persona selezionata'; end if;
 -- Se l'evidenza proviene da un pagamento assegnato ALLA STESSA persona,
 -- bisogna usare Disassocia nella scheda di quel pagamento.
 v_payment_id:=substring(coalesce(v_evidence.notes_admin,'')
   from 'riferimento ([0-9a-fA-F-]{36})')::uuid;
 if v_payment_id is not null then
  select exists(select 1 from public.gw_association_payment_allocations
    where payment_id=v_payment_id and person_id=p_person_id)
  into v_has_linked_allocation;
  if v_has_linked_allocation then
   raise exception 'Quota collegata a un pagamento attivo: disassocia il pagamento';
  end if;
 end if;
 insert into public.gw_membership_verification_corrections
   (evidence_id,person_id,operator_id,reason,evidence_before)
 values(p_evidence_id,p_person_id,p_operator_id,left(btrim(p_reason),300),to_jsonb(v_evidence));
 update public.association_members
  set membership_status='pending',notes_admin=concat_ws(' | ',v_evidence.notes_admin,
    'Verifica revocata: '||left(btrim(p_reason),300)),updated_at=now()
  where id=p_evidence_id and membership_status='verified';
 if not found then raise exception 'Revoca non riuscita'; end if;
end;
$$;
revoke execute on function public.gw_revoke_membership_verification(uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.gw_revoke_membership_verification(uuid,uuid,uuid,text) to service_role;
commit;
notify pgrst, 'reload schema';
