// Validazione manuale "Quota ok" condivisa (src/lib/association/manual-validation.ts):
// la route del sito manual-validate si comporta come prima (stesse
// risposte, stesse scritture); annullare tocca solo le righe manual_override.
// Database simulato, dati inventati.

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { id: string; source: string };

let rows: Row[] = [];
const writes: { op: string; payload?: unknown; filters: [string, unknown][] }[] = [];
let failSelect = false;

function query(table: string) {
  expect(table).toBe("association_members");
  const filters: [string, unknown][] = [];
  let op = "select";
  let payload: unknown;
  const builder: Record<string, unknown> = {};
  const result = () => {
    if (op === "select") {
      if (failSelect) return { data: null, error: { message: "lettura non riuscita" } };
      return { data: rows.filter((row) => filters.every(([col, value]) => row[col] === value)), error: null };
    }
    writes.push({ op, payload, filters: [...filters] });
    if (op === "insert") return { data: { id: "nuova" }, error: null };
    if (op === "update") {
      const ids = filters.find(([col]) => col === "id:in")?.[1] as string[] | undefined;
      for (const row of rows) {
        const match = ids ? ids.includes(row.id) : filters.every(([col, value]) => row[col] === value);
        if (match) Object.assign(row, payload);
      }
      return { data: { id: filters.find(([col]) => col === "id")?.[1] ?? null }, error: null };
    }
    return { data: null, error: null };
  };
  builder.select = () => builder;
  builder.range = () => builder;
  builder.single = () => builder;
  builder.eq = (col: string, value: unknown) => {
    filters.push([col, value]);
    return builder;
  };
  builder.in = (col: string, value: unknown) => {
    filters.push([`${col}:in`, value]);
    return builder;
  };
  builder.insert = (value: unknown) => {
    op = "insert";
    payload = value;
    return builder;
  };
  builder.update = (value: unknown) => {
    op = "update";
    payload = value;
    return builder;
  };
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result());
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: query }) }));

const SECRET = "segreto-di-prova";
const NOW = "2026-10-29T09:00:00.000Z";

function post(body: unknown, secret: string | null = SECRET) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (secret) headers.set("x-admin-sync-secret", secret);
  return new NextRequest("http://localhost/api/admin/association-members/manual-validate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("ADMIN_SYNC_SECRET", SECRET);
  vi.useFakeTimers({ now: new Date(NOW), toFake: ["Date"] });
  rows = [
    { id: "libro-1", source: "official_members_book", first_name: "Iris", last_name: "Libro", email: "iris@example.test", membership_status: "verified", membership_starts_at: "2025-10-01" },
    { id: "man-1", source: "manual_override", first_name: "Marta", last_name: "Manuale", email: null, membership_status: "verified", membership_starts_at: "2025-09-01" },
  ];
  writes.length = 0;
  failSelect = false;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("route manual-validate (comportamento di prima)", () => {
  it("senza segreto: 401; senza email né nome e cognome: 400", async () => {
    const { POST } = await import("@/app/api/admin/association-members/manual-validate/route");
    const unauthorized = await POST(post({ email: "x@example.test" }, null));
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ ok: false, message: "Unauthorized." });

    const invalid = await POST(post({ first_name: "Solo" }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ ok: false, message: "Inserisci un indirizzo email oppure nome e cognome." });
    expect(writes).toEqual([]);
  });

  it("persona nuova: inserisce la riga manual_override del periodo corrente", async () => {
    const { POST } = await import("@/app/api/admin/association-members/manual-validate/route");
    const response = await POST(post({ email: " Nuova.Persona@Gmail.com ", first_name: " Nuova ", last_name: "Persona" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: "nuova", created: true, expires_at: "2026-12-31" });
    expect(writes).toEqual([
      {
        op: "insert",
        filters: [],
        payload: {
          first_name: "Nuova",
          last_name: "Persona",
          email: "nuovapersona@gmail.com",
          membership_status: "verified",
          membership_starts_at: "2025-09-01",
          membership_expires_at: "2026-12-31",
          source: "manual_override",
          source_row_id: "manual:email:nuovapersona@gmail.com",
          source_hash: null,
          notes_admin: "Validazione manuale da admin",
          updated_at: NOW,
        },
      },
    ]);
  });

  it("persona già validata (stesso nome e cognome): aggiorna la sua riga, nessun'altra", async () => {
    const { POST } = await import("@/app/api/admin/association-members/manual-validate/route");
    const response = await POST(post({ first_name: "marta", last_name: "MANUALE" }));
    expect(await response.json()).toEqual({ ok: true, id: "man-1", created: false, expires_at: "2026-12-31" });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "update", payload: { source_row_id: "manual:name:manuale marta", email: null } });
    expect(writes[0].filters).toContainEqual(["id", "man-1"]);
    expect(rows.find((row) => row.id === "libro-1")).toMatchObject({ source: "official_members_book", membership_status: "verified" });
  });

  it("errore di lettura: 500 con il messaggio", async () => {
    failSelect = true;
    const { POST } = await import("@/app/api/admin/association-members/manual-validate/route");
    const response = await POST(post({ email: "x@example.test" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, message: "lettura non riuscita" });
  });
});

describe("funzione condivisa con il periodo", () => {
  it("periodo 2027: riga a parte, con le date del periodo; quella del primo periodo resta", async () => {
    const { saveManualValidation } = await import("@/lib/association/manual-validation");
    const result = await saveManualValidation(
      { firstName: "Marta", lastName: "Manuale" },
      { period: { paymentsFrom: "2027-01-01", validUntil: "2027-12-31" } },
    );
    expect(result).toEqual({ ok: true, id: "nuova", created: true, expiresAt: "2027-12-31" });
    expect(writes[0]).toMatchObject({
      op: "insert",
      payload: { membership_starts_at: "2027-01-01", membership_expires_at: "2027-12-31", source_row_id: "manual:name:manuale marta:2027-01-01" },
    });
  });

  it("annullare: solo le righe manual_override verified della persona e del periodo diventano 'revoked'", async () => {
    rows.push({ id: "man-2027", source: "manual_override", first_name: "Marta", last_name: "Manuale", email: null, membership_status: "verified", membership_starts_at: "2027-01-01" });
    const { revokeManualValidation } = await import("@/lib/association/manual-validation");
    expect(await revokeManualValidation({ firstName: "Marta", lastName: "Manuale" })).toEqual({ ok: true, revoked: 1 });
    expect(rows.find((row) => row.id === "man-1")?.membership_status).toBe("revoked");
    expect(rows.find((row) => row.id === "man-2027")?.membership_status).toBe("verified");
    expect(writes[0].filters).toContainEqual(["source", "manual_override"]);
    // La persona del libro soci con lo stesso nome non c'entra; nessuna riga: niente scritture.
    writes.length = 0;
    expect(await revokeManualValidation({ email: "iris@example.test" })).toEqual({ ok: true, revoked: 0 });
    expect(writes).toEqual([]);
    expect(rows.find((row) => row.id === "libro-1")?.membership_status).toBe("verified");
  });

  it("route manual-revoke: segreto obbligatorio, poi annulla", async () => {
    const { POST } = await import("@/app/api/admin/association-members/manual-revoke/route");
    expect((await POST(post({ first_name: "Marta", last_name: "Manuale" }, null))).status).toBe(401);
    const response = await POST(post({ first_name: "Marta", last_name: "Manuale" }));
    expect(await response.json()).toEqual({ ok: true, revoked: 1 });
  });
});

describe("deriveMembershipState ignora una validazione annullata", () => {
  it("riga 'revoked' → non vale più", async () => {
    const { deriveMembershipState } = await import("@/lib/association/membership-state");
    const row = { first_name: "Marta", last_name: "Manuale", email: null, source: "manual_override", membership_starts_at: "2025-09-01", membership_expires_at: "2026-12-31" };
    const identity = { firstName: "Marta", lastName: "Manuale" };
    expect(deriveMembershipState([{ ...row, membership_status: "verified" }], identity)).toMatchObject({status:"missing_form",currentYearPaid:true});
    expect(deriveMembershipState([{ ...row, membership_status: "revoked" }], identity).status).toBe("missing_form");
  });
});
