// Rinomina un operatore (il PIN e le sessioni non cambiano). Scrive lo storico.
//
//   npm.cmd run gw:rename-operator -- "<vecchio>" "<nuovo>"

import { createDb, exit } from "./_shared.mjs";

const [oldName, newName] = process.argv.slice(2).map((value) => value?.trim());
if (!oldName || !newName) {
  exit('Indica il nome attuale e quello nuovo, ad esempio: npm.cmd run gw:rename-operator -- "RedSabbath" "Ale"');
}

const db = createDb();

const { error } = await db.rpc("gw_rename_operator", {
  p_operator_id: null,
  p_old_name: oldName,
  p_new_name: newName,
});
if (error) exit(`Errore: ${error.details || error.message}`);

console.log(`Operatore "${oldName}" rinominato in "${newName}".`);
