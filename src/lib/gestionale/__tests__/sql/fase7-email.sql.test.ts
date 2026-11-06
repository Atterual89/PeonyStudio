// D30: migration 028 in-memory only (never the real database).
import { beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let admin: string;
let organizer: string;
let workshop: string;
let person: string;

beforeAll(async () => {
  t = await createTestDb(MIGRATIONS);
  admin = await t.operator("Email Admin");
  organizer = await t.operator("Email Organizer");
  await t.db.query("update gw_operators set role='admin' where id=$1", [admin]);
  workshop = await t.value<string>("select gw_ensure_workshop_for_event($1,'eeeeeeee-0000-4000-8000-000000000801','Kinbaku LuXuria Test','2026-11-14',null) v", [admin]);
  const booking = await t.value<string>("select gw_create_registration($1,$2,$3::jsonb,'prenotato',null,null,null) v", [organizer,workshop,JSON.stringify(["Persona Email"])]);
  person = await t.value<string>("select person_id v from gw_booking_participants where booking_id=$1", [booking]);
  await t.db.exec(readMigration("028_gw_email"));
});

describe("028 — email persistence and security", () => {
  it("workshop fields are versioned and audited", async () => {
    expect(await t.value<number>("select gw_save_email_texts($1,$2,0,$3::jsonb) v",[admin,workshop,'{"title":"Level 2+"}'])).toBe(1);
    expect((await t.error("select gw_save_email_texts('"+admin+"','"+workshop+"',0,'{}'::jsonb)"))?.code).toBe("GW409");
    expect((await t.error("select gw_save_email_texts('"+organizer+"','"+workshop+"',1,'{}'::jsonb)"))?.code).toBe("GW404");
    expect(await t.value<number>("select count(*)::int v from gw_audit_log where entity='email_texts' and entity_id=$1",[workshop])).toBe(1);
  });

  it("global defaults are versioned and admin-only", async () => {
    expect(await t.value<number>("select gw_save_email_defaults($1,0,$2::jsonb) v",[admin,'{"associationName":"UR Expression APS"}'])).toBe(1);
    expect((await t.error("select gw_save_email_defaults('"+organizer+"',1,'{}'::jsonb)"))?.code).toBe("GW404");
  });

  it("partner sending, sequential reminders, deletion and audit", async () => {
    const mark = (kind:string,date:string) => t.value<number>("select gw_mark_email_sends($1,$2,$3::uuid[],$4::gw_email_kind,$5::date) v",[admin,workshop,[person],kind,date]);
    expect(await mark("partner","2026-01-01")).toBe(1);
    expect((await t.error("select gw_mark_email_sends('"+admin+"','"+workshop+"',array['"+person+"']::uuid[],'partner','2026-01-01')"))?.code).toBe("GW409");
    expect(await mark("partner_reminder","2026-01-02")).toBe(1);
    expect(await mark("partner_reminder","2026-01-03")).toBe(1);
    const rows=await t.rows<{id:string;number:number;kind:string}>("select id,number,kind::text from gw_email_sends where person_id=$1 and deleted_at is null order by sent_on",[person]);
    expect(rows.map(x=>[x.kind,x.number])).toEqual([["partner",0],["partner_reminder",1],["partner_reminder",2]]);
    await t.db.query("select gw_delete_email_send($1,$2)",[admin,rows[2].id]);
    expect(await t.value<number>("select count(*)::int v from gw_email_sends where deleted_at is null")).toBe(2);
    expect(await t.value<number>("select count(*)::int v from gw_audit_log where entity='email_send' and entity_id=$1",[rows[2].id])).toBe(2);
  });

  it("workshop details require a paid booking; no access for anonymous roles", async () => {
    expect((await t.error("select gw_mark_email_sends('"+admin+"','"+workshop+"',array['"+person+"']::uuid[],'workshop_details','2026-01-01')"))?.code).toBe("GW400");
    for (const role of ["anon","authenticated"]) {
      expect(await t.value<boolean>("select has_table_privilege($1,'gw_email_sends','insert') v",[role])).toBe(false);
      expect(await t.value<boolean>("select has_function_privilege($1,'gw_mark_email_sends(uuid,uuid,uuid[],gw_email_kind,date)','execute') v",[role])).toBe(false);
    }
  });

  it("rollback and reapply",async()=>{
    await t.db.exec(readMigration("028_gw_email","down"));
    expect(await t.value("select to_regclass('public.gw_email_sends') v")).toBeNull();
    await t.db.exec(readMigration("028_gw_email"));
    expect(await t.value("select to_regclass('public.gw_email_sends') v")).not.toBeNull();
  });
});
