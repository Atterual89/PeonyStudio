// Logica di autenticazione del gestionale (contesto 4.2), indipendente dal
// database: il server la collega a Supabase (server/auth.ts), i test a un
// archivio in memoria. Nessun import di Next o Supabase.

import { createHash, randomBytes } from "node:crypto";

import { findByPin, isPinFormat } from "./pin";
import type { OperatorRole } from "./types";

export type { OperatorRole } from "./types";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const AUTH_LIMITS = {
  ipMaxFailures: 5,
  ipBaseBlockMs: 15 * MINUTE,
  ipMaxBlockMs: DAY,
  globalMaxFailures: 30,
  globalWindowMs: HOUR,
  globalBlockMs: HOUR,
  sessionIdleMs: 30 * DAY,
  sessionAbsoluteMs: 90 * DAY,
  // Aggiorna last_seen_at/expires_at al massimo una volta all'ora per sessione.
  sessionTouchIntervalMs: HOUR,
} as const;

export const GENERIC_LOGIN_ERROR = "PIN non valido o accesso temporaneamente bloccato";

export type OperatorRecord = {
  id: string;
  displayName: string;
  pinHash: string;
  active: boolean;
  /** Mancante o sconosciuto = organizzatrice (privilegio minimo). */
  role?: OperatorRole | null;
};

export type SessionRecord = {
  id: string;
  operatorId: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type AuthenticatedOperator = {
  id: string;
  displayName: string;
  sessionId: string;
  role: OperatorRole;
};

/** D18: solo "admin" esplicito è admin; tutto il resto è organizzatrice. */
export function roleOf(operator: Pick<OperatorRecord, "role">): OperatorRole {
  return operator.role === "admin" ? "admin" : "organizzatrice";
}

export interface AuthStore {
  listActiveOperators(): Promise<OperatorRecord[]>;
  /** Ultimo sblocco eseguito con unlock.mjs (null se mai). */
  lastUnlockAt(): Promise<Date | null>;
  /** Ultimo login riuscito da questo IP (null se mai). */
  lastSuccessAt(ipHash: string): Promise<Date | null>;
  /** Istanti dei tentativi falliti dopo `since`, eventualmente filtrati per IP. */
  failureTimes(filter: { ipHash?: string; since: Date | null }): Promise<Date[]>;
  recordFailure(ipHash: string, at: Date): Promise<void>;
  /** Registra tentativo riuscito + nuova sessione + storico, atomicamente. */
  recordSuccess(input: {
    operatorId: string;
    ipHash: string;
    tokenHash: string;
    userAgent: string | null;
    expiresAt: Date;
  }): Promise<{ sessionId: string }>;
  findSession(
    tokenHash: string,
  ): Promise<{ session: SessionRecord; operator: OperatorRecord } | null>;
  touchSession(sessionId: string, lastSeenAt: Date, expiresAt: Date): Promise<void>;
  /** Revoca la sessione e scrive lo storico (logout), atomicamente. */
  revokeSession(sessionId: string, operatorId: string): Promise<void>;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`, "utf8").digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function laterOf(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Blocco per IP. `failures` = tentativi falliti dall'IP dopo l'ultimo successo
 * (o sblocco). Ogni 5 errori scatta un blocco: 15 min, poi 30, 60… fino a 24 h.
 * I tentativi durante un blocco non vengono registrati, quindi non allungano
 * il blocco in corso.
 */
export function computeIpBlock(failures: readonly Date[], now: Date): Date | null {
  const sorted = [...failures].sort((a, b) => a.getTime() - b.getTime());
  const blocks = Math.floor(sorted.length / AUTH_LIMITS.ipMaxFailures);
  if (blocks === 0) return null;

  const triggeredAt = sorted[blocks * AUTH_LIMITS.ipMaxFailures - 1];
  const duration = Math.min(
    AUTH_LIMITS.ipBaseBlockMs * 2 ** (blocks - 1),
    AUTH_LIMITS.ipMaxBlockMs,
  );
  const until = new Date(triggeredAt.getTime() + duration);

  return until > now ? until : null;
}

/**
 * Blocco globale: se in una finestra di 1 ora si superano 30 errori (da
 * qualsiasi IP), i nuovi login sono bloccati per 1 ora dal momento in cui
 * la soglia è stata superata.
 */
export function computeGlobalBlock(failures: readonly Date[], now: Date): Date | null {
  const sorted = [...failures].sort((a, b) => a.getTime() - b.getTime());
  const threshold = AUTH_LIMITS.globalMaxFailures + 1;
  let crossedAt: Date | null = null;

  for (let i = threshold - 1; i < sorted.length; i += 1) {
    const windowStart = sorted[i - (threshold - 1)];
    if (sorted[i].getTime() - windowStart.getTime() <= AUTH_LIMITS.globalWindowMs) {
      crossedAt = sorted[i];
    }
  }

  if (!crossedAt) return null;
  const until = new Date(crossedAt.getTime() + AUTH_LIMITS.globalBlockMs);
  return until > now ? until : null;
}

export type SessionEvaluation =
  | { ok: true; refresh: { lastSeenAt: Date; expiresAt: Date } | null }
  | { ok: false; reason: "revocata" | "scaduta" | "operatore_disattivato" };

/** Scadenza scorrevole di 30 giorni, con massimo assoluto di 90 giorni dalla creazione. */
export function evaluateSession(
  session: SessionRecord,
  operator: OperatorRecord,
  now: Date,
): SessionEvaluation {
  if (session.revokedAt) return { ok: false, reason: "revocata" };
  if (!operator.active) return { ok: false, reason: "operatore_disattivato" };

  const absoluteLimit = new Date(session.createdAt.getTime() + AUTH_LIMITS.sessionAbsoluteMs);
  if (session.expiresAt <= now || absoluteLimit <= now) {
    return { ok: false, reason: "scaduta" };
  }

  const sinceLastSeen = now.getTime() - session.lastSeenAt.getTime();
  if (sinceLastSeen < AUTH_LIMITS.sessionTouchIntervalMs) {
    return { ok: true, refresh: null };
  }

  const slid = new Date(now.getTime() + AUTH_LIMITS.sessionIdleMs);
  return {
    ok: true,
    refresh: { lastSeenAt: now, expiresAt: slid < absoluteLimit ? slid : absoluteLimit },
  };
}

export type LoginResult =
  | {
      ok: true;
      token: string;
      operator: AuthenticatedOperator;
      expiresAt: Date;
    }
  | { ok: false; reason: "bloccato" | "pin_errato" };

export function createAuthService(store: AuthStore, clock: () => Date = () => new Date()) {
  async function getBlock(ipHash: string, now: Date): Promise<Date | null> {
    const unlockedAt = await store.lastUnlockAt();

    const globalSince = laterOf(
      unlockedAt,
      new Date(now.getTime() - AUTH_LIMITS.globalWindowMs - AUTH_LIMITS.globalBlockMs),
    );
    const globalBlock = computeGlobalBlock(
      await store.failureTimes({ since: globalSince }),
      now,
    );
    if (globalBlock) return globalBlock;

    const ipSince = laterOf(unlockedAt, await store.lastSuccessAt(ipHash));
    return computeIpBlock(await store.failureTimes({ ipHash, since: ipSince }), now);
  }

  async function login(input: {
    pin: string;
    ipHash: string;
    userAgent: string | null;
  }): Promise<LoginResult> {
    const now = clock();

    if (await getBlock(input.ipHash, now)) {
      return { ok: false, reason: "bloccato" };
    }

    const operators = isPinFormat(input.pin) ? await store.listActiveOperators() : [];
    const { match } = await findByPin(
      input.pin,
      operators.map((operator) => ({ pinHash: operator.pinHash, value: operator })),
    );

    if (!match) {
      await store.recordFailure(input.ipHash, now);
      return { ok: false, reason: "pin_errato" };
    }

    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + AUTH_LIMITS.sessionIdleMs);
    const { sessionId } = await store.recordSuccess({
      operatorId: match.id,
      ipHash: input.ipHash,
      tokenHash: hashToken(token),
      userAgent: input.userAgent,
      expiresAt,
    });

    return {
      ok: true,
      token,
      expiresAt,
      operator: { id: match.id, displayName: match.displayName, sessionId, role: roleOf(match) },
    };
  }

  async function validateSession(token: string | null | undefined): Promise<AuthenticatedOperator | null> {
    if (!token) return null;

    const found = await store.findSession(hashToken(token));
    if (!found) return null;

    const evaluation = evaluateSession(found.session, found.operator, clock());
    if (!evaluation.ok) return null;

    if (evaluation.refresh) {
      await store.touchSession(
        found.session.id,
        evaluation.refresh.lastSeenAt,
        evaluation.refresh.expiresAt,
      );
    }

    return {
      id: found.operator.id,
      displayName: found.operator.displayName,
      sessionId: found.session.id,
      role: roleOf(found.operator),
    };
  }

  async function logout(token: string | null | undefined): Promise<void> {
    const operator = await validateSession(token);
    if (operator) {
      await store.revokeSession(operator.sessionId, operator.id);
    }
  }

  return { login, validateSession, logout, getBlock };
}
