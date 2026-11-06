// Database Postgres in memoria (PGlite) con le migrazioni del gestionale,
// per i test SQL (npm.cmd run test:gestionale:sql).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export const MIGRATIONS = [
  "010_gw_schema_v1",
  "011_gw_functions_v2",
  "012_gw_correzioni_v2b",
  "013_gw_ruoli_pagamenti_v3",
  "014_gw_correzioni_admin_v3b",
  "015_gw_quota_workshop_v3c",
  "016_gw_soci_fonti_admin",
  "017_gw_riga_persona",
  "018_gw_consuntivo_v4",
  "019_gw_pagamenti_stato",
  "020_gw_eliminazioni",
  "021_gw_recap_economico",
  "022_gw_quota_ok",
  "023_gw_richieste_associazione",
  "024_gw_correzioni_revisione",
  "025_gw_anteprima_moduli",
  "026_gw_data_pagamento_facoltativa",
  "027_gw_functions_v5",
] as const;
export type Migration = (typeof MIGRATIONS)[number];

export function readMigration(name: Migration, direction: "up" | "down" = "up"): string {
  return readFileSync(join(MIGRATIONS_DIR, `${name}${direction === "down" ? ".down" : ""}.sql`), "utf8");
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Postgres con i ruoli di Supabase e le migrazioni indicate già applicate. */
export async function createTestDb(migrations: readonly Migration[], options: { supabaseDefaults?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    -- Tabella del sito, per verificare che i rollback non la tocchino.
    create table public.events (id uuid primary key, title text);
    insert into public.events values ('11111111-1111-4111-8111-111111111111', 'Evento del sito');
    -- Libro soci del sito (004 + 005), letto in sola lettura dall'abbinamento (D20).
    create table public.association_members (
      id uuid primary key default gen_random_uuid(),
      first_name text,
      last_name text,
      email text,
      source text default 'google_sheet',
      membership_starts_at date,
      membership_expires_at date,
      fiscal_code text,
      birth_date date,
      membership_card_number text,
      -- Come 004: stato, origine e note (validazioni manuali, migrazione 022).
      membership_status text default 'verified',
      source_row_id text,
      source_hash text,
      notes_admin text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  `);
  if (options.supabaseDefaults) {
    // Come Supabase: tabelle, sequenze e funzioni nuove dello schema public
    // nascono con tutti i privilegi per anon, authenticated e service_role.
    await db.exec(`
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    `);
  }
  for (const name of migrations) {
    await db.exec(readMigration(name));
  }

  async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await db.query<T>(sql, params)).rows;
  }

  /** Primo valore della colonna `v` della prima riga. */
  async function value<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
    const result = await rows<{ v: T }>(sql, params);
    return result[0]?.v as T;
  }

  /** Esegue e restituisce l'errore Postgres (codice, messaggio, dettaglio), o null. */
  async function error(sql: string, params: unknown[] = []) {
    try {
      if (params.length === 0) await db.exec(sql);
      else await db.query(sql, params);
      return null;
    } catch (e) {
      const err = e as { code?: string; message?: string; detail?: string };
      return { code: err.code, message: err.message, detail: err.detail };
    }
  }

  async function operator(name = "Operatrice Test"): Promise<string> {
    return value(`select out_operator_id v from gw_set_operator_pin(null, $1, 'scrypt$32768$8$1$x$y')`, [name]);
  }

  return { db, rows, value, error, operator };
}
