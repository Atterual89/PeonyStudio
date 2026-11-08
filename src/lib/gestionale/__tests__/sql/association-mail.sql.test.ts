// End-to-end schema validation against real PostgreSQL semantics in PGlite.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, createTestDb } from "./pglite";

describe("quote associative email: SQL, atomicità e permessi", () => {
  it("applica la migrazione, divide 30 euro e non duplica le quote", async () => {
    const t=await createTestDb(MIGRATIONS,{supabaseDefaults:true});
    await t.db.exec(`
      create table public.ticket_tailor_issued_tickets(
        ticket_tailor_event_id text, status text, last_synced_at timestamptz
      );
    `);
    const sql=readFileSync(join(process.cwd(),"supabase/migrations/029_gw_association_payment_emails.sql"),"utf8");
    await t.db.exec(sql);
    const op=await t.operator();
    const a=await t.value<string>(`select gw_create_person($1,'{"first_name":"Anna","last_name":"Rossi","email":"anna@example.test"}'::jsonb) v`,[op]);
    const b=await t.value<string>(`select gw_create_person($1,'{"first_name":"Bruno","last_name":"Verdi","email":"bruno@example.test"}'::jsonb) v`,[op]);
    const payment=await t.value<string>(`
      insert into gw_association_payment_emails(gmail_message_id,provider,paid_at,payer_name,amount_cents)
      values('mail-test-1','paypal',now(),'Anna Rossi',3000) returning id v
    `);
    const make=(id:string,first:string,last:string,email:string)=>
      t.value<number>(`select gw_confirm_association_payment(
        $1::uuid,$2::uuid,null::text,date '2025-09-01',date '2026-12-31',$3::uuid,$4,$5,$6) v`,
       [payment,id,op,first,last,email]);
    expect(await make(a,"Anna","Rossi","anna@example.test")).toBe(1);
    expect(await t.value(`select status v from gw_association_payment_emails where id=$1`,[payment])).toBe("pending");
    expect(await make(b,"Bruno","Verdi","bruno@example.test")).toBe(2);
    expect(await t.value(`select status v from gw_association_payment_emails where id=$1`,[payment])).toBe("confirmed");
    expect(await t.value<number>(`select count(*)::int v from association_members where source='manual_override' and membership_status='verified'`)).toBe(2);
    expect(await t.value<number>(`select count(*)::int v from gw_association_payment_allocations where payment_id=$1`,[payment])).toBe(2);
    expect(await t.error(`select gw_confirm_association_payment(
      $1::uuid,$2::uuid,null::text,date '2025-09-01',date '2026-12-31',$3::uuid,'Anna','Rossi','anna@example.test')`,
      [payment,a,op])).not.toBeNull();
    expect(await t.value<boolean>(`select has_function_privilege('anon',
      'public.gw_confirm_association_payment(uuid,uuid,text,date,date,uuid,text,text,text)','EXECUTE') v`)).toBe(false);
    expect(await t.value<boolean>(`select has_function_privilege('authenticated',
      'public.gw_payment_suggest_people()','EXECUTE') v`)).toBe(false);
  });
});
