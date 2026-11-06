// Hash e verifica dei PIN operatore (contesto 4.2).
// Modulo puro, senza dipendenze da Next o Supabase: lo importano sia il server
// (src/lib/gestionale/server/auth.ts) sia gli script in scripts/gestionale/,
// che lo eseguono con lo "type stripping" di Node. Per questo usa solo sintassi
// TypeScript cancellabile (niente enum, namespace o parameter properties).

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const PIN_LENGTH = 6;

const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
// scrypt usa 128 * N * r byte (32 MiB con questi parametri): il limite
// predefinito di Node è proprio 32 MiB, quindi va alzato esplicitamente.
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export type PinHashParams = {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
};

export type PinCandidate<T> = {
  pinHash: string;
  value: T;
};

export function isPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

function deriveKey(
  pin: string,
  salt: Buffer,
  N: number,
  r: number,
  p: number,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, keyLength, { N, r, p, maxmem: SCRYPT_MAXMEM }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPin(pin: string): Promise<string> {
  if (!isPinFormat(pin)) {
    throw new Error("Il PIN deve essere di 6 cifre.");
  }

  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveKey(pin, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P, KEY_BYTES);

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

export function parsePinHash(stored: string): PinHashParams | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  // Limiti di sicurezza: rifiuta parametri che renderebbero il calcolo
  // abnormemente costoso o banale.
  if (!Number.isInteger(N) || N < 2 ** 14 || N > 2 ** 17 || (N & (N - 1)) !== 0) {
    return null;
  }
  if (!Number.isInteger(r) || r < 1 || r > 16) return null;
  if (!Number.isInteger(p) || p < 1 || p > 4) return null;

  const salt = Buffer.from(parts[4], "base64");
  const hash = Buffer.from(parts[5], "base64");
  if (salt.length < 16 || hash.length < 16) return null;

  return { N, r, p, salt, hash };
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const params = parsePinHash(stored);

  if (!params || !isPinFormat(pin)) {
    // Calcolo fittizio con i parametri standard: il tempo di risposta resta
    // simile anche con un hash malformato o un PIN non valido.
    await deriveKey("000000", randomBytes(SALT_BYTES), SCRYPT_N, SCRYPT_R, SCRYPT_P, KEY_BYTES);
    return false;
  }

  const candidate = await deriveKey(
    pin,
    params.salt,
    params.N,
    params.r,
    params.p,
    params.hash.length,
  );

  return timingSafeEqual(candidate, params.hash);
}

/**
 * Confronta il PIN con TUTTI i candidati, in sequenza, senza fermarsi alla
 * prima corrispondenza: il tempo di risposta non rivela se il PIN è giusto.
 * Sequenziale (non Promise.all) per non allocare N × 32 MiB in parallelo.
 * Se più candidati corrispondono (non dovrebbe succedere, set-pin lo impedisce)
 * restituisce null: meglio rifiutare che autenticare la persona sbagliata.
 */
export async function findByPin<T>(
  pin: string,
  candidates: readonly PinCandidate<T>[],
): Promise<{ match: T | null; comparisons: number }> {
  const matches: T[] = [];
  let comparisons = 0;

  for (const candidate of candidates) {
    comparisons += 1;
    if (await verifyPin(pin, candidate.pinHash)) {
      matches.push(candidate.value);
    }
  }

  return { match: matches.length === 1 ? matches[0] : null, comparisons };
}

/** PIN banali: sei cifre uguali o sequenze crescenti/decrescenti (es. 123456, 654321). */
export function isTrivialPin(pin: string): boolean {
  if (!isPinFormat(pin)) return false;

  const digits = pin.split("").map(Number);
  const allSame = digits.every((digit) => digit === digits[0]);
  const ascending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] + 1);
  const descending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] - 1);

  return allSame || ascending || descending;
}

export type NewPinCheck =
  | { ok: true }
  | { ok: false; reason: "formato" | "banale" | "in_uso" };

/**
 * Validazione usata da set-pin.mjs. `otherOperatorHashes` sono gli hash di
 * tutti gli ALTRI operatori (attivi e non): due operatori non possono avere
 * lo stesso PIN, perché il PIN da solo identifica l'operatore.
 */
export async function checkNewPin(
  pin: string,
  otherOperatorHashes: readonly string[],
): Promise<NewPinCheck> {
  if (!isPinFormat(pin)) return { ok: false, reason: "formato" };
  if (isTrivialPin(pin)) return { ok: false, reason: "banale" };

  let inUse = false;
  for (const stored of otherOperatorHashes) {
    if (await verifyPin(pin, stored)) inUse = true;
  }

  return inUse ? { ok: false, reason: "in_uso" } : { ok: true };
}
