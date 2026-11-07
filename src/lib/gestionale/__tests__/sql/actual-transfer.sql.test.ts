import {readFileSync} from "node:fs";
import {join} from "node:path";
import {beforeAll,describe,expect,it} from "vitest";
import {createTestDb,MIGRATIONS,type TestDb} from "./pglite";

let t:TestDb,operator:string,workshop:string;
const version=(id:string)=>t.value<number>("select version v from gw_transfers where id=$1",[id]);
const payload=(value:unknown)=>JSON.stringify(value);
const change=(id:string,v:number,values:Record<string,unknown>)=>
  t.value<number>("select gw_update_transfer($1,$2,$3,$4::jsonb) v",
    [operator,id,v,payload(values)]);
const create=(values:Record<string,unknown>)=>
  t.value<string>("select gw_create_transfer($1,$2,$3::jsonb) v",
    [operator,workshop,payload(values)]);

beforeAll(async()=>{
  t=await createTestDb(MIGRATIONS);
  await t.db.exec(readFileSync(join(process.cwd(),
    "supabase/migrations/034_gw_update_transfer_actual.sql"),"utf8"));
  operator=await t.operator("Test Conti");
  workshop=await t.value<string>(
    "select gw_ensure_workshop_for_event($1,$2,'Saldo test','2026-11-10',null) v",
    [operator,"eedddddd-0000-4000-8000-000000000001"]);
});
describe("importo effettivamente versato",()=>{
  it("corregge un importo eseguito con data e storico",async()=>{
    const id=await create({from_party:"redsabbath",to_party:"peony",
      amount_cents:30000,status:"eseguito",executed_on:"2026-11-10"});
    expect(await change(id,1,{from_party:"redsabbath",to_party:"peony",
      amount_cents:35000,status:"eseguito",executed_on:"2026-11-10",notes:"eccesso"})).toBe(2);
    const r=await t.rows<{amount_cents:string;notes:string;version:number}>(
      "select amount_cents::text,notes,version from gw_transfers where id=$1",[id]);
    expect(r).toEqual([{amount_cents:"35000",notes:"eccesso",version:2}]);
    const audit=await t.rows<{before:Record<string,unknown>;after:Record<string,unknown>}>(
      "select before,after from gw_audit_log where entity='transfer' and entity_id=$1 and action='update'",[id]);
    expect(audit).toHaveLength(1);
    expect(audit[0].before).toMatchObject({amount_cents:30000});
    expect(audit[0].after).toMatchObject({amount_cents:35000});
    expect((await t.error(
      "select gw_update_transfer($1,$2,1,$3::jsonb)",[operator,id,payload({
        from_party:"redsabbath",to_party:"peony",amount_cents:10000,
        status:"eseguito",executed_on:"2026-11-10"})]))?.code).toBe("GW409");
  });
  it("da eseguire non ha data e può diventare eseguito",async()=>{
    const id=await create({from_party:"peony",to_party:"redsabbath",
      amount_cents:7000,status:"da_eseguire"});
    await change(id,1,{from_party:"peony",to_party:"redsabbath",
      amount_cents:8000,status:"da_eseguire",executed_on:null});
    const pending=await t.rows<{status:string;date:string|null}>(
      "select status::text status,executed_on::text date from gw_transfers where id=$1",[id]);
    expect(pending).toEqual([{status:"da_eseguire",date:null}]);
    await change(id,2,{from_party:"peony",to_party:"redsabbath",
      amount_cents:9000,status:"eseguito",executed_on:"2026-11-11"});
    expect(await t.value<number>("select amount_cents::int v from gw_transfers where id=$1",[id])).toBe(9000);
  });
  it("rifiuta trasferimenti incoerenti o senza data e non modifica l'importo",async()=>{
    const id=await create({from_party:"redsabbath",to_party:"peony",amount_cents:5000,status:"da_eseguire"});
    for(const bad of [
      {from_party:"peony",to_party:"peony",amount_cents:5000,status:"eseguito",executed_on:"2026-11-11"},
      {from_party:"peony",to_party:"redsabbath",amount_cents:-1,status:"eseguito",executed_on:"2026-11-11"},
      {from_party:"peony",to_party:"redsabbath",amount_cents:200,status:"eseguito",executed_on:null},
    ]){
      expect((await t.error("select gw_update_transfer($1,$2,$3,$4::jsonb)",
        [operator,id,await version(id),payload(bad)]))?.code).toBe("GW400");
    }
    expect(await t.value<number>("select amount_cents::int v from gw_transfers where id=$1",[id])).toBe(5000);
  });
  it("nessuna esecuzione diretta per utenti non privilegiati",async()=>{
    const can=await t.value<boolean>(
      "select has_function_privilege('authenticated','public.gw_update_transfer(uuid,uuid,integer,jsonb)','EXECUTE') v");
    expect(can).toBe(false);
  });
});
