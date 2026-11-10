import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {MIGRATIONS,createTestDb} from "./pglite";

describe("anagrafica centrale alimentata dai moduli Google",()=>{
  it("crea una sola persona per modulo valido, importa lo storico e non valida quote",async()=>{
    const t=await createTestDb(MIGRATIONS,{supabaseDefaults:true});
    await t.db.exec(`
      insert into public.association_members (source,source_row_id,first_name,last_name,email)
      values ('google_sheet','13','Cristian','Pintea','cristian@example.test'),
             ('google_sheet','13','Cristian','Pintea','cristian@example.test'),
             ('google_sheet','eng:8','Camí Raquel',null,'raquel@example.test');
    `);
    await t.db.exec(readFileSync(join(process.cwd(),
      "supabase/migrations/045_gw_auto_person_from_google_forms.sql"),"utf8"));
    expect(await t.value<number>(`select count(*)::int v from gw_people where email='cristian@example.test'`)).toBe(1);
    expect(await t.value<number>(`select count(*)::int v from gw_people where email='raquel@example.test'`)).toBe(1);
    expect(await t.value<number>(`select count(*)::int v from association_members where source='manual_override'`)).toBe(0);
    const manualOperator=await t.operator("Admin test");
    // L'evento e la quota non sono prerequisiti della creazione della persona.
    await t.db.exec(`insert into public.association_members
      (source,source_row_id,first_name,last_name,email)
      values ('google_sheet','99','Maria','Verdi','maria@example.test');`);
    expect(await t.value<number>(`select count(*)::int v from gw_people where email='maria@example.test'`)).toBe(1);
    expect(await t.value<number>(`select count(*)::int v from gw_audit_log where entity='person' and action='insert' and operator_id is null`)).toBe(3);
    expect(await t.value<boolean>(`select has_function_privilege('anon',
      'public.gw_ensure_person_from_google_form(uuid)','EXECUTE') v`)).toBe(false);
  });
  it("non crea un duplicato con email condivisa o persona già presente",async()=>{
    const t=await createTestDb(MIGRATIONS,{supabaseDefaults:true});
    await t.db.exec(readFileSync(join(process.cwd(),
      "supabase/migrations/045_gw_auto_person_from_google_forms.sql"),"utf8"));
    await t.db.exec(`
      insert into public.association_members (source,source_row_id,first_name,last_name,email)
      values ('google_sheet','x1','Barbara','Hochstrasser','shared@example.test');`);
    expect(await t.value<number>(`select count(*)::int v from gw_people where email='shared@example.test'`)).toBe(1);
    await t.db.exec(`
      insert into public.association_members (source,source_row_id,first_name,last_name,email)
      values ('google_sheet','x2','Eva','Muller','shared@example.test');`);
    expect(await t.value<number>(`select count(*)::int v from gw_people where email='shared@example.test'`)).toBe(1);
    await t.db.exec(`insert into public.association_members
      (source,source_row_id,first_name,last_name,email)
      values('google_sheet','x3','Barbara','Hochstrasser','shared@example.test')`);
    expect(await t.value<number>(`select count(*)::int v from gw_people where email='shared@example.test'`)).toBe(1);
  });
});
