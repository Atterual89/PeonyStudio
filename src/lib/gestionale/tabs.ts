// D18: tab del dettaglio workshop per ruolo. Un tab dell'altro ruolo (es.
// ?tab=partecipanti per l'organizzatrice) non è consentito: la pagina
// risponde 404, lato server.

import type { OperatorRole } from "./types";

export const WORKSHOP_TABS = {
  admin: [
    { key: "partecipanti", label: "Partecipanti" },
    { key: "conti", label: "Conti" },
    // D27 (Fase 5): email per il Ccn di Gmail, solo admin.
    { key: "email", label: "Email" },
    { key: "info", label: "Info" },
  ],
  organizzatrice: [
    { key: "iscrizioni", label: "Iscrizioni" },
    { key: "conti", label: "Conti" },
    { key: "info", label: "Info" },
  ],
} as const satisfies Record<OperatorRole, readonly { key: string; label: string }[]>;

/** D23: il tab Pagamenti degli admin non c'è più, il contenuto è in Conti → Entrate. */
export function workshopTabRedirect(role: OperatorRole, tab: string | string[] | undefined): string | null {
  return role === "admin" && tab === "pagamenti" ? "conti" : null;
}

/** Tab attivo per il ruolo (il primo se non indicato); null = non consentito. */
export function resolveWorkshopTab(role: OperatorRole, tab: string | string[] | undefined): string | null {
  const tabs = WORKSHOP_TABS[role];
  if (tab === undefined) return tabs[0].key;
  return typeof tab === "string" && tabs.some((t) => t.key === tab) ? tab : null;
}
