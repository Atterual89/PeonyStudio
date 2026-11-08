import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, createTestDb } from "./pglite";

describe("Quota: prova email prevale sulla verifica manuale senza cancellare lo storico", () => {
  it("sostituisce la prova manuale con email una sola volta e mantiene lo storico", async () => {
    const t = await createTestDb(MIGRATIONS, { supabaseDefaults: true });
    await t.db.exec(`create table public.ticket_tailor_issued_tickets(
      ticket_tailor_event_id text, status text, last_synced_at timestamptz
    );`);
    await t.db.exec(readFileSync(join(process.cwd(),"supabase/migrations/029_gw_association_payment_emails.sql"),"utf8"));
    await t.db.exec(readFileSync(join(process.cwd(),"supabase/migrations/031_gw_email_manual_evidence_priority.sql"),"utf8"));
    const operator=await t.operator();
    const person=await t.value<string>(`select gw_create_person($1,'{"first_name":"Livia","last_name":"Rossi","email":"livia@example.test"}'::jsonb) v`,[operator]);
    const manual=await t.value<string>(`insert into association_members (
      first_name,last_name,email,source,source_row_id,
      membership_status,membership_starts_at,membership_expires_at,notes_admin
    ) values ('Livia','Rossi','livia@example.test','manual_override',
      'manual:email:livia@example.test','verified','2025-09-01','2026-12-31',
      'Controllata manualmente da Ale') returning id v`);
    const payment=await t.value<string>(`insert into gw_association_payment_emails(
      gmail_message_id,provider,paid_at,payer_name,amount_cents
    ) values('mail-upgrade-1','qonto',now(),'Livia Rossi',1500) returning id v`);
    const make=()=>t.value<number>(`select gw_confirm_association_payment(
      $1::uuid,$2::uuid,null::text,date '2025-09-01',date '2026-12-31',
      $3::uuid,'Livia','Rossi','livia@example.test') v`,[payment,person,operator]);
    expect(await make()).toBe(1);
    expect(await t.value<string>(`select status v from gw_association_payment_emails where id=$1`,[payment])).toBe("confirmed");
    expect(await t.value<string>(`select notes_admin v from association_members where id=$1`,[manual]))
      .toContain("Quota confermata da email");
    const history=await t.db.query<{previous_manual_evidence:{notes_admin:string}}>(
      "select previous_manual_evidence from gw_email_manual_supersessions where manual_member_id=$1",[manual]);
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0].previous_manual_evidence.notes_admin).toBe("Controllata manualmente da Ale");
    expect(await t.value<number>("select count(*)::int v from association_members where source='manual_override'")).toBe(1);
    expect(await t.value<number>("select count(*)::int v from gw_association_payment_allocations")).toBe(1);
    expect(await t.error(`select gw_confirm_association_payment(
      $1::uuid,$2::uuid,null::text,date '2025-09-01',date '2026-12-31',
      $3::uuid,'Livia','Rossi','livia@example.test')`,[payment,person,operator])).not.toBeNull();
    expect(await t.value<boolean>(`select has_table_privilege('anon','public.gw_email_manual_supersessions','SELECT') v`)).toBe(false);
  });
});
