// Traduce gli errori delle funzioni gw_* (SQLSTATE dedicati, vedi
// 011_gw_functions_v2.sql) in messaggi italiani per l'interfaccia.

/**
 * 4g (#19): conflitto di versione. Niente "operatore" né "ricarica": la frase
 * dice chi ha cambiato (quando si sa, conflictText) e accanto c'è il pulsante
 * "Aggiorna" (Notice lo aggiunge a ogni messaggio di conflitto).
 */
export const CONFLICT_MESSAGE = "Questi dati sono appena stati cambiati da qualcun altro.";

/** "Peony ha appena cambiato questa iscrizione." · "Hai appena cambiato…" (da un'altra schermata). */
/** `who`: "io" (lo stesso operatore), la parte (Peony / Ale) o null se non si sa. */
export function conflictText(who: string | null, what: string): string {
  if (who === "io") return `Hai appena cambiato ${what} da un'altra schermata.`;
  if (who) return `${who} ha appena cambiato ${what}.`;
  return CONFLICT_MESSAGE;
}

/** Messaggio di conflitto (per mostrare "Aggiorna"). */
export function isConflictMessage(text: unknown): boolean {
  return typeof text === "string" && /appena (?:stati )?cambiat/.test(text);
}

/** 4g (#20): valore non valido, con il campo da controllare. */
export const INVALID_FIELDS_MESSAGE = "Un importo, una data o una percentuale non sono validi: controlla i campi evidenziati.";

type RpcError = { code?: string | null; message?: string | null; details?: string | null } | null | undefined;

/**
 * 4e (gruppo 5): nei testi visibili sempre "iscrizione", mai "prenotazione".
 * Alcuni messaggi delle funzioni gw_* (migrazioni 011–013) dicono ancora
 * "prenotazione": si traducono qui, senza toccare le migrazioni già applicate.
 */
export function withIscrizione(text: string): string {
  return text
    .replace(/\b([Uu])na prenotazione\b/g, (_, u: string) => `${u}n'iscrizione`)
    .replace(/\b([Ll])a prenotazione\b/g, (_, l: string) => `${l}'iscrizione`)
    .replace(/\b(dell|dall|nell|all)a prenotazione\b/g, "$1'iscrizione")
    .replace(/\bprenotazion([ei])\b/g, "iscrizion$1")
    .replace(/\bPrenotazion([ei])\b/g, "Iscrizion$1");
}

export function rpcErrorMessage(error: RpcError): string {
  const code = error?.code ?? "";
  const details = error?.details?.trim() ? withIscrizione(error.details.trim()) : undefined;

  switch (code) {
    case "GW409":
      return CONFLICT_MESSAGE;
    case "GW404":
      return "Elemento non trovato: forse è stato eliminato o unito. Ricarica la pagina.";
    case "GWDUP":
      return details
        ? `${details} è già iscritto/a a questo workshop.`
        : "Questa persona è già iscritta a questo workshop.";
    case "GWMRG":
      return details
        ? `Unione bloccata: entrambe le persone sono iscritte a ${details}. Togli prima una delle due iscrizioni.`
        : "Unione bloccata: entrambe le persone sono iscritte allo stesso workshop.";
    case "GW400":
      return details || INVALID_FIELDS_MESSAGE;
    case "23505":
      // Indice unico sulle iscrizioni attive (gara tra due salvataggi).
      return "Questa persona è già iscritta a questo workshop.";
    case "23514":
    case "22007":
    case "22008":
    case "22P02":
      return INVALID_FIELDS_MESSAGE;
    default:
      return "Salvataggio non riuscito. Riprova; i dati inseriti sono ancora nel modulo.";
  }
}
