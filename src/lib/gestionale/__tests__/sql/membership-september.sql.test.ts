import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, createTestDb } from "./pglite";

const migration = (file: string) =>
  readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8");

describe("RPC quote associative: confine del 1 settembre", () => {
  it("conferma l'annualità dalla data di versamento, non da un periodo scelto liberamente", async () => {
    const t = await createTestDb(MIGRATIONS, { supabaseDefaults: true });
    await t.db.exec(`
      create table public.ticket_tailor_issued_tickets(
        ticket_tailor_event_id text, status text, last_synced_at timestamptz
      );
    `);
    await t.db.exec(migration("029_gw_association_payment_emails.sql"));
    await t.db.exec(migration("035_gw_email_payment_over_manual.sql"));
    await t.db.exec(migration("043_membership_september_renewal.sql"));

    const operator = await t.operator();
    const person = await t.value<string>(
      `select gw_create_person($1,'{"first_name":"Lia","last_name":"Rossi","email":"lia@example.test"}'::jsonb) v`,
      [operator],
    );
    const before = await t.value<string>(`
      insert into gw_association_payment_emails(gmail_message_id,provider,paid_at,payer_name,amount_cents)
      values('31-aug-2026','qonto','2026-08-31T11:00:00+02','Lia Rossi',1500)
      returning id v
    `);
    const after = await t.value<string>(`
      insert into gw_association_payment_emails(gmail_message_id,provider,paid_at,payer_name,amount_cents)
      values('01-sep-2026','qonto','2026-09-01T00:30:00+02','Lia Rossi',1500)
      returning id v
    `);
    const assign = (paymentId: string, from: string, until: string) =>
      t.value<number>(
        `select gw_confirm_association_payment($1::uuid,$2::uuid,null::text,$3::date,$4::date,$5::uuid,'Lia','Rossi','lia@example.test') v`,
        [paymentId, person, from, until, operator],
      );

    expect(await assign(before, "2025-09-01", "2026-12-31")).toBe(1);
    expect(await t.error(
      `select gw_confirm_association_payment($1::uuid,$2::uuid,null::text,date '2025-09-01',date '2026-12-31',$3::uuid,'Lia','Rossi','lia@example.test')`,
      [after, person, operator],
    )).not.toBeNull();
    expect(await assign(after, "2026-09-01", "2027-12-31")).toBe(1);
    expect(await t.value<number>(
      `select count(*)::int v from association_members
        where email='lia@example.test' and source='manual_override'
        and membership_status='verified'`,
    )).toBe(2);
  });
});
