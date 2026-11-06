"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";

import { memberKeyOfPerson, parseMemberKey } from "@/lib/gestionale/member-key";
import { memberFill } from "@/lib/gestionale/member-name";
import { validatePersonForm, type MemberField, type PersonFormValues } from "@/lib/gestionale/people";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson } from "@/lib/gestionale/server/data";
import { listCompletablePeople } from "@/lib/gestionale/server/member-fill";
import { getLinkedMemberSummary } from "@/lib/gestionale/server/membership";
import { fillPersonFromMember, mergePeople, setMembershipLink, updatePerson } from "@/lib/gestionale/server/mutations";
import type { ActionResult, PersonFields } from "@/lib/gestionale/types";
import { asText, isUuidLike, isVersion } from "@/lib/gestionale/validation";

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };

const FIELDS: (keyof PersonFields)[] = [
  "nickname",
  "first_name",
  "last_name",
  "email",
  "instagram",
  "phone",
  "teamartist_id",
  "notes",
];

function readValues(values: unknown): PersonFormValues {
  const source = (values && typeof values === "object" ? values : {}) as Record<string, unknown>;
  return Object.fromEntries(
    FIELDS.map((field) => [field, asText(source[field], field === "notes" ? 5000 : 200)]),
  ) as PersonFormValues;
}

export async function updatePersonAction(input: {
  id: string;
  version: number;
  values: PersonFormValues;
}): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.id) || !isVersion(input.version)) return INVALID;

  const validation = validatePersonForm(readValues(input.values));
  if (!validation.ok) return { ok: false, error: Object.values(validation.errors)[0] ?? "Controlla i campi." };

  const result = await updatePerson(operator.id, input.id, input.version, validation.payload);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

export async function mergePeopleAction(input: {
  primary: { id: string; version: number };
  secondary: { id: string; version: number };
  values: PersonFormValues;
  /** Collegamento al libro soci da tenere: chiave del socio (member-key.ts) o null. */
  memberKey: string | null;
}): Promise<ActionResult> {
  const operator = await requireAdmin();
  const { primary, secondary } = input ?? {};
  if (
    !isUuidLike(primary?.id) ||
    !isVersion(primary.version) ||
    !isUuidLike(secondary?.id) ||
    !isVersion(secondary.version) ||
    (input.memberKey !== null && parseMemberKey(input.memberKey)?.kind !== "manual" && parseMemberKey(input.memberKey)?.kind !== "email")
  ) {
    return INVALID;
  }
  const key = input.memberKey ? parseMemberKey(input.memberKey) : null;

  const validation = validatePersonForm(readValues(input.values));
  if (!validation.ok) return { ok: false, error: Object.values(validation.errors)[0] ?? "Controlla i campi." };

  const before = await getPerson(primary.id);
  if (!before) return INVALID;

  const result = await mergePeople(operator.id, primary, secondary, {
    ...validation.payload,
    association_member_id: key?.kind === "manual" ? key.id : null,
  });
  if (!result.ok) return result;

  // D11 (016): il collegamento per email non passa da gw_merge_people; se si
  // tiene quello della secondaria (o nessuno), si aggiorna subito dopo.
  const primaryEmailKey = memberKeyOfPerson({ association_member_id: null, membership_email: before.membership_email });
  if (key?.kind !== "manual" && primaryEmailKey !== (input.memberKey ?? null)) {
    const link = key?.kind === "email" ? { memberId: null, email: key.email, firstName: null, lastName: null } : null;
    const linked = await setMembershipLink(operator.id, primary.id, result.data, link);
    if (!linked.ok) return linked;
  }
  refreshGestione();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Completa con i dati del libro soci (D11). I valori del socio si leggono qui
// dalle fonti admin; il browser manda solo quale persona (e quale campo).
// ---------------------------------------------------------------------------

/** "Completa con i dati del libro soci": solo i campi vuoti, con storico. */
export async function completeFromMemberAction(input: { personId: string }): Promise<ActionResult<{ filled: boolean }>> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.personId)) return INVALID;
  const person = await getPerson(input.personId);
  if (!person || person.merged_into) return INVALID;

  const fill = memberFill(person, await getLinkedMemberSummary(person));
  if (Object.keys(fill).length === 0) return { ok: true, data: { filled: false } };
  const result = await fillPersonFromMember(operator.id, person.id, fill);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true, data: { filled: result.data } };
}

/** "Nel libro soci: X — usa questo" fuori dal modulo: sostituisce quel campo con il valore del socio. */
export async function applyMemberValueAction(input: {
  personId: string;
  version: number;
  field: MemberField;
}): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.personId) || !isVersion(input.version) || !["first_name", "last_name", "email"].includes(input.field)) {
    return INVALID;
  }
  const person = await getPerson(input.personId);
  const member = person ? await getLinkedMemberSummary(person) : null;
  const value = member?.[input.field]?.trim();
  if (!person || !member || !value || (input.field !== "email" && !member.name_split)) return INVALID;

  const fields = Object.fromEntries(FIELDS.map((field) => [field, person[field]])) as PersonFields;
  fields[input.field] = input.field === "email" ? value.toLowerCase() : value;
  const result = await updatePerson(operator.id, person.id, input.version, fields);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/** "Completa i dati dal libro soci (N persone)": come sopra, per tutte; una transazione per persona. */
export async function completeAllFromMemberAction(): Promise<ActionResult<{ updated: number; failed: number }>> {
  const operator = await requireAdmin();
  let updated = 0;
  let failed = 0;
  for (const { person, fill } of await listCompletablePeople()) {
    const result = await fillPersonFromMember(operator.id, person.id, fill);
    if (!result.ok) failed += 1;
    else if (result.data) updated += 1;
  }
  refreshGestione();
  return { ok: true, data: { updated, failed } };
}
