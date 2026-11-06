// Cambia il ruolo di un operatore (D18). Scrive lo storico. Il nuovo ruolo
// vale subito, anche sulle sessioni già aperte.
//
//   npm.cmd run gw:set-role -- "<nome>" admin|organizzatrice

import { createDb, exit } from "./_shared.mjs";

const ROLES = ["admin", "organizzatrice"];

const args = process.argv.slice(2).map((value) => value?.trim()).filter(Boolean);
const role = args.at(-1)?.toLowerCase();
const name = args.slice(0, -1).join(" ").trim();

if (!name || !ROLES.includes(role)) {
  exit('Indica il nome e il ruolo, ad esempio: npm.cmd run gw:set-role -- "Laura" admin\nRuoli: admin, organizzatrice.');
}

const db = createDb();

const { error } = await db.rpc("gw_set_operator_role", {
  p_operator_id: null,
  p_display_name: name,
  p_role: role,
});
if (error) exit(`Errore: ${error.details || error.message}`);

console.log(`Operatore "${name}": ruolo ${role}.`);
