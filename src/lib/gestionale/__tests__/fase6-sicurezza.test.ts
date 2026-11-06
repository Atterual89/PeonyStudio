// Fase 6 (audit, punto 9): Excel, stampa e apertura di un evento rifiutano le
// richieste senza una sessione valida, prima di leggere qualsiasi dato.

import { beforeEach, describe, expect, it, vi } from "vitest";

const REDIRECT = "NEXT_REDIRECT";
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
  redirect: (to: string) => {
    throw new Error(`${REDIRECT} ${to}`);
  },
}));

let cookie: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookie ? { value: cookie } : undefined), set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

// Sessione sul database: assente, revocata o scaduta secondo il caso.
let session: Record<string, unknown> | null = null;
const tables: string[] = [];
const rpc = vi.fn(async () => ({ data: null, error: null }));

function query(table: string) {
  tables.push(table);
  const result = () => ({ data: table === "gw_sessions" ? session : [], error: null });
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "not", "order", "range", "limit", "gt", "update"]) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = async () => result();
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result());
  return builder;
}

vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ from: query, rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: query }) }));

const W = "00000000-0000-4000-8000-000000000001";
const params = Promise.resolve({ id: W, eventId: W });

function sessionRow(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: "00000000-0000-4000-8000-0000000000s1",
    operator_id: "00000000-0000-4000-8000-0000000000o1",
    created_at: new Date(now).toISOString(),
    last_seen_at: new Date(now).toISOString(),
    expires_at: new Date(now + 86_400_000).toISOString(),
    revoked_at: null,
    gw_operators: { id: "00000000-0000-4000-8000-0000000000o1", display_name: "Operatrice Prova", active: true, role: "admin" },
    ...overrides,
  };
}

const CASES: [string, () => void][] = [
  ["senza cookie", () => {
    cookie = null;
    session = null;
  }],
  ["cookie senza sessione sul database", () => {
    cookie = "token-sconosciuto";
    session = null;
  }],
  ["sessione revocata", () => {
    cookie = "token-di-prova";
    session = sessionRow({ revoked_at: new Date().toISOString() });
  }],
  ["sessione scaduta", () => {
    cookie = "token-di-prova";
    session = sessionRow({ expires_at: new Date(Date.now() - 1000).toISOString() });
  }],
  ["operatore disattivato", () => {
    cookie = "token-di-prova";
    session = sessionRow({ gw_operators: { id: "o1", display_name: "Operatrice Prova", active: false, role: "admin" } });
  }],
];

beforeEach(() => {
  tables.length = 0;
  rpc.mockClear();
});

describe("export e stampa senza sessione valida → accesso, nessun dato letto", () => {
  for (const [name, setup] of CASES) {
    it(name, async () => {
      setup();
      const excel = await import("@/app/gestione/w/[id]/excel/route");
      const print = await import("@/app/gestione/w/[id]/stampa/page");
      const event = await import("@/app/gestione/e/[eventId]/route");

      await expect(excel.GET(new Request("http://localhost/gestione/w/x/excel"), { params })).rejects.toThrow(`${REDIRECT} /gestione/accesso`);
      await expect(print.default({ params })).rejects.toThrow(`${REDIRECT} /gestione/accesso`);
      await expect(event.GET(new Request("http://localhost/gestione/e/x"), { params })).rejects.toThrow(`${REDIRECT} /gestione/accesso`);

      expect(tables.filter((table) => table !== "gw_sessions")).toEqual([]);
      expect(rpc).not.toHaveBeenCalled();
    });
  }
});
