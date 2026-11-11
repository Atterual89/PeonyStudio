import "server-only";

// Fase C audit anagrafica: pallini della pagina evento calcolati dal registro
// gw_person_sources (migrazioni 050–051), con poche query in blocco e senza
// leggere il Google Sheet live. Attivo solo con GW_LINKED_MEMBERSHIP=1.

import type { EventMembershipRow } from "@/components/gestionale/EventMembershipCheck";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import {
  eventDot,
  linkedMembershipState,
  periodUntilFrom,
  type EventDot,
  type LinkedEvidence,
} from "@/lib/gestionale/linked-membership";
import type { PeonyAttendee, PeonyEvent } from "@/lib/gestionale/server/peony-events";
import type { BookingView } from "@/lib/gestionale/types";

export function isLinkedMembershipEnabled(): boolean {
  return process.env.GW_LINKED_MEMBERSHIP === "1";
}

export type LinkedSourceKind = "iscrizione_workshop" | "biglietto_intestatario" | "biglietto_partner";

export type LinkedSourceInput = {
  /** Chiave scelta dal chiamante (id partecipante, id biglietto…). */
  key: string;
  kind: LinkedSourceKind;
  /** source_ref nel registro: id partecipante, oppure "eventId:ticketId". */
  ref: string;
};

export type LinkedCandidate = {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
};

export type LinkedDot = EventDot & {
  sourceId: string | null;
  personId: string | null;
  /** Persone proposte quando il colore è giallo. */
  candidates: LinkedCandidate[];
  seenName: string | null;
};

type SourceRow = {
  id: string;
  source_kind: string;
  source_ref: string;
  person_id: string | null;
  status: string;
  candidate_ids: string[] | null;
  seen_name: string | null;
  note: string | null;
};

type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  email: string | null;
};

const CHUNK = 200;
const EVIDENCE_KINDS = ["modulo_google", "modulo_cartaceo", "quota_manuale", "quota_email"] as const;

function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

function personName(person: PersonRow): string {
  const full = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return full || person.nickname || person.email || "Persona senza nome";
}

function hasIdentity(person: PersonRow | undefined): boolean {
  if (!person) return false;
  return Boolean(person.email?.trim()) || Boolean(person.first_name?.trim() && person.last_name?.trim());
}

/**
 * Pallino per ogni fonte (iscrizione o biglietto) di un evento.
 * Le fonti senza riga di registro risultano gialle: per i biglietti la pagina
 * evento chiama prima registerEventTickets().
 */
export async function loadLinkedDots(
  sources: readonly LinkedSourceInput[],
  eventDate: string,
): Promise<Map<string, LinkedDot>> {
  await requireAdmin();
  const result = new Map<string, LinkedDot>();
  if (!sources.length) return result;
  const db = getGestionaleDb();

  // Quote "Quota ok" e moduli cartacei scritti senza trigger: una sola query
  // quando non c'è niente di nuovo.
  const pending = await db.rpc("gw_register_pending_member_rows");
  if (pending.error) console.error("Gestionale: registro quote non aggiornato", pending.error.code);

  // 1. Righe di registro delle fonti dell'evento.
  const registry: SourceRow[] = [];
  const kinds = [...new Set(sources.map((s) => s.kind))];
  for (const part of chunks([...new Set(sources.map((s) => s.ref))])) {
    const { data, error } = await db.from("gw_person_sources")
      .select("id,source_kind,source_ref,person_id,status,candidate_ids,seen_name,note")
      .in("source_kind", kinds).in("source_ref", part);
    if (error) throw new Error(`Registro collegamenti: ${error.message}`);
    registry.push(...((data ?? []) as SourceRow[]));
  }
  const bySource = new Map(registry.map((row) => [`${row.source_kind}|${row.source_ref}`, row]));
  const linkedIds = [...new Set(registry
    .filter((row) => row.person_id && (row.status === "automatico" || row.status === "confermato"))
    .map((row) => row.person_id!))];
  const candidateIds = [...new Set(registry.flatMap((row) => row.status === "da_confermare" ? row.candidate_ids ?? [] : []))];

  // 2. Persone collegate e candidate.
  const people = new Map<string, PersonRow>();
  for (const part of chunks([...new Set([...linkedIds, ...candidateIds])])) {
    const { data, error } = await db.from("gw_people")
      .select("id,first_name,last_name,nickname,email")
      .in("id", part).is("deleted_at", null).is("merged_into", null);
    if (error) throw new Error(`Persone: ${error.message}`);
    for (const row of (data ?? []) as PersonRow[]) people.set(row.id, row);
  }

  // 3. Prove associative collegate a quelle persone.
  const evidenceLinks: { person_id: string; source_kind: string; source_ref: string }[] = [];
  for (const part of chunks(linkedIds)) {
    const { data, error } = await db.from("gw_person_sources")
      .select("person_id,source_kind,source_ref")
      .in("person_id", part).in("source_kind", [...EVIDENCE_KINDS]).in("status", ["automatico", "confermato"]);
    if (error) throw new Error(`Prove associative: ${error.message}`);
    evidenceLinks.push(...((data ?? []) as typeof evidenceLinks));
  }
  const memberRefs = evidenceLinks.filter((l) => l.source_kind !== "quota_email").map((l) => l.source_ref);
  const allocationRefs = evidenceLinks.filter((l) => l.source_kind === "quota_email").map((l) => l.source_ref);

  const memberRows = new Map<string, { source: string; membership_status: string | null; membership_starts_at: string | null; membership_expires_at: string | null }>();
  for (const part of chunks(memberRefs)) {
    const { data, error } = await db.from("association_members")
      .select("id,source,membership_status,membership_starts_at,membership_expires_at")
      .in("id", part);
    if (error) throw new Error(`Associazione: ${error.message}`);
    for (const row of data ?? []) memberRows.set(row.id, row);
  }
  const allocations = new Map<string, { period_from: string; confirmed: boolean }>();
  for (const part of chunks(allocationRefs)) {
    const { data, error } = await db.from("gw_association_payment_allocations")
      .select("id,period_from,gw_association_payment_emails(status)")
      .in("id", part);
    if (error) throw new Error(`Quote da email: ${error.message}`);
    for (const row of (data ?? []) as unknown as { id: string; period_from: string; gw_association_payment_emails: { status: string } | { status: string }[] | null }[]) {
      const payment = Array.isArray(row.gw_association_payment_emails) ? row.gw_association_payment_emails[0] : row.gw_association_payment_emails;
      allocations.set(row.id, { period_from: row.period_from, confirmed: payment?.status === "confirmed" });
    }
  }

  const evidenceByPerson = new Map<string, LinkedEvidence[]>();
  for (const link of evidenceLinks) {
    const list = evidenceByPerson.get(link.person_id) ?? [];
    if (link.source_kind === "quota_email") {
      const allocation = allocations.get(link.source_ref);
      if (allocation) list.push({
        kind: "fee", startsAt: allocation.period_from, expiresAt: periodUntilFrom(allocation.period_from),
        verified: allocation.confirmed, method: "payment_email",
      });
    } else {
      const row = memberRows.get(link.source_ref);
      if (!row) continue;
      if (link.source_kind === "quota_manuale") {
        list.push({ kind: "fee", startsAt: row.membership_starts_at, expiresAt: row.membership_expires_at,
          verified: row.membership_status === "verified", method: "manual" });
      } else {
        list.push({ kind: "form" });
      }
    }
    evidenceByPerson.set(link.person_id, list);
  }

  // 4. Un pallino per fonte.
  for (const input of sources) {
    const row = bySource.get(`${input.kind}|${input.ref}`);
    const linked = row && row.person_id && (row.status === "automatico" || row.status === "confermato")
      ? people.get(row.person_id) : undefined;
    const link = !row ? "assente" : linked ? "collegata" : "da_confermare";
    const dot = eventDot({
      link,
      note: row?.note ?? null,
      hasIdentity: hasIdentity(linked),
      state: linked ? linkedMembershipState(evidenceByPerson.get(linked.id) ?? [], eventDate) : null,
      eventDate,
    });
    result.set(input.key, {
      ...dot,
      sourceId: row?.id ?? null,
      personId: linked?.id ?? null,
      seenName: row?.seen_name ?? null,
      candidates: link === "collegata" ? [] : (row?.candidate_ids ?? [])
        .map((id) => people.get(id)).filter((p): p is PersonRow => Boolean(p))
        .map((p) => ({ id: p.id, name: personName(p), nickname: p.nickname, email: p.email })),
    });
  }
  return result;
}

/** Registra nel registro i biglietti di un evento che non hanno ancora una riga. */
export async function registerEventTickets(ticketTailorEventId: string): Promise<void> {
  await requireAdmin();
  const { error } = await getGestionaleDb().rpc("gw_register_ticket_sources", { p_ticket_tailor_event_id: ticketTailorEventId });
  if (error) console.error("Gestionale: biglietti non registrati", error.code);
}

/** Dopo una sincronizzazione Ticket Tailor: biglietti, quote nuove, contatti di Ale. */
export async function refreshPersonSources(): Promise<void> {
  await requireAdmin();
  const { error } = await getGestionaleDb().rpc("gw_refresh_person_sources");
  if (error) console.error("Gestionale: registro collegamenti non aggiornato", error.code);
}

/**
 * Pallini dei biglietti di un evento Peony. Se qualche biglietto non è ancora
 * nel registro (evento sincronizzato prima della 051), lo registra e rilegge.
 */
export async function loadEventTicketDots(
  ticketTailorEventId: string,
  sources: readonly LinkedSourceInput[],
  eventDate: string,
): Promise<Map<string, LinkedDot>> {
  const dots = await loadLinkedDots(sources, eventDate);
  const missing = sources.some((s) => s.kind === "biglietto_intestatario" && dots.get(s.key)?.sourceId === null);
  if (!missing) return dots;
  await registerEventTickets(ticketTailorEventId);
  return loadLinkedDots(sources, eventDate);
}

// ---------------------------------------------------------------------------
// Righe per la sezione "Verifica soci" delle due pagine evento
// ---------------------------------------------------------------------------


function toRow(base: Omit<EventMembershipRow, "color" | "reason" | "candidates">, dot: LinkedDot | undefined): EventMembershipRow {
  return {
    ...base,
    color: dot?.color ?? "giallo",
    reason: dot?.reason ?? "Da chiarire: non ancora collegata a una persona",
    candidates: dot?.candidates ?? [],
  };
}

/** Workshop KL di Ale: un rigo per partecipante delle iscrizioni non cancellate. */
export async function workshopMembershipRows(bookings: readonly BookingView[], startsOn: string): Promise<EventMembershipRow[]> {
  const people = bookings
    .filter((booking) => booking.status !== "cancellato")
    .flatMap((booking) => booking.people.map((person) => ({ booking, person })));
  const dots = await loadLinkedDots(
    people.map(({ person }) => ({ key: person.participantId, kind: "iscrizione_workshop" as const, ref: person.participantId })),
    startsOn,
  );
  return people.map(({ booking, person }) => toRow({
    key: person.participantId,
    name: person.displayName,
    caption: booking.status === "lista_attesa" ? "lista d'attesa" : null,
    email: person.person.email,
    target: { kind: "iscrizione", bookingId: booking.bookingId, participantId: person.participantId },
  }, dots.get(person.participantId)));
}

/** Evento Peony: intestatario e (se indicato) partner di ogni biglietto che richiede l'associazione. */
export async function peonyMembershipRows(event: PeonyEvent, attendees: readonly PeonyAttendee[]): Promise<EventMembershipRow[]> {
  const relevant = attendees.filter((attendee) => attendee.associationRequired);
  const sources: LinkedSourceInput[] = [];
  for (const attendee of relevant) {
    const ref = `${event.id}:${attendee.ticketId}`;
    sources.push({ key: `h:${attendee.ticketId}`, kind: "biglietto_intestatario", ref });
    if (attendee.partner) sources.push({ key: `p:${attendee.ticketId}`, kind: "biglietto_partner", ref });
  }
  const dots = await loadEventTicketDots(event.ticketTailorEventId, sources, event.startsOn ?? "");
  const rows: EventMembershipRow[] = [];
  for (const attendee of relevant) {
    rows.push(toRow({
      key: `h:${attendee.ticketId}`,
      name: attendee.name,
      caption: attendee.ticketType,
      email: attendee.profileEmail ?? attendee.email,
      target: { kind: "biglietto", eventId: event.id, ticketId: attendee.ticketId, role: "intestatario" },
    }, dots.get(`h:${attendee.ticketId}`)));
    if (attendee.partner) {
      rows.push(toRow({
        key: `p:${attendee.ticketId}`,
        name: attendee.partner.name ?? attendee.partner.enteredName ?? "Partner",
        caption: `partner di ${attendee.name}`,
        email: attendee.partner.profileEmail ?? attendee.partner.email,
        target: { kind: "biglietto", eventId: event.id, ticketId: attendee.ticketId, role: "partner" },
      }, dots.get(`p:${attendee.ticketId}`)));
    }
  }
  return rows;
}
