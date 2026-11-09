import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, createTestDb } from "./pglite";

describe("anagrafica fiscale importata",()=>{
  it("condivide i nominativi, lascia gli omonimi in revisione, protegge i dati",async()=>{
    const t=await createTestDb(MIGRATIONS,{supabaseDefaults:true});
    await t.db.exec(readFileSync(join(process.cwd(),"supabase/migrations/038_gw_billing_directory.sql"),"utf8"));
    const op=await t.operator("Alessandra Test");
    const rows=[
      {first_name:"Maria",last_name:"Rossi",email:"maria@example.test",fields:{"Codice fiscale":"RSS","__billing_email":"maria@example.test"}},
      {first_name:"Giulia",last_name:"Verdi",email:"",fields:{"Indirizzo":"Via Roma"}},
    ];
    const result=await t.value<{created:number;matched:number;review:number;skipped:number}>(
      "select gw_import_billing_rows($1::uuid,$2::jsonb) v",[op,JSON.stringify(rows)]
    );
    expect(result).toMatchObject({created:2,matched:0,review:0,skipped:0});
    expect(await t.value<number>("select count(*)::integer v from gw_billing_profiles")).toBe(2);
    expect(await t.value<string>("select (fields->>'Codice fiscale') v from gw_billing_profiles where fields ? 'Codice fiscale'")).toBe("RSS");
    const again=await t.value<{created:number;matched:number}>(
      "select gw_import_billing_rows($1::uuid,$2::jsonb) v",[op,JSON.stringify(rows)]
    );
    expect(again).toMatchObject({created:0,matched:2});
    const duplicates=[
      {first_name:"Luca",last_name:"Neri",email:"",fields:{"Indirizzo":"Via Uno"}},
      {first_name:"Luca",last_name:"Neri",email:"",fields:{"Indirizzo":"Via Due"}},
    ];
    const duplicateResult=await t.value<{review:number}>(
      "select gw_import_billing_rows($1::uuid,$2::jsonb) v",[op,JSON.stringify(duplicates)]
    );
    expect(duplicateResult.review).toBe(2);
    expect(await t.value<number>("select count(*)::integer v from gw_people where first_name='Luca'")).toBe(0);
    expect(await t.value<boolean>("select has_table_privilege('anon','public.gw_billing_profiles','SELECT') v")).toBe(false);
    expect(await t.value<boolean>(
      "select has_function_privilege('anon','public.gw_import_billing_rows(uuid,jsonb)','EXECUTE') v")).toBe(false);
  });
});
