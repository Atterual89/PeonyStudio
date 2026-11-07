"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";

import { uniqueExactMatches, type ExactMatch } from "@/lib/gestionale/exact-matches";
import { displayName, fullName, normalizeText } from "@/lib/gestionale/format";
import { ADMIN_BOOKING_STATUSES, HOMONYMS_WARNING } from "@/lib/gestionale/labels";
import { personFieldsFromFreeText, searchPeople } from "@/lib/gestionale/people";
import { parsePersonChoice, type PersonChoice } from "@/lib/gestionale/person-choice";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadAliases } from "@/lib/gestionale/server/aliases";
import { getEnrolledPersonIds, getPerson, getWorkshopBookings, getWorkshopView, loadPeople } from "@/lib/gestionale/server/data";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { parseMemberKey } from "@/lib/gestionale/member-key";
import { findMemberLinkProposals } from "@/lib/gestionale/server/member-links";
import { getMemberBadge, getMemberLink, getMembershipBadges, searchMembers } from "@/lib/gestionale/server/membership";
import {
  confirmMatch,
  createBooking,
  rejectMatch,
  resolveMatch,
  resolveMatchMembership,
  setMembershipLink,
  setPartner,
  updateBookingNotes,
  updatePerson,
  updateWorkshopSettings,
  type BookingPersonInput,
  type ResolveAction,
 , setMembershipNameLink } } from "@/lib/gestionale/server/mutations";
import type { ActionResult, BookingStatus, MemberSummary, MembershipBadge, Person, PersonFields } from "@/lib/gestionale/types";
import { asText, isIsoDate, isUuidLike, isVersion } from "@/lib/gestionale/validation";
import { todayInRome, validateWorkshopSettings, type WorkshopSettingsValues } from "@/lib/gestionale/workshops";

// D18: tutte le azioni di questo file sono riservate agli admin (requireAdmin:
// all'organizzatrice rispondono 404). 3b: gli admin aggiungono iscrizioni e
// partner con la ricerca, ma SENZA parte economica: solo stati non economici
// in creazione, quota standard automatica, nessun cambio di stato o quota.
// Stato, quote e pagamenti li gestisce l'organizzatrice
// (registration-actions.ts, che rifiuta gli admin).

function isAdminBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && (ADMIN_BOOKING_STATUSES as readonly string[]).includes(value);
}

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };

function personFieldsOf(person: Person): PersonFields {
  const { first_name, last_name, nickname, email, instagram, phone, teamartist_id, notes } = person;
  return { first_name, last_name, nickname, email, instagram, phone, teamartist_id, notes };
}

// ---------------------------------------------------------------------------
// Workshop: solo impostazioni (D14). Nome e date vengono dall'evento.
// ---------------------------------------------------------------------------

export async function updateWorkshopSettingsAction(input: {
  id: string;
  version: number;
  values: WorkshopSettingsValues;
}): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.id) || !isVersion(input.version)) return INVALID;

  const values = input.values ?? ({} as WorkshopSettingsValues);
  const validation = validateWorkshopSettings({
    description: asText(values.description),
    capacity: asText(values.capacity, 6),
    default_fee: asText(values.default_fee, 12),
    peony_pct: asText(values.peony_pct, 6),
  });
  if (!validation.ok) return { ok: false, error: Object.values(validation.errors)[0] ?? "Controlla i campi." };

  const result = await updateWorkshopSettings(operator.id, input.id, input.version, validation.payload);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/** "Copia impostazioni da un workshop precedente": capienza, quota standard, percentuale. */
export async function copyWorkshopSettingsAction(input: {
  id: string;
  version: number;
  sourceId: string;
}): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.id) || !isVersion(input.version) || !isUuidLike(input.sourceId) || input.id === input.sourceId) {
    return INVALID;
  }

  const [target, source, bookings] = await Promise.all([
    getWorkshopView(input.id),
    getWorkshopView(input.sourceId),
    getGestionaleDb().from("gw_bookings").select("id", { count: "exact", head: true }).eq("workshop_id", input.id).is("deleted_at", null),
  ]);
  if (!target || !source) return { ok: false, error: "Workshop non trovato. Ricarica la pagina." };
  if (bookings.error) return { ok: false, error: "Controllo delle iscrizioni non riuscito. Riprova." };
  if ((bookings.count ?? 0) > 0) {
    return { ok: false, error: "Il workshop ha già iscrizioni: modifica le impostazioni a mano." };
  }

  const result = await updateWorkshopSettings(operator.id, target.id, input.version, {
    description: target.description,
    capacity: source.capacity,
    default_fee_cents: source.default_fee_cents,
    peony_pct: source.peony_pct,
  });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ricerca
// ---------------------------------------------------------------------------

/** Persona proposta nelle corrispondenze dell'abbinamento. */
export type QuickSearchPerson = {
  id: string;
  displayName: string;
  detail: string;
  enrolled: boolean;
  badge: MembershipBadge;
};

export type QuickSearchMember = MemberSummary & { badge: MembershipBadge };

export async function quickSearchAction(input: {
  workshopId: string;
  query: string;
}): Promise<ActionResult<{ people: QuickSearchPerson[]; members: QuickSearchMember[] }>> {
  await requireAdmin();
  if (!isUuidLike(input?.workshopId)) return INVALID;

  const query = asText(input.query, 100).trim();
  if (query.length < 2) return { ok: true, data: { people: [], members: [] } };

  try {
    const [workshop, people, enrolled, members] = await Promise.all([
      getWorkshopView(input.workshopId),
      loadPeople(),
      getEnrolledPersonIds(input.workshopId),
      searchMembers(query),
    ]);
    if (!workshop) return INVALID;

    const found = searchPeople(people, query, 10);
    const [badges, memberBadges] = await Promise.all([
      getMembershipBadges(found, workshop.startsOn),
      Promise.all(members.map((member) => getMemberBadge(member.id, workshop.startsOn))),
    ]);

    return {
      ok: true,
      data: {
        people: found.map((person) => ({
          id: person.id,
          displayName: displayName(person),
          detail: [person.nickname ? [person.first_name, person.last_name].filter(Boolean).join(" ") : null, person.email]
            .filter(Boolean)
            .join(" · "),
          enrolled: enrolled.has(person.id),
          badge: badges.get(person.id) ?? { kind: "non_collegata" },
        })),
        members: members.map((member, index) => ({ ...member, badge: memberBadges[index] })),
      },
    };
  } catch (error) {
    console.error("Gestionale ricerca:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Ricerca non riuscita. Riprova." };
  }
}

/**
 * Ricerca nel libro soci per collegare una persona esistente: una voce per
 * socio, con lo stato tessera che risulterebbe alla data indicata (inizio del
 * workshop, o oggi nella scheda persona).
 */
export async function memberSearchAction(query: string, referenceDate?: string): Promise<ActionResult<MemberSummary[]>> {
  await requireAdmin();
  const text = asText(query, 100).trim();
  if (referenceDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(asText(referenceDate, 10))) return INVALID;
  if (text.length < 2) return { ok: true, data: [] };
  try {
    return { ok: true, data: await searchMembers(text, 8, referenceDate) };
  } catch (error) {
    console.error("Gestionale libro soci:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Ricerca nel libro soci non riuscita. Riprova." };
  }
}

// ---------------------------------------------------------------------------
// Prenotazioni
// ---------------------------------------------------------------------------

/** Trasforma la scelta del browser in input per gw_create_booking / gw_set_partner. */
async function toBookingPerson(choice: PersonChoice): Promise<BookingPersonInput | null> {
  if (choice.kind === "existing") return { person_id: choice.id };
  if (choice.kind === "new") return { new: personFieldsFromFreeText(choice.text) };

  // Dal libro soci si copiano solo nome, cognome ed email (contesto 4.3).
  // D11 (016): id solo per le validazioni manuali, altrimenti l'email (chiave admin).
  const link = await getMemberLink(choice.memberId);
  if (!link) return null;
  return {
    new: {
      first_name: link.firstName,
      last_name: link.lastName,
      email: link.email,
      association_member_id: link.memberId,
      membership_email: link.email,
    },
  };
}

/**
 * Aggiunta rapida degli admin (D15, 3b): la prima persona è il principale, il
 * partner secondario. Solo stati non economici (Interessato, Prenotato a
 * parola, Lista d'attesa); la quota è sempre quella standard del workshop
 * (gw_create_booking); entered_as = nickname o nome (migrazione 013).
 */
export async function addBookingAction(input: {
  workshopId: string;
  person: unknown;
  partner: unknown;
  status: string;
  notes: string;
}): Promise<ActionResult> {
  const operator = await requireAdmin();

  const person = parsePersonChoice(input?.person);
  const partner = input?.partner ? parsePersonChoice(input.partner) : null;
  if (!isUuidLike(input?.workshopId) || !person || (input.partner && !partner) || !isAdminBookingStatus(input.status)) {
    return INVALID;
  }

  const people = await Promise.all([person, partner].filter((c): c is PersonChoice => Boolean(c)).map(toBookingPerson));
  if (people.some((p) => p === null)) {
    return { ok: false, error: "Socio non trovato nel libro soci. Ricarica e riprova." };
  }

  const result = await createBooking(operator.id, {
    workshopId: input.workshopId,
    people: people as BookingPersonInput[],
    status: input.status,
    notes: asText(input.notes).trim() || null,
  });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/** Aggiunge il partner (removeParticipantId null) o sostituisce il partner secondario. */
export async function setPartnerAction(input: {
  bookingId: string;
  version: number;
  removeParticipantId: string | null;
  person: unknown;
}): Promise<ActionResult> {
  const operator = await requireAdmin();
  const choice = input?.person ? parsePersonChoice(input.person) : null;
  if (
    !isUuidLike(input?.bookingId) ||
    !isVersion(input.version) ||
    (input.removeParticipantId !== null && !isUuidLike(input.removeParticipantId)) ||
    (input.person && !choice)
  ) {
    return INVALID;
  }

  const addPerson = choice ? await toBookingPerson(choice) : null;
  if (choice && !addPerson) return { ok: false, error: "Socio non trovato nel libro soci. Ricarica e riprova." };

  const result = await setPartner(operator.id, {
    bookingId: input.bookingId,
    version: input.version,
    removeParticipantId: input.removeParticipantId,
    addPerson,
  });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/**
 * Admin: le note della prenotazione. Stato e quota restano in sola lettura:
 * li aggiornano l'organizzatrice e i pagamenti (3b).
 */
export async function updateBookingNotesAction(input: {
  bookingId: string;
  version: number;
  notes: string;
}): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.bookingId) || !isVersion(input.version)) return INVALID;

  const result = await updateBookingNotes(operator.id, {
    bookingId: input.bookingId,
    version: input.version,
    notes: asText(input.notes).trim() || null,
  });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/** Collega (o scollega, memberId null) una persona a un socio del libro soci. Senza refresh: lo fa chi chiama. */
async function linkPersonToMember(operatorId: string, personId: string, version: number, memberId: string | null): Promise<ActionResult<unknown>> {
  const link = memberId ? await getMemberLink(memberId) : null;
  if (memberId && !link) return { ok: false, error: "Socio non trovato nel libro soci." };

  if (link && !link.memberId && !link.email) {
    const person=await getPerson(personId);
    if(!person||person.merged_into||!link.firstName||!link.lastName)return INVALID;
    const key=parseMemberKey(memberId);
    if(!key||key.kind!=="name")return INVALID;
    // Nome senza email: non limitarsi a riscrivere il nominativo.
    // Salva un vero riferimento nominale, univoco e con audit.
    return setMembershipNameLink(operatorId,personId,version,key.nameKey);
  }
  if (!link) {
    const person=await getPerson(personId);
    if(person?.membership_name_key){
      return setMembershipNameLink(operatorId,personId,version,null);
    }
  }
  return setMembershipLink(operatorId, personId, version, link);
}

/**
 * "Cerca nel libro soci": memberId = chiave del socio (member-key.ts); null =
 * scollega. `referenceDate` (inizio del workshop o oggi): se dopo il
 * collegamento lo stato resta "Non collegata", `warning` lo spiega (#11).
 */
export async function linkMemberAction(input: {
  personId: string;
  version: number;
  memberId: string | null;
  referenceDate?: string;
}): Promise<ActionResult<{ warning: string | null }>> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.personId) || !isVersion(input.version)) return INVALID;
  if (input.memberId !== null && !parseMemberKey(input.memberId)) return INVALID;
  if (input.referenceDate !== undefined && !isIsoDate(input.referenceDate)) return INVALID;

  const result = await linkPersonToMember(operator.id, input.personId, input.version, input.memberId);
  if (!result.ok) return result;
  refreshGestione();

  let warning: string | null = null;
  const person = input.memberId ? await getPerson(input.personId) : null;
  if (person) {
    const badge = (await getMembershipBadges([person], input.referenceDate ?? todayInRome())).get(person.id);
    if (badge?.kind === "non_collegata") warning = HOMONYMS_WARNING;
  }
  return { ok: true, data: { warning } };
}

/** Corrispondenze esatte e uniche col libro soci delle persone non collegate del workshop (#10). */
async function findExactMatches(workshopId: unknown): Promise<ExactMatch[] | null> {
  if (!isUuidLike(workshopId)) return null;
  const workshop = await getWorkshopView(workshopId);
  if (!workshop) return null;
  const entries = new Map(
    (await getWorkshopBookings(workshop))
      .flatMap((booking) => booking.people)
      .filter((entry) => entry.membership.kind === "non_collegata" && !entry.person.merged_into)
      .map((entry) => [entry.person.id, entry]),
  );
  const candidates = [];
  for (const entry of entries.values()) {
    const { person } = entry;
    const queries = [person.email, fullName(person)].map((query) => query?.trim()).filter((query): query is string => Boolean(query && query.length >= 2));
    const members = new Map<string, MemberSummary>();
    for (const query of new Set(queries)) for (const member of await searchMembers(query, 5)) members.set(member.id, member);
    candidates.push({ person, personName: entry.fullName ?? entry.displayName, members: [...members.values()] });
  }
  return uniqueExactMatches(candidates);
}

/** 4e (#10): "Collega le corrispondenze esatte (N)" → elenco di controllo. */
export async function exactMatchesAction(input: { workshopId: string }): Promise<ActionResult<ExactMatch[]>> {
  await requireAdmin();
  try {
    const matches = await findExactMatches(input?.workshopId);
    return matches ? { ok: true, data: matches } : INVALID;
  } catch (error) {
    console.error("Gestionale corrispondenze esatte:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Ricerca nel libro soci non riuscita. Riprova." };
  }
}

/**
 * 4e (#10): conferma dell'elenco. Le corrispondenze si ricalcolano qui: si
 * collegano solo le persone spuntate che hanno ancora lo stesso socio esatto.
 */
export async function linkExactMatchesAction(input: {
  workshopId: string;
  picks: { personId: string; memberId: string }[];
}): Promise<ActionResult<{ linked: number; failed: number }>> {
  const operator = await requireAdmin();
  if (!Array.isArray(input?.picks) || input.picks.length === 0 || input.picks.length > 300) return INVALID;
  if (!input.picks.every((pick) => isUuidLike(pick?.personId) && typeof pick.memberId === "string" && parseMemberKey(pick.memberId))) return INVALID;
  const matches = await findExactMatches(input.workshopId);
  if (!matches) return INVALID;

  const wanted = new Map(input.picks.map((pick) => [pick.personId, pick.memberId]));
  let linked = 0;
  let failed = 0;
  for (const match of matches) {
    if (wanted.get(match.personId) !== match.memberId) continue;
    const result = await linkPersonToMember(operator.id, match.personId, match.version, match.memberId);
    if (result.ok) linked += 1;
    else failed += 1;
  }
  failed += input.picks.length - linked - failed;
  refreshGestione();
  return { ok: true, data: { linked, failed } };
}

/**
 * Fase 5 (/gestione/altro/soci): "Conferma selezionati". Le proposte si
 * ricalcolano qui: si collegano solo le persone scelte che hanno ancora lo
 * stesso socio proposto (scrive solo il collegamento della persona, con storico).
 */
export async function linkMemberProposalsAction(input: {
  picks: { personId: string; memberId: string }[];
}): Promise<ActionResult<{ linked: number; failed: number }>> {
  const operator = await requireAdmin();
  if (!Array.isArray(input?.picks) || input.picks.length === 0 || input.picks.length > 1000) return INVALID;
  if (!input.picks.every((pick) => isUuidLike(pick?.personId) && typeof pick.memberId === "string" && parseMemberKey(pick.memberId))) return INVALID;

  let proposals;
  try {
    ({ proposals } = await findMemberLinkProposals());
  } catch (error) {
    console.error("Gestionale proposte libro soci:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Lettura del libro soci non riuscita. Riprova." };
  }
  const wanted = new Map(input.picks.map((pick) => [pick.personId, pick.memberId]));
  let linked = 0;
  let failed = 0;
  for (const proposal of proposals) {
    if (wanted.get(proposal.personId) !== proposal.memberId) continue;
    const result = await linkPersonToMember(operator.id, proposal.personId, proposal.version, proposal.memberId);
    if (result.ok) linked += 1;
    else failed += 1;
  }
  failed += input.picks.length - linked - failed;
  refreshGestione();
  return { ok: true, data: { linked, failed } };
}

// ---------------------------------------------------------------------------
// D20 — Abbinamento automatico (tab Partecipanti, solo admin)
// ---------------------------------------------------------------------------

type ParticipantInput = { bookingId: string; version: number; participantId: string };

function isParticipantInput(input: ParticipantInput | undefined): input is ParticipantInput {
  return isUuidLike(input?.bookingId) && isVersion(input.version) && isUuidLike(input.participantId);
}

export async function confirmMatchAction(input: ParticipantInput): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isParticipantInput(input)) return INVALID;
  const result = await confirmMatch(operator.id, input);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

export async function rejectMatchAction(input: ParticipantInput): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isParticipantInput(input)) return INVALID;
  const result = await rejectMatch(operator.id, input);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

const RESOLVE_ACTIONS: readonly ResolveAction[] = ["crea_nuova", "collega", "collega_socio", "unisci"];

export async function resolveMatchAction(
  input: ParticipantInput & { action: string; targetId: string | null },
): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isParticipantInput(input) || !RESOLVE_ACTIONS.includes(input.action as ResolveAction)) return INVALID;
  const action = input.action as ResolveAction;

  if (action === "collega_socio") {
    // D11 (016): targetId = chiave del socio delle fonti admin.
    if (!parseMemberKey(input.targetId)) return INVALID;
    const link = await getMemberLink(input.targetId!);
    if (!link) return { ok: false, error: "Socio non trovato nel libro soci." };
    const linked = await resolveMatchMembership(operator.id, input, link);
    if (!linked.ok) return linked;
    refreshGestione();
    return { ok: true };
  }

  if (action === "crea_nuova" ? input.targetId !== null : !isUuidLike(input.targetId)) return INVALID;
  const result = await resolveMatch(operator.id, input, action, input.targetId);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

export type MatchSuggestions = {
  people: (QuickSearchPerson & { exact: boolean })[];
  members: (MemberSummary & { exact: boolean })[];
};

/** Corrispondenze proposte per una riga "da abbinare": esatte e parziali, gestionale e libro soci. */
export async function matchSuggestionsAction(input: {
  workshopId: string;
  text: string;
  excludePersonId: string;
}): Promise<ActionResult<MatchSuggestions>> {
  await requireAdmin();
  const text = asText(input?.text, 200).trim();
  if (!isUuidLike(input?.workshopId) || !isUuidLike(input.excludePersonId) || !text) return INVALID;

  try {
    const [workshop, people, enrolled, aliases] = await Promise.all([
      getWorkshopView(input.workshopId),
      loadPeople(),
      getEnrolledPersonIds(input.workshopId),
      loadAliases(),
    ]);
    if (!workshop) return INVALID;

    // 4d (B2): chi ha questo testo tra gli altri nomi è una corrispondenza esatta.
    const byAlias = new Set(aliases.filter((alias) => normalizeText(alias.alias) === normalizeText(text)).map((alias) => alias.personId));

    // Parziali: tutto il testo, poi ogni parola di almeno 3 lettere.
    const queries = [text, ...text.split(/[\s@.]+/).filter((word) => word.length >= 3)];
    const found = new Map<string, (typeof people)[number]>();
    for (const person of people) {
      if (byAlias.has(person.id) && person.id !== input.excludePersonId && !person.merged_into) found.set(person.id, person);
    }
    for (const query of queries) {
      for (const person of searchPeople(people, query, 8)) {
        if (person.id !== input.excludePersonId) found.set(person.id, person);
      }
    }
    const memberMap = new Map<string, MemberSummary>();
    for (const query of queries) {
      for (const member of await searchMembers(query, 5)) memberMap.set(member.id, member);
    }

    const normalized = normalizeText(text);
    const candidates = [...found.values()].slice(0, 10);
    const badges = await getMembershipBadges(candidates, workshop.startsOn);
    const isExactPerson = (person: (typeof people)[number]) =>
      byAlias.has(person.id) ||
      normalizeText(person.email) === normalized ||
      normalizeText(person.nickname) === normalized ||
      normalizeText([person.first_name, person.last_name].filter(Boolean).join(" ")) === normalized;

    return {
      ok: true,
      data: {
        people: candidates
          .map((person) => ({
            id: person.id,
            displayName: displayName(person),
            detail: [person.nickname ? [person.first_name, person.last_name].filter(Boolean).join(" ") : null, person.email]
              .filter(Boolean)
              .join(" · "),
            enrolled: enrolled.has(person.id),
            badge: badges.get(person.id) ?? { kind: "non_collegata" as const },
            exact: isExactPerson(person),
          }))
          .sort((a, b) => Number(b.exact) - Number(a.exact)),
        members: [...memberMap.values()]
          .slice(0, 6)
          .map((member) => ({
            ...member,
            exact:
              normalizeText(member.email) === normalized ||
              normalizeText([member.first_name, member.last_name].filter(Boolean).join(" ")) === normalized,
          }))
          .sort((a, b) => Number(b.exact) - Number(a.exact)),
      },
    };
  } catch (error) {
    console.error("Gestionale corrispondenze:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Ricerca delle corrispondenze non riuscita. Riprova." };
  }
}

// ---------------------------------------------------------------------------
// 4d (B2): email scritta da Ale diversa da quella della scheda
// ---------------------------------------------------------------------------

/** "Ale ha indicato: x@y — usa questa": l'email della scheda diventa quella scritta da Ale. */
export async function applyEnteredEmailAction(input: { participantId: string }): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.participantId)) return INVALID;
  const { data, error } = await getGestionaleDb()
    .from("gw_booking_participants")
    .select("person_id, entered_email")
    .eq("id", input.participantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data?.entered_email) return INVALID;
  const person = await getPerson(data.person_id as string);
  if (!person || person.merged_into) return INVALID;
  const result = await updatePerson(operator.id, person.id, person.version, { ...personFieldsOf(person), email: data.entered_email as string });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}
