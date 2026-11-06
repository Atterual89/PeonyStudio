import { beforeAll, describe, expect, it } from "vitest";

import {
  AUTH_LIMITS,
  computeGlobalBlock,
  computeIpBlock,
  createAuthService,
  evaluateSession,
  hashToken,
  type AuthStore,
  type OperatorRecord,
  type SessionRecord,
} from "../auth-core";
import { hashPin } from "../pin";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Dati inventati.
const PINS = { aurora: "482915", bosco: "730264" };
let operatorHashes: Record<string, string>;

beforeAll(async () => {
  operatorHashes = {
    aurora: await hashPin(PINS.aurora),
    bosco: await hashPin(PINS.bosco),
  };
});

type Attempt = { ipHash: string; success: boolean; at: Date };

function createMemoryStore(clock: () => Date) {
  const operators: OperatorRecord[] = [
    { id: "op-aurora", displayName: "Aurora", pinHash: operatorHashes.aurora, active: true },
    { id: "op-bosco", displayName: "Bosco", pinHash: operatorHashes.bosco, active: true },
  ];
  const attempts: Attempt[] = [];
  const sessions: (SessionRecord & { tokenHash: string })[] = [];
  const unlocks: Date[] = [];

  const store: AuthStore = {
    async listActiveOperators() {
      return operators.filter((op) => op.active);
    },
    async lastUnlockAt() {
      return unlocks.at(-1) ?? null;
    },
    async lastSuccessAt(ipHash) {
      return attempts.filter((a) => a.ipHash === ipHash && a.success).at(-1)?.at ?? null;
    },
    async failureTimes({ ipHash, since }) {
      return attempts
        .filter((a) => !a.success && (!ipHash || a.ipHash === ipHash) && (!since || a.at > since))
        .map((a) => a.at);
    },
    async recordFailure(ipHash, at) {
      attempts.push({ ipHash, success: false, at });
    },
    async recordSuccess({ operatorId, ipHash, tokenHash, expiresAt }) {
      const now = clock();
      attempts.push({ ipHash, success: true, at: now });
      const id = `s-${sessions.length + 1}`;
      sessions.push({
        id,
        operatorId,
        tokenHash,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
        revokedAt: null,
      });
      return { sessionId: id };
    },
    async findSession(tokenHash) {
      const session = sessions.find((s) => s.tokenHash === tokenHash);
      const operator = operators.find((op) => op.id === session?.operatorId);
      return session && operator ? { session: { ...session }, operator: { ...operator } } : null;
    },
    async touchSession(sessionId, lastSeenAt, expiresAt) {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) Object.assign(session, { lastSeenAt, expiresAt });
    },
    async revokeSession(sessionId) {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) session.revokedAt = clock();
    },
  };

  return { store, operators, attempts, sessions, unlocks };
}

function setup() {
  let now = new Date("2026-11-02T10:00:00Z");
  const clock = () => now;
  const memory = createMemoryStore(clock);
  const service = createAuthService(memory.store, clock);
  return {
    ...memory,
    service,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    now: () => now,
  };
}

async function fail(service: ReturnType<typeof setup>["service"], ipHash: string, times: number) {
  for (let i = 0; i < times; i += 1) {
    const result = await service.login({ pin: "111222", ipHash, userAgent: null });
    expect(result.ok).toBe(false);
  }
}

describe("login con solo PIN", () => {
  it("il PIN identifica l'operatore e crea una sessione valida", async () => {
    const t = setup();

    const result = await t.service.login({ pin: PINS.bosco, ipHash: "ip-1", userAgent: "test" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.operator.displayName).toBe("Bosco");
    expect(t.sessions[0].tokenHash).toBe(hashToken(result.token));
    expect(t.sessions[0].tokenHash).not.toBe(result.token);
    expect((await t.service.validateSession(result.token))?.id).toBe("op-bosco");
  });

  it("PIN errato: nessuna sessione, tentativo registrato", async () => {
    const t = setup();
    const result = await t.service.login({ pin: "111222", ipHash: "ip-1", userAgent: null });

    expect(result).toEqual({ ok: false, reason: "pin_errato" });
    expect(t.sessions).toHaveLength(0);
    expect(t.attempts).toHaveLength(1);
  });

  it("un operatore disattivato non può accedere", async () => {
    const t = setup();
    t.operators[0].active = false;
    const result = await t.service.login({ pin: PINS.aurora, ipHash: "ip-1", userAgent: null });
    expect(result.ok).toBe(false);
  });
});

describe("limitazione tentativi per IP", () => {
  it("4 errori non bloccano, il 5° blocca anche il PIN corretto", async () => {
    const t = setup();

    await fail(t.service, "ip-1", 4);
    expect(await t.service.getBlock("ip-1", t.now())).toBeNull();

    await fail(t.service, "ip-1", 1);
    const blocked = await t.service.login({ pin: PINS.aurora, ipHash: "ip-1", userAgent: null });
    expect(blocked).toEqual({ ok: false, reason: "bloccato" });

    // Un altro IP non è bloccato.
    const other = await t.service.login({ pin: PINS.aurora, ipHash: "ip-2", userAgent: null });
    expect(other.ok).toBe(true);
  });

  it("i tentativi durante il blocco non vengono registrati", async () => {
    const t = setup();
    await fail(t.service, "ip-1", 5);
    const before = t.attempts.length;
    await fail(t.service, "ip-1", 3);
    expect(t.attempts.length).toBe(before);
  });

  it("il blocco dura 15 minuti, il successivo 30 (raddoppio)", async () => {
    const t = setup();

    await fail(t.service, "ip-1", 5);
    t.advance(14 * MINUTE);
    expect(await t.service.getBlock("ip-1", t.now())).not.toBeNull();
    t.advance(1 * MINUTE + 1);
    expect(await t.service.getBlock("ip-1", t.now())).toBeNull();

    await fail(t.service, "ip-1", 5);
    t.advance(29 * MINUTE);
    expect(await t.service.getBlock("ip-1", t.now())).not.toBeNull();
    t.advance(1 * MINUTE + 1);
    expect(await t.service.getBlock("ip-1", t.now())).toBeNull();
  });

  it("la durata raddoppia fino a un massimo di 24 ore", () => {
    const start = new Date("2026-11-02T10:00:00Z");
    const failures = (blocks: number) =>
      Array.from({ length: blocks * 5 }, (_, i) => new Date(start.getTime() + i * 1000));

    const lastOf = (blocks: number) => failures(blocks).at(-1)!.getTime();

    expect(computeIpBlock(failures(1), start)!.getTime() - lastOf(1)).toBe(15 * MINUTE);
    expect(computeIpBlock(failures(3), start)!.getTime() - lastOf(3)).toBe(60 * MINUTE);
    expect(computeIpBlock(failures(7), start)!.getTime() - lastOf(7)).toBe(16 * HOUR);
    expect(computeIpBlock(failures(8), start)!.getTime() - lastOf(8)).toBe(DAY);
    expect(computeIpBlock(failures(20), start)!.getTime() - lastOf(20)).toBe(DAY);
  });

  it("un login riuscito dall'IP azzera il contatore", async () => {
    const t = setup();

    await fail(t.service, "ip-1", 4);
    expect((await t.service.login({ pin: PINS.aurora, ipHash: "ip-1", userAgent: null })).ok).toBe(true);
    await fail(t.service, "ip-1", 4);

    expect(await t.service.getBlock("ip-1", t.now())).toBeNull();
  });

  it("lo sblocco (unlock) azzera i blocchi", async () => {
    const t = setup();
    await fail(t.service, "ip-1", 5);
    expect(await t.service.getBlock("ip-1", t.now())).not.toBeNull();

    t.advance(1000);
    t.unlocks.push(t.now());
    t.advance(1000);
    expect(await t.service.getBlock("ip-1", t.now())).toBeNull();
  });
});

describe("limite globale", () => {
  async function thirtyOneFailures(t: ReturnType<typeof setup>) {
    // 31 errori da IP diversi (mai 5 dallo stesso): nessun blocco per IP.
    for (let i = 0; i < 31; i += 1) {
      await fail(t.service, `ip-${i % 8}`, 1);
      t.advance(MINUTE);
    }
  }

  it("30 errori in un'ora non bloccano, il 31° blocca i nuovi login per 1 ora", async () => {
    const t = setup();

    for (let i = 0; i < 30; i += 1) {
      await fail(t.service, `ip-${i % 8}`, 1);
      t.advance(MINUTE);
    }
    expect(await t.service.getBlock("ip-nuovo", t.now())).toBeNull();

    await fail(t.service, "ip-7", 1);
    const result = await t.service.login({ pin: PINS.aurora, ipHash: "ip-nuovo", userAgent: null });
    expect(result).toEqual({ ok: false, reason: "bloccato" });

    t.advance(HOUR + 1);
    expect(await t.service.getBlock("ip-nuovo", t.now())).toBeNull();
  });

  it("le sessioni già attive restano valide durante il blocco globale", async () => {
    const t = setup();
    const login = await t.service.login({ pin: PINS.aurora, ipHash: "ip-casa", userAgent: null });
    if (!login.ok) throw new Error("login atteso");

    await thirtyOneFailures(t);
    expect(await t.service.getBlock("ip-casa", t.now())).not.toBeNull();

    expect((await t.service.validateSession(login.token))?.displayName).toBe("Aurora");
  });

  it("errori distribuiti su più di un'ora non fanno scattare il blocco", () => {
    const start = new Date("2026-11-02T10:00:00Z");
    const spread = Array.from({ length: 40 }, (_, i) => new Date(start.getTime() + i * 3 * MINUTE));
    expect(computeGlobalBlock(spread, spread.at(-1)!)).toBeNull();
  });
});

describe("validazione della sessione", () => {
  function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
    const createdAt = new Date("2026-11-02T10:00:00Z");
    return {
      id: "s-1",
      operatorId: "op-aurora",
      createdAt,
      lastSeenAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + 30 * DAY),
      revokedAt: null,
      ...overrides,
    };
  }
  const operator: OperatorRecord = { id: "op-aurora", displayName: "Aurora", pinHash: "", active: true };
  const created = new Date("2026-11-02T10:00:00Z").getTime();

  it("valida", () => {
    expect(evaluateSession(session(), operator, new Date(created + 10 * MINUTE)).ok).toBe(true);
  });

  it("scaduta per inattività (30 giorni)", () => {
    expect(evaluateSession(session(), operator, new Date(created + 30 * DAY + 1))).toEqual({
      ok: false,
      reason: "scaduta",
    });
  });

  it("revocata", () => {
    const revoked = session({ revokedAt: new Date(created + MINUTE) });
    expect(evaluateSession(revoked, operator, new Date(created + 2 * MINUTE))).toEqual({
      ok: false,
      reason: "revocata",
    });
  });

  it("operatore disattivato", () => {
    expect(evaluateSession(session(), { ...operator, active: false }, new Date(created + MINUTE))).toEqual({
      ok: false,
      reason: "operatore_disattivato",
    });
  });

  it("la scadenza scorre con l'uso ma non supera i 90 giorni", async () => {
    const t = setup();
    const login = await t.service.login({ pin: PINS.aurora, ipHash: "ip-1", userAgent: null });
    if (!login.ok) throw new Error("login atteso");

    // Uso quotidiano: la sessione resta valida grazie alla scadenza scorrevole…
    for (let day = 1; day < 90; day += 1) {
      t.advance(DAY);
      expect(await t.service.validateSession(login.token), `giorno ${day}`).not.toBeNull();
    }
    expect(t.sessions[0].expiresAt.getTime()).toBeLessThanOrEqual(
      t.sessions[0].createdAt.getTime() + AUTH_LIMITS.sessionAbsoluteMs,
    );

    // …ma non oltre il massimo assoluto.
    t.advance(DAY);
    expect(await t.service.validateSession(login.token)).toBeNull();
  });

  it("logout: la sessione viene revocata", async () => {
    const t = setup();
    const login = await t.service.login({ pin: PINS.aurora, ipHash: "ip-1", userAgent: null });
    if (!login.ok) throw new Error("login atteso");

    await t.service.logout(login.token);
    expect(t.sessions[0].revokedAt).not.toBeNull();
    expect(await t.service.validateSession(login.token)).toBeNull();
  });

  it("token sconosciuto o assente", async () => {
    const t = setup();
    expect(await t.service.validateSession("token-inventato")).toBeNull();
    expect(await t.service.validateSession(undefined)).toBeNull();
  });
});
