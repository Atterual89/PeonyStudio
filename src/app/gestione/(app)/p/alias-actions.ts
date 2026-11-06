"use server";

import { existingPeopleFor, type ExistingPerson } from "@/lib/gestionale/aliases";
import { validatePersonForm, type PersonFormValues } from "@/lib/gestionale/people";
import { findPendingEntries, loadAliases } from "@/lib/gestionale/server/aliases";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson, loadPeople } from "@/lib/gestionale/server/data";
import { addPersonAlias, createPersonWithAliases, deletePersonAlias, resolveMatch } from "@/lib/gestionale/server/mutations";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import type { ActionResult, PersonFields } from "@/lib/gestionale/types";
import { asText, isUuidLike } from "@/lib/gestionale/validation";

// Altri nomi e "+ Nuova persona" (4d, parte B2). Solo admin (requireAdmin:
// all'organizzatrice 404).

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };

function readAlias(value: unknown): string {
  return asText(value, 100).replace(/\s+/g, " ").trim();
}

/** "+ Aggiungi" sotto Nickname. Restituisce quante iscrizioni "da abbinare" usano lo stesso nome. */
export async function addAliasAction(input: { personId: string; alias: string }): Promise<ActionResult<{ pending: number }>> {
  const operator = await requireAdmin();
  const alias = readAlias(input?.alias);
  if (!isUuidLike(input?.personId) || !alias) return INVALID;
  const result = await addPersonAlias(operator.id, input.personId, alias);
  if (!result.ok) return result;
  const pending = await findPendingEntries(input.personId, alias);
  refreshGestione();
  return { ok: true, data: { pending: pending.length } };
}

export async function deleteAliasAction(input: { id: string }): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.id)) return INVALID;
  const result = await deletePersonAlias(operator.id, input.id);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/** Dopo aver salvato un nickname: iscrizioni "da abbinare" con lo stesso testo. */
export async function pendingEntriesAction(input: { personId: string; text: string }): Promise<ActionResult<{ pending: number }>> {
  await requireAdmin();
  const text = readAlias(input?.text);
  if (!isUuidLike(input?.personId) || !text) return INVALID;
  return { ok: true, data: { pending: (await findPendingEntries(input.personId, text)).length } };
}

/**
 * "Collega anche N iscrizioni con «X»": ogni iscrizione "da abbinare" con lo
 * stesso testo si collega alla persona (come "Collega" del riquadro
 * dell'abbinamento, con storico). Si ricalcolano sul server.
 */
export async function linkPendingEntriesAction(input: { personId: string; text: string }): Promise<ActionResult<{ linked: number; failed: number }>> {
  const operator = await requireAdmin();
  const text = readAlias(input?.text);
  if (!isUuidLike(input?.personId) || !text) return INVALID;
  const person = await getPerson(input.personId);
  if (!person || person.merged_into) return INVALID;

  let linked = 0;
  let failed = 0;
  for (const entry of await findPendingEntries(person.id, text)) {
    const result = await resolveMatch(
      operator.id,
      { bookingId: entry.bookingId, version: entry.version, participantId: entry.participantId },
      "collega",
      person.id,
    );
    if (result.ok) linked += 1;
    else failed += 1;
  }
  refreshGestione();
  return { ok: true, data: { linked, failed } };
}

const FIELDS: (keyof PersonFields)[] = ["nickname", "first_name", "last_name", "email", "instagram", "phone", "teamartist_id", "notes"];

function readNewPerson(input: { values?: unknown; aliases?: unknown }) {
  const source = (input?.values && typeof input.values === "object" ? input.values : {}) as Record<string, unknown>;
  const values = Object.fromEntries(FIELDS.map((field) => [field, asText(source[field], field === "notes" ? 5000 : 200)])) as PersonFormValues;
  const aliases = Array.isArray(input?.aliases) ? [...new Set(input.aliases.slice(0, 20).map(readAlias).filter(Boolean))] : [];
  return { values, aliases };
}

/** Prima di salvare: "Esiste già: X — apri" (nickname, altri nomi, nome + cognome, email). */
export async function findExistingPeopleAction(input: { values: PersonFormValues; aliases: string[] }): Promise<ActionResult<ExistingPerson[]>> {
  await requireAdmin();
  const { values, aliases } = readNewPerson(input);
  const [people, allAliases] = await Promise.all([loadPeople(), loadAliases()]);
  return { ok: true, data: existingPeopleFor({ ...values, aliases }, people, allAliases) };
}

/** "+ Nuova persona" (pagina Persone): nessuna iscrizione, pronta per l'abbinamento quando Ale scriverà il suo nome. */
export async function createPersonAction(input: { values: PersonFormValues; aliases: string[] }): Promise<ActionResult<{ id: string }>> {
  const operator = await requireAdmin();
  const { values, aliases } = readNewPerson(input);
  const validation = validatePersonForm(values);
  if (!validation.ok) return { ok: false, error: Object.values(validation.errors)[0] ?? "Controlla i campi." };
  const result = await createPersonWithAliases(operator.id, validation.payload, aliases);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true, data: { id: result.data } };
}
