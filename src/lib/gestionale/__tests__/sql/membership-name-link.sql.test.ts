import {beforeAll,describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createTestDb,type TestDb} from "./pglite";

const MIGRATIONS=[
  "010_gw_schema_v1","011_gw_functions_v2","012_gw_correzioni_v2b",
  "013_gw_ruoli_pagamenti_v3","014_gw_correzioni_admin_v3b",
  "015_gw_quota_workshop_v3c","016_gw_soci_fonti_admin",
  "017_gw_riga_persona",
  "018_gw_consuntivo_v4",
  "019_gw_pagamenti_stato",
  "020_gw_eliminazioni",
] as const;
let db:TestDb,operator:string;
async function person(first:string,last:string){
  return db.value<string>(`select gw_create_person($1,$2::jsonb) v`,[operator,JSON.stringify({first_name:first,last_name:last})]);
}
async function member(first:string,last:string,email:string|null=null){
  return db.value<string>(`insert into association_members
    (first_name,last_name,email,source,membership_starts_at,membership_expires_at)
    values ($1,$2,$3,'official_members_book','2025-10-01','2026-12-31') returning id v`,
    [first,last,email]);
}
async function link(id:string,key:string|null){
  return db.value<number>(
    `select gw_set_member_name_link($1,$2,(select version from gw_people where id=$2),$3) v`,
    [operator,id,key]);
}
async function state(id:string){
  const [row]=await db.rows<{membership_name_key:string|null;membership_email:string|null;association_member_id:string|null}>(
    "select membership_name_key,membership_email,association_member_id from gw_people where id=$1",[id]);
  return row;
}
beforeAll(async()=>{
  db=await createTestDb(MIGRATIONS);
  await db.db.exec(readFileSync(join(process.cwd(),"supabase/migrations/033_gw_name_only_membership_link.sql"),"utf8"));
  operator=await db.operator("Admin test");
});
describe("collegamento permanente libro soci senza email",()=>{
  it("collega con audit, poi scollega senza modificare la quota",async()=>{
    await member("Viola","Senzaemail");
    const id=await person("Viola","Senzaemail");
    await link(id,"senzaemail viola");
    expect(await state(id)).toEqual({
      membership_name_key:"senzaemail viola",membership_email:null,association_member_id:null,
    });
    expect(await db.value<number>(
      `select count(*)::int v from gw_audit_log where entity_id=$1 and after->>'membership_name_key'=$2`,
      [id,"senzaemail viola"])).toBe(1);
    await link(id,null);
    expect((await state(id)).membership_name_key).toBeNull();
  });
  it("non collega due anagrafiche omonime per errore",async()=>{
    await member("Sofia","Duplicata");
    const a=await person("Sofia","Duplicata");
    const b=await person("Sofia","Duplicata");
    expect((await db.error(`select gw_set_member_name_link($1,$2,(select version from gw_people where id=$2),$3)`,
      [operator,a,"duplicata sofia"]))?.code).toBe("GW400");
    expect((await state(b)).membership_name_key).toBeNull();
  });
  it("rifiuta la selezione di un nome che non corrisponde e del socio ambiguo",async()=>{
    await member("Elisa","Ambigua");
    await member("Elisa","Ambigua");
    const id=await person("Elisa","Ambigua");
    expect((await db.error(`select gw_set_member_name_link($1,$2,(select version from gw_people where id=$2),$3)`,
      [operator,id,"ambigua elisa"]))?.code).toBe("GW400");
    expect((await db.error(`select gw_set_member_name_link($1,$2,(select version from gw_people where id=$2),$3)`,
      [operator,id,"nome sbagliato"]))?.code).toBe("GW400");
  });
  it("cancella il link nominale se viene cambiato il nome o scelto un link email",async()=>{
    await member("Marta","Cambio");
    const id=await person("Marta","Cambio");
    await link(id,"cambio marta");
    await db.value(`update gw_people set last_name='Diversa' where id=$1 returning version v`,[id]);
    expect((await state(id)).membership_name_key).toBeNull();
    await db.value(`update gw_people set last_name='Cambio' where id=$1 returning version v`,[id]);
    await link(id,"cambio marta");
    await db.value(`select gw_set_membership_link($1,$2,(select version from gw_people where id=$2),null,'marta@example.test',null,null) v`,
      [operator,id]);
    expect(await state(id)).toMatchObject({membership_name_key:null,membership_email:"marta@example.test"});
  });
});
