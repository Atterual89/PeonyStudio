import {beforeEach,describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {MIGRATIONS,createTestDb,type TestDb} from "./pglite";

const migration=readFileSync(join(process.cwd(),"supabase/migrations/040_gw_organizer_workshop_person_match.sql"),"utf8");
let t:TestDb,ale:string,admin:string,workshop:string,booking:string,participant:string,maryna:string;
beforeEach(async()=>{
  t=await createTestDb(MIGRATIONS,{supabaseDefaults:true});
  // Colonna introdotta dalle migrazioni anagrafiche successive alla 027,
  // presenti già nello schema di produzione.
  await t.db.exec("alter table public.gw_people add column if not exists membership_name_key text;");
  await t.db.exec(migration);
  ale=await t.operator("Alessandra");
  admin=await t.operator("Admin");
  workshop=await t.value<string>(
    "select gw_ensure_workshop_for_event($1,'eeeeeeee-0000-4000-8000-000000000397','KL Level 1','2027-02-19',null) v",[ale]);
  await t.value(
    "select gw_update_workshop_settings($1,$2,(select version from gw_workshops where id=$2),'{\"default_fee_cents\":53000}'::jsonb) v",
    [ale,workshop]);
  booking=await t.value<string>(
    "select gw_create_booking_entered($1,$2,$3::jsonb,'prenotato',null,null) v",
    [ale,workshop,JSON.stringify(["Pavel/Maru"])]);
  participant=await t.value<string>("select id v from gw_booking_participants where booking_id=$1",[booking]);
  maryna=await t.value<string>(
    "insert into gw_people(first_name,last_name,nickname,created_by) values('Maryna','Zolotarenko','Maru',$1) returning id v",
    [admin]);
  await t.db.query("update gw_operators set role='organizzatrice' where id=$1",[ale]);
  await t.db.query("update gw_operators set role='admin' where id=$1",[admin]);
});
describe("Ale: selezione manuale della persona del workshop",()=>{
 it("divide Pavel/Maru e collega solo Maru a Maryna: booking, quota e acconti invariati",async()=>{
   const original=await t.rows<{person_id:string;entered_as:string;match_status:string;auto_created_person:boolean}>(
      "select person_id,entered_as,match_status::text,auto_created_person from gw_booking_participants where id=$1",[participant]);
   expect(original[0].match_status).toBe("da_abbinare");
   const fee=await t.value<number>("select agreed_fee_cents::int v from gw_bookings where id=$1",[booking]);
   const newParticipant=await t.value<string>(
     "select gw_organizer_split_compound_person($1,$2,'Pavel','Maru',$3,false) v",
     [ale,participant,maryna]);
   const persons=await t.rows<{entered_as:string;person_id:string;is_primary:boolean;match_status:string}>(
      "select entered_as,person_id,is_primary,match_status::text from gw_booking_participants where booking_id=$1 order by is_primary desc",[booking]);
   expect(persons).toHaveLength(2);
   expect(persons[0]).toMatchObject({entered_as:"Pavel",person_id:original[0].person_id,is_primary:true,match_status:"da_abbinare"});
   expect(persons[1]).toMatchObject({entered_as:"Maru",person_id:maryna,is_primary:false,match_status:"confermato"});
   expect(newParticipant).toBeTruthy();
   expect(await t.value<number>("select agreed_fee_cents::int v from gw_bookings where id=$1",[booking])).toBe(fee);
   expect(await t.value<number>("select count(*)::int v from gw_people")).toBe(2);
   expect(await t.value<number>("select count(*)::int v from gw_audit_log where entity='booking' and entity_id=$1",[booking])).toBeGreaterThan(0);
   const twice=await t.error(
     "select gw_organizer_split_compound_person($1,$2,'Pavel','Maru',$3,false)",
     [ale,participant,maryna]);
   expect(twice?.code).toBe("GW409");
 });
 it("un nickname singolo si collega manualmente conservando il testo e la scheda",async()=>{
   const single=await t.value<string>(
     "select gw_create_booking_entered($1,$2,$3::jsonb,'prenotato',null,null) v",
     [ale,workshop,JSON.stringify(["Alias manuale"])]);
   const singlePart=await t.value<string>("select id v from gw_booking_participants where booking_id=$1",[single]);
   const before=await t.value<string>("select entered_as v from gw_booking_participants where id=$1",[singlePart]);
   await t.value("select gw_organizer_link_workshop_person($1,$2,$3) v",[ale,singlePart,maryna]);
   expect(await t.value<string>("select person_id v from gw_booking_participants where id=$1",[singlePart])).toBe(maryna);
   expect(await t.value<string>("select entered_as v from gw_booking_participants where id=$1",[singlePart])).toBe(before);
   expect(await t.value<string>("select match_status::text v from gw_booking_participants where id=$1",[singlePart])).toBe("confermato");
   expect(await t.value<string>("select nickname v from gw_people where id=$1",[maryna])).toBe("Maru");
 });
 it("non collega Aizen e Franco o Pavel/Maru come una persona singola",async()=>{
   expect((await t.error("select gw_organizer_link_workshop_person($1,$2,$3)",[ale,participant,maryna]))?.code).toBe("GW409");
 });
 it("solo Ale può collegare o dividere: admin e client anon vietati",async()=>{
   expect((await t.error("select gw_organizer_link_workshop_person($1,$2,$3)",[admin,participant,maryna]))?.code).toBe("GW403");
   expect((await t.error("select gw_organizer_split_compound_person($1,$2,'Pavel','Maru',$3,false)",[admin,participant,maryna]))?.code).toBe("GW403");
   expect(await t.value<boolean>("select has_function_privilege('anon','public.gw_organizer_link_workshop_person(uuid,uuid,uuid)','EXECUTE') v")).toBe(false);
   expect(await t.value<boolean>("select has_function_privilege('authenticated','public.gw_organizer_split_compound_person(uuid,uuid,text,text,uuid,boolean)','EXECUTE') v")).toBe(false);
 });
 it("rifiuta persona già iscritta e creazione provvisoria senza consenso esplicito",async()=>{
   await t.value<string>(
    "select gw_create_booking_entered($1,$2,$3::jsonb,'prenotato',null,null) v",
    [ale,workshop,JSON.stringify(["Altro partecipante"])]);
   const other=await t.value<string>("select person_id v from gw_booking_participants where workshop_id=$1 and booking_id<>$2",[workshop,booking]);
   expect((await t.error("select gw_organizer_link_workshop_person($1,$2,$3)",[ale,participant,other]))?.code).toBe("GW409");
   expect((await t.error("select gw_organizer_split_compound_person($1,$2,'Pavel','Maru',null,false)",[ale,participant]))?.code).toBe("GW400");
   await t.value("select gw_organizer_split_compound_person($1,$2,'Pavel','Maru',null,true) v",[ale,participant]);
   expect(await t.value<number>("select count(*)::int v from gw_booking_participants where booking_id=$1",[booking])).toBe(2);
 });
});
