import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, createTestDb } from "./pglite";

function migration(name: string): string {
  return readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("notifiche Ale: solo nuove iscrizioni e contatti, per ciascun admin", () => {
  it("crea inbox individuali, link e nessun duplicato su modifiche/import ripetuti", async () => {
    const t = await createTestDb(MIGRATIONS, { supabaseDefaults: true });
    await t.db.exec(migration("038_gw_billing_directory.sql"));
    await t.db.exec(migration("039_gw_ale_contacts_admin_matching.sql"));
    await t.db.exec(migration("041_gw_ale_admin_notifications.sql"));

    const ale = await t.operator("Alessandra");
    const adminA = await t.operator("Laura");
    const adminB = await t.operator("Andrea");
    await t.db.query("update gw_operators set role='organizzatrice' where id=$1", [ale]);
    await t.db.query("update gw_operators set role='admin' where id in ($1,$2)", [adminA, adminB]);

    const workshop = await t.value<string>(
      "select gw_ensure_workshop_for_event($1,'eeeeeeee-0000-4000-8000-000000000397','KL Level 1','2027-02-19',null) v", [ale]);
    await t.db.query(
      "select gw_update_workshop_settings($1,$2,(select version from gw_workshops where id=$2),'{\"default_fee_cents\":53000}'::jsonb)",
      [ale, workshop]);
    const booking = await t.value<string>(
      "select gw_create_booking_entered($1,$2,$3::jsonb,'prenotato',null,null) v",
      [ale, workshop, JSON.stringify(["Anna", "Bruno"])]);
    const bookingRows = await t.rows<{ recipient_operator_id: string; body: string; href: string }>(
      "select recipient_operator_id,body,href from gw_admin_notifications where kind='ale_booking'");
    expect(bookingRows).toHaveLength(2);
    expect(new Set(bookingRows.map(r => r.recipient_operator_id))).toEqual(new Set([adminA, adminB]));
    expect(bookingRows.every(r => r.href.includes(booking))).toBe(true);
    expect(bookingRows.every(r => r.body.includes("KL Level 1"))).toBe(true);

    await t.db.query("update gw_bookings set notes='Nota modificata' where id=$1", [booking]);
    expect(await t.value<number>("select count(*)::int v from gw_admin_notifications")).toBe(2);
    const contacts = [
      { source_key: "a".repeat(64), display_name: "Gina Verdi", email: "gina@example.test", fields: {} },
      { source_key: "b".repeat(64), display_name: "Pietro Riva", email: "pietro@example.test", fields: {} },
    ];
    await t.db.query("select gw_import_ale_contacts($1,$2::jsonb)", [ale, JSON.stringify(contacts)]);
    expect(await t.value<number>("select count(*)::int v from gw_admin_notifications")).toBe(6);
    await t.db.query("select gw_import_ale_contacts($1,$2::jsonb)", [ale, JSON.stringify(contacts)]);
    const contact = await t.value<string>(
      "select id v from gw_ale_contacts where source_key=$1", ["a".repeat(64)]);
    await t.db.query("select gw_update_ale_contact($1,$2,'Gina V.','gina@example.test','{}'::jsonb)",
      [ale, contact]);
    expect(await t.value<number>("select count(*)::int v from gw_admin_notifications")).toBe(6);
    expect(await t.value<number>("select count(*)::int v from gw_admin_notifications where kind='ale_contact' and href like '/gestione/altro/soci/abbinamenti-ale?contatto=%'")).toBe(4);

    const notificationId = await t.value<string>(
      "select id v from gw_admin_notifications where recipient_operator_id=$1 limit 1", [adminA]);
    await t.db.query("update gw_admin_notifications set read_at=now() where id=$1", [notificationId]);
    expect(await t.value<number>("select count(*)::int v from gw_admin_notifications where recipient_operator_id=$1 and read_at is not null", [adminA])).toBe(1);
    expect(await t.value<number>("select count(*)::int v from gw_admin_notifications where recipient_operator_id=$1 and read_at is not null", [adminB])).toBe(0);
    expect(await t.value<boolean>("select has_table_privilege('anon','public.gw_admin_notifications','SELECT') v")).toBe(false);
    expect(await t.value<boolean>("select has_table_privilege('authenticated','public.gw_admin_push_subscriptions','SELECT') v")).toBe(false);
  });
});
