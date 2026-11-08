import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, createTestDb } from "./pglite";

describe("collegamento esplicito di socio con nickname", () => {
 it("collega solo l'identità univoca del libro, senza sovrascrivere i nomi o unire le persone", async()=>{
  const t=await createTestDb(MIGRATIONS,{supabaseDefaults:true});
  await t.db.exec(readFileSync(join(process.cwd(),"supabase/migrations/031_gw_explicit_official_member_link.sql"),"utf8"));
  const op=await t.operator();
  const p=await t.value<string>(`select gw_create_person($1,'{"first_name":"Nick","last_name":"Diverso","nickname":"Gesù Christian"}'::jsonb) v`,[op]);
  const other=await t.value<string>(`select gw_create_person($1,'{"first_name":"Altra","last_name":"Persona"}'::jsonb) v`,[op]);
  await t.db.exec(`
   insert into public.association_members(first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at)
   values('Christian','Martelli',null,'official_members_book','verified','2025-09-01','2026-12-31');
  `);
  const version=await t.value<number>(`select version v from gw_people where id=$1`,[p]);
  expect(await t.value<number>(
   `select gw_link_member_name_explicit($1::uuid,$2::uuid,$3::integer,'christian martelli') v`,
   [op,p,version]
  )).toBe(version+1);
  expect(await t.rows(`select first_name,last_name,nickname,membership_name_key from gw_people where id=$1`,[p]))
   .toEqual([{first_name:"Nick",last_name:"Diverso",nickname:"Gesù Christian",membership_name_key:"christian martelli"}]);
  const otherVersion=await t.value<number>(`select version v from gw_people where id=$1`,[other]);
  expect(await t.error(`select gw_link_member_name_explicit($1::uuid,$2::uuid,$3::integer,'christian martelli')`,[op,other,otherVersion])).not.toBeNull();
  expect(await t.value<boolean>(`select has_function_privilege('anon',
   'public.gw_link_member_name_explicit(uuid,uuid,integer,text)','EXECUTE') v`)).toBe(false);
 });
});
