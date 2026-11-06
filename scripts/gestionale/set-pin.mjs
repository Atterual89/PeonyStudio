// Crea un operatore (se non esiste) o sostituisce il suo PIN.
// Revoca sempre tutte le sessioni esistenti dell'operatore.
//
//   node --env-file=.env.local scripts/gestionale/set-pin.mjs <nome>
//
// Il PIN si inserisce in modo nascosto, mai come argomento.

import { checkNewPin, hashPin } from "../../src/lib/gestionale/pin.ts";
import { createDb, exit, nameFromArgs, normalizeName, promptHidden } from "./_shared.mjs";

const REASONS = {
  formato: "Il PIN deve essere di esattamente 6 cifre.",
  banale: "PIN troppo semplice (cifre tutte uguali o in sequenza). Scegline un altro.",
  in_uso: "PIN già usato da un altro operatore. Scegline un altro.",
};

const name = nameFromArgs();
const db = createDb();

const { data: operators, error } = await db
  .from("gw_operators")
  .select("id, display_name, pin_hash");
if (error) exit(`Errore nella lettura degli operatori: ${error.message}`);

const existing = operators.find((op) => normalizeName(op.display_name) === normalizeName(name));
const otherHashes = operators.filter((op) => op !== existing).map((op) => op.pin_hash);

console.log(
  existing
    ? `Operatore esistente: ${existing.display_name}. Il PIN verrà sostituito.`
    : `Nuovo operatore: ${name}.`,
);

const pin = await promptHidden("Nuovo PIN (6 cifre): ");
const check = await checkNewPin(pin, otherHashes);
if (!check.ok) exit(REASONS[check.reason]);

const confirmation = await promptHidden("Ripeti il PIN: ");
if (confirmation !== pin) exit("I due PIN non coincidono. Nessuna modifica eseguita.");

const pinHash = await hashPin(pin);

const { data, error: rpcError } = await db.rpc("gw_set_operator_pin", {
  p_operator_id: null,
  p_display_name: name,
  p_pin_hash: pinHash,
});
if (rpcError) exit(`Errore nel salvataggio: ${rpcError.message}`);

const result = Array.isArray(data) ? data[0] : data;
console.log(result.out_created ? `Operatore "${name}" creato.` : `PIN di "${existing.display_name}" aggiornato.`);
console.log(`Sessioni revocate: ${result.out_revoked_sessions}.`);
