import {beforeEach,describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {MIGRATIONS,createTestDb,type TestDb} from "./pglite";

let t:TestDb;
let organizer:string;
let booking:string;
let primaryId:string;
let partnerId:string;
const migration=readFileSync(join(process.cwd(),"supabase/migrations/036_gw_update_entered_participant.sql"),"utf8");

beforeEach(async()=>{
  t=await createTestDb(MIGRATIONS);
  await t.db.exec(migration);
  organizer=await t.operator("Ale test");
  await t.db.query("update gw_operators set role='organizzatrice' where id=$1",[organizer]);
  const workshop=await t.value<string>(
    "select gw_ensure_workshop_for_event($1,'eeeeeeee-0000-4000-8000-000000000299','Coppie test','2026-11-19',null) v",[organizer]
  );
  booking=await t.value<string>(
    "select gw_create_booking_entered($1,$2,$3::jsonb,'prenotato',null,null) v",
    [organizer,workshop,JSON.stringify(["Chiara","Pietro"])]
  );
  const participants=await t.rows<{id:string;is_primary:boolean}>(
    "select id,is_primary from gw_booking_participants where booking_id=$1 order by is_primary desc",[booking]
  );
  primaryId=participants[0].id;
  partnerId=participants[1].id;
});

describe("scheda coppia: modifiche separate per partner e intestatario",()=>{
 it("aggiorna soltanto il partner e conserva iscrizione e contabilità",async()=>{
  const initial=await t.value<number>("select version v from gw_bookings where id=$1",[booking]);
  const person=await t.value<string>("select person_id v from gw_booking_participants where id=$1",[partnerId]);
  await t.value("select gw_update_entered_participant($1,$2,'Pietro Nuovo','PIETRO@example.test') v",[organizer,partnerId]);
  const changed=await t.rows<{entered_as:string;entered_email:string}>(
    "select entered_as,entered_email from gw_booking_participants where id=$1",[partnerId]
  );
  expect(changed).toEqual([{entered_as:"Pietro Nuovo",entered_email:"pietro@example.test"}]);
  expect(await t.value("select entered_as v from gw_booking_participants where id=$1",[primaryId])).toBe("Chiara");
  expect(await t.value("select person_id v from gw_booking_participants where id=$1",[partnerId])).toBe(person);
  expect(await t.value("select version v from gw_bookings where id=$1",[booking])).toBe(initial);
  expect(await t.value("select count(*)::int v from gw_audit_log where entity='booking' and entity_id=$1",[booking])).toBeGreaterThan(0);
 });
 it("rifiuta un nome vuoto e non modifica il partner",async()=>{
  const error=await t.error("select gw_update_entered_participant($1,$2,'','pietro@example.test')",[organizer,partnerId]);
  expect(error?.code).toBe("GW400");
  expect(await t.value("select entered_as v from gw_booking_participants where id=$1",[partnerId])).toBe("Pietro");
 });
 it("l'admin non può impersonare Ale con questa funzione",async()=>{
  const admin=await t.operator("Admin test");
  const error=await t.error("select gw_update_entered_participant($1,$2,'Nome cambiato',null)",[admin,partnerId]);
  expect(error?.code).toBe("GW403");
 });
});
