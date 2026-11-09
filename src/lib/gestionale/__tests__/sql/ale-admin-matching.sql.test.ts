import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {MIGRATIONS,createTestDb} from "./pglite";

const migration=(number:string)=>readFileSync(join(process.cwd(),
  "supabase/migrations",number),"utf8");

describe("staging Alessandra e matching riservato all'admin",()=>{
  it("importa senza creare/anagrafiche collegare persone e conferma solo su scelta admin",async()=>{
    const t=await createTestDb(MIGRATIONS,{supabaseDefaults:true});
    await t.db.exec(migration("038_gw_billing_directory.sql"));
    await t.db.exec(migration("039_gw_ale_contacts_admin_matching.sql"));
    const ale=await t.operator("Alessandra");
    const admin=await t.operator("Admin");
    await t.db.query("update gw_operators set role='organizzatrice' where id=$1",[ale]);
    await t.db.query("update gw_operators set role='admin' where id=$1",[admin]);
    const contacts=[
      {source_key:"a".repeat(64),display_name:"Anna D'Alessandro",
        email:"anna@example.test",fields:{"Denominazione":"Anna D'Alessandro","Codice Fiscale":"AAA","__billing_email":"anna@example.test"}},
      {source_key:"b".repeat(64),display_name:"Maria Rossi",
        email:"maria@example.test",fields:{"Denominazione":"Maria Rossi","Indirizzo":"Via Roma"}},
    ];
    const initial=await t.value<{created:number;updated:number;skipped:number}>(
      "select gw_import_ale_contacts($1::uuid,$2::jsonb) v",[ale,JSON.stringify(contacts)]);
    expect(initial).toMatchObject({created:2,updated:0,skipped:0});
    expect(await t.value<number>("select count(*)::int v from gw_ale_contacts")).toBe(2);
    expect(await t.value<number>("select count(*)::int v from gw_people")).toBe(0);
    expect(await t.value<number>("select count(*)::int v from gw_billing_profiles")).toBe(0);
    const repeated=await t.value<{created:number;updated:number}>(
      "select gw_import_ale_contacts($1::uuid,$2::jsonb) v",[ale,JSON.stringify(contacts)]);
    expect(repeated).toMatchObject({created:0,updated:2});
    const badImport=await t.error("select gw_import_ale_contacts($1::uuid,$2::jsonb)",[admin,JSON.stringify(contacts)]);
    expect(badImport?.code).toBe("GW403");
    const person=await t.value<string>(
      "insert into gw_people(first_name,last_name,created_by) values('Anna','D''Alessandro',$1::uuid) returning id v",
      [admin]);
    const staged=await t.value<string>(
      "select id v from gw_ale_contacts where source_key=$1",["a".repeat(64)]);
    const noAle=await t.error("select gw_admin_match_ale_contact($1::uuid,$2::uuid,$3::uuid)",[ale,staged,person]);
    expect(noAle?.code).toBe("GW403");
    const matched=await t.value<string>("select gw_admin_match_ale_contact($1::uuid,$2::uuid,$3::uuid) v",
      [admin,staged,person]);
    expect(matched).toBe(person);
    expect(await t.value<number>("select count(*)::int v from gw_billing_profiles")).toBe(1);
    expect(await t.value<string>("select fields->>'Codice Fiscale' v from gw_billing_profiles")).toBe("AAA");
    expect(await t.value<number>("select count(*)::int v from gw_ale_contact_match_audit")).toBe(1);
    const again=await t.error("select gw_admin_match_ale_contact($1::uuid,$2::uuid,$3::uuid)",
      [admin,staged,person]);
    expect(again?.code).toBe("GW409");
    await t.db.query("select gw_update_ale_contact($1::uuid,$2::uuid,$3,$4,$5::jsonb)",
      [ale,staged,"Anna D'Alessandro","alessandra@example.test",JSON.stringify({"Codice Fiscale":"BBB"})]);
    expect(await t.value<string>("select fields->>'Codice Fiscale' v from gw_billing_profiles")).toBe("BBB");
    expect(await t.value<string|null>("select email v from gw_people where id=$1",[person])).toBeNull();
    expect(await t.value<boolean>("select has_table_privilege('anon','public.gw_ale_contacts','SELECT') v")).toBe(false);
    expect(await t.value<boolean>(
      "select has_function_privilege('authenticated','public.gw_admin_match_ale_contact(uuid,uuid,uuid)','EXECUTE') v")).toBe(false);
  });
});
