import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {MIGRATIONS,createTestDb} from "./pglite";
const sql=(p:string)=>readFileSync(join(process.cwd(),"supabase/migrations",p),"utf8");

describe("prova email su quota segnata manualmente",()=>{
 it("sostituisce la verifica manuale senza creare una seconda quota e protegge il registro ufficiale",async()=>{
  const t=await createTestDb(MIGRATIONS,{supabaseDefaults:true});
  await t.db.exec(`create table public.ticket_tailor_issued_tickets(
    ticket_tailor_event_id text,status text,last_synced_at timestamptz);`);
  await t.db.exec(sql("029_gw_association_payment_emails.sql"));
  await t.db.exec(sql("035_gw_email_payment_over_manual.sql"));
  const operator=await t.operator();
  const person=await t.value<string>(`select gw_create_person($1,'{"first_name":"Elena","last_name":"Verdi","email":"elena@example.test"}'::jsonb) v`,[operator]);
  const previous=await t.value<string>(`insert into public.association_members
    (first_name,last_name,email,source,membership_status,membership_starts_at,
     membership_expires_at,source_row_id,notes_admin)
    values('Elena','Verdi','elena@example.test','manual_override','verified',
      date '2027-01-01',date '2027-12-31','manual:email:elena@example.test:2027-01-01','Validazione manuale da admin')
    returning id v`);
  const pay=await t.value<string>(`insert into gw_association_payment_emails
    (gmail_message_id,provider,paid_at,payer_name,amount_cents)
    values('precedence-mail','qonto',now(),'Elena Verdi',1500) returning id v`);
  const confirm=()=>t.value<number>(`select gw_confirm_association_payment(
    $1::uuid,$2::uuid,null::text,date '2027-01-01',date '2027-12-31',$3::uuid,
    'Elena','Verdi','elena@example.test') v`,[pay,person,operator]);
  expect(await confirm()).toBe(1);
  expect(await t.value<number>(`select count(*)::int v from association_members
    where source='manual_override' and lower(email)='elena@example.test'`)).toBe(1);
  expect(await t.value<string>(`select id::text v from association_members
    where source='manual_override' and lower(email)='elena@example.test'`)).toBe(previous);
  const note=await t.value<string>(`select notes_admin v from association_members where id=$1`,[previous]);
  expect(note).toContain("Quota confermata da email");
  expect(note).toContain("sostituisce verifica manuale");
  expect(await t.value<number>(`select count(*)::int v from gw_association_payment_allocations`)).toBe(1);
  expect(await t.error(`select gw_confirm_association_payment(
    $1::uuid,$2::uuid,null::text,date '2027-01-01',date '2027-12-31',$3::uuid,
    'Elena','Verdi','elena@example.test')`,[pay,person,operator])).not.toBeNull();
  expect(await t.value<string>(`select status v from gw_association_payment_emails where id=$1`,[pay])).toBe("confirmed");
  expect(await t.value<boolean>(`select has_function_privilege('anon',
    'public.gw_confirm_association_payment(uuid,uuid,text,date,date,uuid,text,text,text)','EXECUTE') v`)).toBe(false);
 });
});
