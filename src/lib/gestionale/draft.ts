// 4g (#23): bozza del box di testo. Testo e anteprima non salvati si
// conservano SOLO su quel telefono (localStorage), con una chiave per
// workshop e operatore. Si cancellano al salvataggio, con "Svuota" o dopo 7
// giorni. Nella bozza c'è solo ciò che Ale stessa ha scritto (testo e righe
// dell'anteprima): mai iscrizioni già salvate né risposte del server.

/** Dopo quanti giorni una bozza non si propone più. */
export const DRAFT_DAYS = 7;

const VERSION = 1;
const KEY_PREFIX = "gw-bozza:";

export function draftKey(workshopId: string, operatorId: string): string {
  return `${KEY_PREFIX}${workshopId}:${operatorId}`;
}

/**
 * Campi di una riga dell'anteprima che si conservano: tutti nati dal testo
 * incollato o dalle correzioni di Ale. Qualsiasi altro campo si scarta.
 */
const ROW_KEYS = [
  "key",
  "line",
  "original",
  "people",
  "emails",
  "baseStatus",
  "feeCents",
  "feeCustom",
  "invoiceStatus",
  "invoiceUncertain",
  "ambiguousSlash",
  "payments",
  "notes",
  "warnings",
  "include",
  "feeText",
  "addedAnyway",
  "textStatus",
  "forcedStatus",
  "statusResolved",
  "sameAs",
  "saveEmail",
  "importCancelled",
  "expanded",
] as const;

const PAYMENT_KEYS = ["amountText", "paymentType", "typeAuto", "method", "paidOn", "receivedBy", "removed", "parsed"] as const;

function pick(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in source) out[key] = source[key];
  return out;
}

function cleanRow(row: unknown): Record<string, unknown> {
  const out = pick(row, ROW_KEYS);
  if (Array.isArray(out.payments)) out.payments = out.payments.map((payment) => pick(payment, PAYMENT_KEYS));
  return out;
}

export type TextDraft<Row> = { savedAt: string; text: string; rows: Row[] | null };

/** Testo da salvare nel telefono; null = niente da conservare (la bozza si cancella). */
export function serializeDraft(text: string, rows: readonly unknown[] | null, savedAt: string): string | null {
  if (!text.trim() && !rows) return null;
  return JSON.stringify({ v: VERSION, savedAt, text, rows: rows ? rows.map(cleanRow) : null });
}

/** Giorno (Europe/Rome) di un istante, "aaaa-mm-gg". */
function romeDay(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Scaduta: salvata più di 7 giorni prima di oggi (date Europe/Rome). */
export function draftExpired(savedAt: string, today: string): boolean {
  const day = romeDay(savedAt);
  if (!day) return true;
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000;
  return !(days <= DRAFT_DAYS);
}

/** Bozza valida e non scaduta, altrimenti null. */
export function readDraft<Row>(raw: string | null | undefined, today: string): TextDraft<Row> | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { v?: unknown; savedAt?: unknown; text?: unknown; rows?: unknown };
    if (data.v !== VERSION || typeof data.savedAt !== "string" || typeof data.text !== "string") return null;
    if (data.rows !== null && !Array.isArray(data.rows)) return null;
    if (draftExpired(data.savedAt, today)) return null;
    if (!data.text.trim() && !data.rows) return null;
    return { savedAt: data.savedAt, text: data.text, rows: data.rows ? (data.rows.map(cleanRow) as Row[]) : null };
  } catch {
    return null;
  }
}

const dayMonth = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" });

/** "Hai un testo non salvato del 29 ott". */
export function draftPrompt(savedAt: string): string {
  const date = new Date(savedAt);
  return Number.isNaN(date.getTime()) ? "Hai un testo non salvato" : `Hai un testo non salvato del ${dayMonth.format(date)}`;
}

/** Accesso al localStorage sempre protetto: in privato o con i dati bloccati può fallire. */
export const draftStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      // Spazio pieno o storage bloccato: la bozza non si conserva.
    }
  },
  /** All'uscita (logout): via tutte le bozze del gestionale su questo telefono. */
  clearAll(): void {
    try {
      const storage = window.localStorage;
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
        (key): key is string => key !== null && key.startsWith(KEY_PREFIX),
      );
      for (const key of keys) storage.removeItem(key);
    } catch {
      // Storage bloccato: non c'è niente da cancellare.
    }
  },
};
