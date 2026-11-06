// Fase 6 (audit, punti 3 e 4): con tutte le migrazioni applicate, nessuna
// tabella, sequenza o funzione gw_ è raggiungibile da anon o authenticated, e
// association_members non viene riaperta. Solo PGlite, con i privilegi
// predefiniti di Supabase (ogni oggetto nuovo nasce aperto ad anon).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, type TestDb } from "./pglite";

const ROLES = ["anon", "authenticated"];
const TABLE_PRIVILEGES = "select,insert,update,delete,truncate,references,trigger";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb(MIGRATIONS, { supabaseDefaults: true });
});

describe("dopo tutte le migrazioni (010–027)", () => {
  it("ogni tabella gw_: RLS attiva, zero policy, nessun privilegio per anon e authenticated", async () => {
    const tables = await t.rows<{ name: string; rls: boolean }>(
      `select relname as name, relrowsecurity as rls from pg_class
        where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'gw\\_%' order by relname`,
    );
    expect(tables.length).toBeGreaterThanOrEqual(16);
    expect(tables.filter((table) => !table.rls).map((table) => table.name)).toEqual([]);
    expect(await t.value(`select count(*)::int v from pg_policies where tablename like 'gw\\_%'`)).toBe(0);
    for (const { name } of tables) {
      for (const role of ROLES) {
        expect(await t.value(`select has_table_privilege($1, $2, $3) v`, [role, `public.${name}`, TABLE_PRIVILEGES]), `${role} ${name}`).toBe(false);
      }
      expect(await t.value(`select has_table_privilege('service_role', $1, 'select') v`, [`public.${name}`]), name).toBe(true);
    }
  });

  it("ogni sequenza gw_: nessun privilegio per anon e authenticated", async () => {
    const sequences = await t.rows<{ name: string }>(
      `select relname as name from pg_class where relnamespace = 'public'::regnamespace and relkind = 'S' and relname like 'gw\\_%'`,
    );
    for (const { name } of sequences) {
      for (const role of ROLES) {
        expect(await t.value(`select has_sequence_privilege($1, $2, 'usage,select,update') v`, [role, `public.${name}`]), `${role} ${name}`).toBe(false);
      }
    }
  });

  it("ogni funzione gw_*: niente EXECUTE per public, anon e authenticated", async () => {
    const functions = await t.rows<{ fn: string; public_execute: boolean }>(
      `select p.oid::regprocedure::text as fn,
              coalesce(p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'), true) as public_execute
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'gw\\_%' order by 1`,
    );
    expect(functions.length).toBeGreaterThan(50);
    expect(functions.filter((f) => f.public_execute).map((f) => f.fn)).toEqual([]);
    for (const { fn } of functions) {
      for (const role of ROLES) {
        expect(await t.value(`select has_function_privilege($1, $2, 'execute') v`, [role, fn]), `${role} ${fn}`).toBe(false);
      }
    }
  });
});

describe("association_members (chiusa a mano sul database reale)", () => {
  const sources = readdirSync(join(process.cwd(), "supabase", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({ name, code: readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8").replace(/--.*$/gm, "") }));

  it("nessuna migrazione la riapre: niente grant, policy, disable RLS o modifiche di struttura", () => {
    const reopen =
      /grant\s[^;]*\bon\s+(table\s+)?(public\.)?association_members\b|create\s+policy\s[^;]*\bon\s+(public\.)?association_members\b|alter\s+table\s+(public\.)?association_members\s+(disable|no\s+force)\s+row\s+level\s+security/i;
    expect(sources.filter(({ code }) => reopen.test(code)).map(({ name }) => name)).toEqual([]);
    const gestionale = sources.filter(({ name }) => /^0[12]\d_gw_/.test(name));
    expect(gestionale.filter(({ code }) => /alter\s+table\s+(public\.)?association_members\b/i.test(code)).map(({ name }) => name)).toEqual([]);
  });

  it("le funzioni del gestionale non ricevono privilegi su association_members per anon e authenticated", async () => {
    for (const role of ROLES) {
      expect(await t.value(`select has_table_privilege($1, 'public.association_members', 'select,insert,update,delete') v`, [role])).toBe(false);
    }
  });
});
