import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, createTestDb } from "./pglite";

describe("collegamento esplicito di socio con nickname", () => {
 it("collega solo l'identità univoca del libro, senza sovrascrivere i nomi o unire le persone", async()=>{
  const t=await createTestDb(MIGRATIONS,{supabaseDefaults:true});
  // Il runner SQL carica fino alla 027; la colonna nominale è stata aggiunta
  // successivamente nel database reale e va riprodotta nel test isolato.
  await t.db.exec("alter table public.gw_people add column if not exists membership_name_key text;");
  await t.db.exec(readFileSync(join(process.cwd(),"supabase/migrations/031_gw_explicit_official_member_link.sql"),"utf8"));
  await t.db.exec(readFileSync(join(process.cwd(),"supabase/migrations/032_gw_keep_explicit_nominal_links.sql"),"utf8"));
  // Installa il trigger reale: in precedenza azzerava senza errore i link
  // confermati a schede con nickname e senza nome/cognome ufficiale.
  await t.db.exec(`
    create trigger gw_clear_stale_member_name_link_trigger
      before insert or update on public.gw_people
      for each row execute function public.gw_clear_stale_member_name_link();
  `);
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
  expect(await t.rows(`select first_name,last_name,nickname,membership_name_key,membership_name_explicit from gw_people where id=$1`,[p]))
   .toEqual([{first_name:"Nick",last_name:"Diverso",nickname:"Gesù Christian",membership_name_key:"christian martelli",membership_name_explicit:true}]);
  const otherVersion=await t.value<number>(`select version v from gw_people where id=$1`,[other]);
  expect(await t.error(`select gw_link_member_name_explicit($1::uuid,$2::uuid,$3::integer,'christian martelli')`,[op,other,otherVersion])).not.toBeNull();

  // Il collegamento rimane valido per la persona con nickname, ma modificare
  // il nome anagrafico lo invalida: non si trascinano identità sbagliate.
  await t.db.exec(`update public.gw_people set first_name='Persona corretta' where id='${p}'`);
  expect(await t.rows(`select membership_name_key,membership_name_explicit from gw_people where id=$1`,[p]))
    .toEqual([{membership_name_key:null,membership_name_explicit:false}]);
  // Anche un socio ufficiale con pagamento non verificato deve essere
  // collegabile come identità, SENZA diventare "quota pagata".
  await t.db.exec(`
    insert into public.association_members(first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at)
    values('Barbara','Hochstrasser',null,'official_members_book','pending','2026-01-01','2026-12-31');
  `);
  expect(await t.value<number>(
    `select gw_link_member_name_explicit($1::uuid,$2::uuid,$3::integer,'barbara hochstrasser') v`,
    [op,other,otherVersion]
  )).toBe(otherVersion+1);
  expect(await t.value<string>(
    `select membership_status v from association_members where first_name='Barbara'`)).toBe("pending");
  expect(await t.rows(`select membership_name_key,membership_name_explicit from gw_people where id=$1`,[other]))
    .toEqual([{membership_name_key:"barbara hochstrasser",membership_name_explicit:true}]);
  expect(await t.value<boolean>(`select has_function_privilege('anon',
   'public.gw_link_member_name_explicit(uuid,uuid,integer,text)','EXECUTE') v`)).toBe(false);
 });
});
