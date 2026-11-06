// Elenca gli operatori: nome, ruolo, stato, ultimo accesso, sessioni attive.
//
//   node --env-file=.env.local scripts/gestionale/list-operators.mjs

import { createDb, exit } from "./_shared.mjs";

const ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000;

const db = createDb();

const [operatorsResult, sessionsResult] = await Promise.all([
  db.from("gw_operators").select("id, display_name, role, active, pin_updated_at").order("display_name"),
  db.from("gw_sessions").select("operator_id, created_at, last_seen_at, expires_at, revoked_at"),
]);
if (operatorsResult.error) exit(`Errore: ${operatorsResult.error.message}`);
if (sessionsResult.error) exit(`Errore: ${sessionsResult.error.message}`);

const now = Date.now();
const formatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

if (operatorsResult.data.length === 0) {
  console.log("Nessun operatore. Creane uno con set-pin.mjs <nome>.");
  process.exit(0);
}

const rows = operatorsResult.data.map((operator) => {
  const sessions = sessionsResult.data.filter((s) => s.operator_id === operator.id);
  const active = sessions.filter(
    (s) =>
      !s.revoked_at &&
      new Date(s.expires_at).getTime() > now &&
      new Date(s.created_at).getTime() + ABSOLUTE_MS > now,
  );
  const lastSeen = sessions
    .map((s) => new Date(s.last_seen_at).getTime())
    .sort((a, b) => b - a)[0];

  return {
    Nome: operator.display_name,
    Ruolo: operator.role,
    Stato: operator.active ? "attivo" : "disattivato",
    "Ultimo accesso": lastSeen ? formatter.format(lastSeen) : "mai",
    "Sessioni attive": active.length,
    "PIN aggiornato": formatter.format(new Date(operator.pin_updated_at)),
  };
});

console.table(rows);
