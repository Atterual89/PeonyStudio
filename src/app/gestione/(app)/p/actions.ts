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

/** Proposte non vincolanti dalle fonti gia' salvate. Nessun abbinamento automatico. */
export async function suggestPersonEmailsAction(personId: string): Promise<
  { ok: true; suggestions: { email: string; source: string; identity: string; exactName: boolean }[] } |
  { ok: false; error: string }
> {
  await requireAdmin();
  if (!isUuidLike(personId)) return { ok: false, error: "Persona non valida." };
  const person = await getPerson(personId);
  if (!person || person.deleted_at || person.merged_into) return { ok: false, error: "Persona non trovata." };
  const { getGestionaleDb } = await import("@/lib/gestionale/server/db");
  const db = getGestionaleDb();
  const tokens = [person.last_name, person.first_name, person.nickname]
    .map(v => (v ?? "").trim()).filter(v => v.length >= 3);
  const surname = person.last_name?.trim().toLowerCase() ?? "";
  const first = person.first_name?.trim().toLowerCase() ?? "";
  const found = new Map<string, { email: string; source: string; identity: string; exactName: boolean }>();
  function offer(email: string | null | undefined, source: string, identity: string, exactName: boolean) {
    const clean = (email ?? "").trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(clean)) return;
    const key = clean;
    const prior = found.get(key);
    if (!prior || (!prior.exactName && exactName)) found.set(key, { email: clean, source, identity, exactName });
  }
  const { data: entries } = await db.from("gw_booking_participants")
    .select("entered_email,entered_as").eq("person_id", person.id)
    .is("deleted_at", null).limit(200);
  for (const row of entries ?? []) offer(row.entered_email, "Iscrizione workshop", row.entered_as || "Partecipante", true);
  if (tokens.length) {
    const terms = tokens.slice(0, 3);
    for (const token of terms) {
      const safe = token.replace(/[%_,]/g, "");
      if (safe.length < 3) continue;
      const { data: forms } = await db.from("association_members")
        .select("first_name,last_name,email,source")
        .eq("source", "google_sheet")
        .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`)
        .not("email", "is", null).limit(30);
      for (const row of forms ?? []) {
        const name = [row.first_name,row.last_name].filter(Boolean).join(" ");
        const text = name.toLowerCase();
        const exact = Boolean(first && surname && text.includes(first) && text.includes(surname));
        offer(row.email, "Modulo Google", name || "Nominativo non disponibile", exact);
      }
      const { data: known } = await db.from("gw_people")
        .select("id,first_name,last_name,nickname,email")
        .neq("id",person.id).is("deleted_at",null).is("merged_into",null)
        .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,nickname.ilike.%${safe}%`)
        .not("email","is",null).limit(30);
      for (const row of known ?? []) {
        const name = [row.first_name,row.last_name].filter(Boolean).join(" ") || row.nickname || "Altra scheda";
        const exact = Boolean(first && surname && row.first_name?.trim().toLowerCase() === first && row.last_name?.trim().toLowerCase() === surname);
        offer(row.email, "Altra anagrafica", name, exact);
      }
    }
  }
  return { ok: true, suggestions: [...found.values()].sort((a,b) => Number(b.exactName)-Number(a.exactName)).slice(0,12) };
}
