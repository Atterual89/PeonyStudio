// Revoca tutte le sessioni attive di un operatore (disconnette ogni dispositivo).
//
//   node --env-file=.env.local scripts/gestionale/revoke-sessions.mjs <nome>

import { createDb, exit, nameFromArgs } from "./_shared.mjs";

const name = nameFromArgs();
const db = createDb();

const { data, error } = await db.rpc("gw_revoke_operator_sessions", {
  p_operator_id: null,
  p_display_name: name,
});
if (error) exit(`Errore: ${error.message}`);

console.log(`Sessioni revocate per "${name}": ${data}.`);
