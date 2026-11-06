import "server-only";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import {
  AUTH_LIMITS,
  createAuthService,
  hashIp,
  type AuthStore,
  type AuthenticatedOperator,
  type LoginResult,
  type OperatorRecord,
} from "@/lib/gestionale/auth-core";
import { getGestionaleDb } from "@/lib/gestionale/server/db";

export { hashPin, verifyPin } from "@/lib/gestionale/pin";
export type { AuthenticatedOperator, OperatorRole } from "@/lib/gestionale/auth-core";

export const SESSION_COOKIE = "gw_session";
export const LOGIN_PATH = "/gestione/accesso";

const QUERY_LIMIT = 10000;

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`Gestionale (${context}): ${error?.message ?? "errore sconosciuto"}`);
}

const supabaseAuthStore: AuthStore = {
  async listActiveOperators() {
    const { data, error } = await getGestionaleDb()
      .from("gw_operators")
      .select("id, display_name, pin_hash, active, role")
      .eq("active", true);
    if (error) fail("operatori", error);

    return (data ?? []).map(
      (row): OperatorRecord => ({
        id: row.id,
        displayName: row.display_name,
        pinHash: row.pin_hash,
        active: row.active,
        role: row.role,
      }),
    );
  },

  async lastUnlockAt() {
    const { data, error } = await getGestionaleDb()
      .from("gw_login_unlocks")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("sblocchi", error);
    return data ? new Date(data.created_at) : null;
  },

  async lastSuccessAt(ipHash) {
    const { data, error } = await getGestionaleDb()
      .from("gw_login_attempts")
      .select("created_at")
      .eq("ip_hash", ipHash)
      .eq("success", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("tentativi", error);
    return data ? new Date(data.created_at) : null;
  },

  async failureTimes({ ipHash, since }) {
    let query = getGestionaleDb()
      .from("gw_login_attempts")
      .select("created_at")
      .eq("success", false)
      .order("created_at", { ascending: true })
      .limit(QUERY_LIMIT);
    if (ipHash) query = query.eq("ip_hash", ipHash);
    if (since) query = query.gt("created_at", since.toISOString());

    const { data, error } = await query;
    if (error) fail("tentativi", error);
    return (data ?? []).map((row) => new Date(row.created_at));
  },

  async recordFailure(ipHash, at) {
    const { error } = await getGestionaleDb()
      .from("gw_login_attempts")
      .insert({ ip_hash: ipHash, success: false, created_at: at.toISOString() });
    if (error) fail("registrazione tentativo", error);
  },

  async recordSuccess({ operatorId, ipHash, tokenHash, userAgent, expiresAt }) {
    const { data, error } = await getGestionaleDb().rpc("gw_login_succeeded", {
      p_operator_id: operatorId,
      p_token_hash: tokenHash,
      p_ip_hash: ipHash,
      p_user_agent: userAgent,
      p_expires_at: expiresAt.toISOString(),
    });
    if (error) fail("creazione sessione", error);
    return { sessionId: data as string };
  },

  async findSession(tokenHash) {
    const { data, error } = await getGestionaleDb()
      .from("gw_sessions")
      .select(
        "id, operator_id, created_at, last_seen_at, expires_at, revoked_at, gw_operators!gw_sessions_operator_id_fkey!inner(id, display_name, active, role)",
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) fail("sessione", error);
    if (!data) return null;

    const operator = (Array.isArray(data.gw_operators)
      ? data.gw_operators[0]
      : data.gw_operators) as { id: string; display_name: string; active: boolean; role: string | null } | undefined;
    if (!operator) return null;

    return {
      session: {
        id: data.id,
        operatorId: data.operator_id,
        createdAt: new Date(data.created_at),
        lastSeenAt: new Date(data.last_seen_at),
        expiresAt: new Date(data.expires_at),
        revokedAt: data.revoked_at ? new Date(data.revoked_at) : null,
      },
      operator: {
        id: operator.id,
        displayName: operator.display_name,
        pinHash: "",
        active: operator.active,
        role: operator.role === "admin" ? "admin" : "organizzatrice",
      },
    };
  },

  async touchSession(sessionId, lastSeenAt, expiresAt) {
    const { error } = await getGestionaleDb()
      .from("gw_sessions")
      .update({
        last_seen_at: lastSeenAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", sessionId)
      .is("revoked_at", null);
    if (error) fail("aggiornamento sessione", error);
  },

  async revokeSession(sessionId, operatorId) {
    const { error } = await getGestionaleDb().rpc("gw_logout", {
      p_operator_id: operatorId,
      p_session_id: sessionId,
    });
    if (error) fail("logout", error);
  },
};

const authService = createAuthService(supabaseAuthStore);

/** IP del client su Netlify, con ripieghi per altri ambienti. */
export function getClientIp(requestHeaders: Headers): string {
  const netlifyIp = requestHeaders.get("x-nf-client-connection-ip")?.trim();
  if (netlifyIp) return netlifyIp;

  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return requestHeaders.get("x-real-ip")?.trim() || "sconosciuto";
}

function getIpHashSalt(): string {
  const salt = process.env.GW_IP_HASH_SALT;
  if (!salt || salt.length < 16) {
    throw new Error("Gestionale: GW_IP_HASH_SALT mancante o troppo corto (minimo 16 caratteri).");
  }
  return salt;
}

/** Scrive il cookie di sessione sul dispositivo dopo un login riuscito. */
async function createSession(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // In sviluppo (http://localhost) Safari scarta i cookie Secure.
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/gestione",
    // La validità reale è decisa dal database (30 giorni scorrevoli, massimo
    // 90): il cookie vive quanto il massimo assoluto.
    maxAge: Math.floor(AUTH_LIMITS.sessionAbsoluteMs / 1000),
  });
}

/** Da chiamare solo in una Server Action (scrive un cookie). */
export async function loginWithPin(pin: string): Promise<LoginResult> {
  const requestHeaders = await headers();
  const ipHash = hashIp(getClientIp(requestHeaders), getIpHashSalt());

  const result = await authService.login({
    pin,
    ipHash,
    userAgent: requestHeaders.get("user-agent"),
  });

  if (result.ok) {
    await createSession(result.token);
  }

  return result;
}

/** Operatore della richiesta corrente, o null. Memorizzato per richiesta. */
export const getCurrentOperator = cache(async (): Promise<AuthenticatedOperator | null> => {
  const cookieStore = await cookies();
  return authService.validateSession(cookieStore.get(SESSION_COOKIE)?.value);
});

/**
 * Primo controllo di ogni pagina, server action e route handler del
 * gestionale: valida la sessione sul database, altrimenti rimanda al login.
 */
export async function requireOperator(): Promise<AuthenticatedOperator> {
  const operator = await getCurrentOperator();
  if (!operator) redirect(LOGIN_PATH);
  return operator;
}

export function isAdmin(operator: Pick<AuthenticatedOperator, "role">): boolean {
  return operator.role === "admin";
}

/**
 * D18: pagine, server action, route handler e loader riservati agli admin.
 * All'organizzatrice risponde 404 (nelle server action la promessa viene
 * rifiutata): non rivela nemmeno che la risorsa esiste.
 */
export async function requireAdmin(): Promise<AuthenticatedOperator> {
  const operator = await requireOperator();
  if (!isAdmin(operator)) notFound();
  return operator;
}

/**
 * Azioni dell'organizzatrice (tab Iscrizioni: iscrizioni, partner, stato,
 * quote, pagamenti, importazione). Agli admin risponde 404: le iscrizioni le
 * crea solo l'organizzatrice.
 */
export async function requireOrganizer(): Promise<AuthenticatedOperator> {
  const operator = await requireOperator();
  if (operator.role !== "organizzatrice") notFound();
  return operator;
}

/** Logout: revoca la sessione sul database e cancella il cookie. Solo in Server Action. */
export async function revokeSession(): Promise<void> {
  const cookieStore = await cookies();
  await authService.logout(cookieStore.get(SESSION_COOKIE)?.value);
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/gestione",
    maxAge: 0,
  });
}
