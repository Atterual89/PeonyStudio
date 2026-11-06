// Azzera tutti i blocchi di accesso (per IP e globale).
// I tentativi falliti precedenti restano nello storico ma non contano più.
//
//   node --env-file=.env.local scripts/gestionale/unlock.mjs

import { createDb, exit } from "./_shared.mjs";

const db = createDb();

const { error } = await db.rpc("gw_unlock_logins", { p_operator_id: null });
if (error) exit(`Errore: ${error.message}`);

console.log("Blocchi di accesso azzerati.");
