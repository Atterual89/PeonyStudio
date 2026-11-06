// "Segna quota ok" del gestionale (D11 rivista): solo admin, lato server;
// chiama la funzione condivisa con il periodo del workshop e l'identità del
// badge; senza nome e cognome né email chiede di completarli. Dati inventati.

import { beforeEach, describe, expect, it, vi } from "vitest";

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
let role: "admin" | "organizzatrice" = "admin";
let identity: { email: string | null; firstName: string | null; lastName: string | null } = { email: null, firstName: "Viola", lastName: "Prova" };

type Mocked<T> = (...args: unknown[]) => Promise<T>;
const save = vi.fn<Mocked<{ ok: true; id: string; created: boolean; expiresAt: string }>>(async () => ({ ok: true, id: "riga", created: true, expiresAt: "2027-12-31" }));
const revoke = vi.fn<Mocked<{ ok: true; revoked: number }>>(async () => ({ ok: true, revoked: 1 }));
const log = vi.fn<Mocked<{ ok: boolean; data: null }>>(async () => ({ ok: true, data: null }));
const clear = vi.fn(async () => {});

vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("@/lib/gestionale/server/auth", () => ({
  requireAdmin: async () => {
    if (role !== "admin") throw new Error(NOT_FOUND);
    return { id: "op-admin", role };
  },
}));
vi.mock("@/lib/gestionale/server/data", () => ({
  getPerson: async (id: string) => ({ id, merged_into: null }),
  getWorkshopView: async (id: string) => ({ id, startsOn: "2027-02-06" }),
}));
vi.mock("@/lib/gestionale/server/membership", () => ({
  membershipIdentityOf: async () => identity,
  clearMembershipCache: () => clear(),
}));
vi.mock("@/lib/gestionale/server/mutations", () => ({ logMemberValidation: (...args: unknown[]) => log(...args) }));
vi.mock("@/lib/association/manual-validation", () => ({
  saveManualValidation: (...args: unknown[]) => save(...args),
  revokeManualValidation: (...args: unknown[]) => revoke(...args),
}));

const P = "00000000-0000-4000-8000-0000000000a1";
const W = "00000000-0000-4000-8000-0000000000b1";
const PERIOD_2027 = { paymentsFrom: "2027-01-01", validUntil: "2027-12-31" };

beforeEach(() => {
  role = "admin";
  identity = { email: null, firstName: "Viola", lastName: "Prova" };
  for (const mock of [save, revoke, log, clear]) mock.mockClear();
});

describe("Segna quota ok", () => {
  it("Ale: 404, niente scritture (anche Annulla e Aggiorna stato soci)", async () => {
    role = "organizzatrice";
    const actions = await import("@/app/gestione/(app)/p/membership-actions");
    await expect(actions.markQuotaOkAction({ personId: P, workshopId: W })).rejects.toThrow(NOT_FOUND);
    await expect(actions.revokeQuotaOkAction({ personId: P, workshopId: W })).rejects.toThrow(NOT_FOUND);
    await expect(actions.refreshMembershipAction()).rejects.toThrow(NOT_FOUND);
    expect(save).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  it("admin: funzione condivisa con il periodo del workshop (2027 → anno solare), storico, cache svuotata", async () => {
    const { markQuotaOkAction } = await import("@/app/gestione/(app)/p/membership-actions");
    expect(await markQuotaOkAction({ personId: P, workshopId: W })).toEqual({ ok: true });
    expect(save).toHaveBeenCalledWith(identity, { period: PERIOD_2027 });
    expect(log).toHaveBeenCalledWith("op-admin", P, "quota_ok", expect.objectContaining({ riga: "riga" }));
    expect(clear).toHaveBeenCalled();
  });

  it("senza nome e cognome né email: chiede di completarli, niente scritture", async () => {
    identity = { email: null, firstName: "Solo", lastName: null };
    const { markQuotaOkAction } = await import("@/app/gestione/(app)/p/membership-actions");
    expect(await markQuotaOkAction({ personId: P, workshopId: W })).toEqual({
      ok: false,
      error: "Completa prima nome e cognome oppure l'email della persona.",
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("annulla: solo le validazioni manuali del periodo (funzione condivisa)", async () => {
    const { revokeQuotaOkAction } = await import("@/app/gestione/(app)/p/membership-actions");
    expect(await revokeQuotaOkAction({ personId: P, workshopId: W })).toEqual({ ok: true });
    expect(revoke).toHaveBeenCalledWith(identity, { period: PERIOD_2027 });
  });

  it("4e (#15): dalla scheda persona, il periodo scelto (non solo quello di oggi)", async () => {
    const { markQuotaOkAction } = await import("@/app/gestione/(app)/p/membership-actions");
    expect(await markQuotaOkAction({ personId: P, workshopId: null, periodFrom: "2027-01-01" })).toEqual({ ok: true });
    expect(save).toHaveBeenCalledWith(identity, { period: PERIOD_2027 });
    expect(await markQuotaOkAction({ personId: P, workshopId: null, periodFrom: "2025-09-01" })).toEqual({ ok: true });
    expect(save).toHaveBeenLastCalledWith(identity, { period: { paymentsFrom: "2025-09-01", validUntil: "2026-12-31" } });
    // Una data che non è l'inizio di un periodo: rifiutata.
    expect((await markQuotaOkAction({ personId: P, workshopId: null, periodFrom: "2027-03-01" })).ok).toBe(false);
  });
});
