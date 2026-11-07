import "server-only";

import { cache } from "react";

import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { displayName } from "@/lib/gestionale/format";
import { memberKeyOfPerson } from "@/lib/gestionale/member-key";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadEconomicOverview } from "@/lib/gestionale/server/accounts";
import { getMembershipContacts } from "@/lib/gestionale/server/contacts";
import { getLuxuriaEvent, loadLuxuriaEvents } from "@/lib/gestionale/server/events";
import { getMemberSummary, getMembershipBadges } from "@/lib/gestionale/server/membership";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { sortPayments, toPayment, type PaymentRecord } from "@/lib/gestionale/server/registrations";
import type {
  BookingStatus,
  BookingView,
  MatchStatus,
  MemberSummary,
  MembershipContact,
  OperatorRole,
  Person,
  Workshop,
  WorkshopView,
} from "@/lib/gestionale/types";
import { isUuidLike } from "@/lib/gestionale/validation";
import { buildDashboard, countBookings, toWorkshopView, type DashboardEntry } from "@/lib/gestionale/workshops";

// Letture del gestionale (service role). Le scritture passano dalle funzioni
// gw_* in server/mutations.ts. Le righe eliminate (deleted_at, D22) non si
// leggono mai.
//
// D18: i loader dell'anagrafica e delle iscrizioni con le persone sono
// riservati agli admin e chiamano requireAdmin(). L'organizzatrice usa solo
// server/registrations.ts (testo scritto da lei e dati economici).

function fail(context: string, error: { message: string }): never {
  throw new Error(`Gestionale (${context}): ${error.message}`);
}

const WORKSHOP_COLUMNS =
  "id, event_id, name, starts_on, ends_on, description, capacity, default_fee_cents, peony_pct, version";
const PERSON_COLUMNS =
  "id, first_name, last_name, nickname, email, instagram, phone, teamartist_id, notes, association_member_id, membership_email, membership_name_key, merged_into, version, created_at, updated_at";

/** "Nome Cognome" dalla scheda, altrimenti dal socio collegato (entrambi presenti), altrimenti null. */
function fullNameOf(person: Person, member: MemberSummary | null): string | null {
  const both = (first: string | null | undefined, last: string | null | undefined) =>
    first?.trim() && last?.trim() ? `${first.trim()} ${last.trim()}` : null;
  return both(person.first_name, person.last_name) ?? both(member?.first_name, member?.last_name);
}

function toWorkshop(row: Record<string, unknown>): Workshop {
  return {
    ...(row as unknown as Workshop),
    peony_pct: Number(row.peony_pct),
    default_fee_cents: row.default_fee_cents === null ? null : Number(row.default_fee_cents),
  };
}

// ---------------------------------------------------------------------------
// Persone
// ---------------------------------------------------------------------------

/**
 * Tutta l'anagrafica, una volta per richiesta. Le ricerche si fanno in
 * memoria per ignorare maiuscole e accenti: adeguato fino a qualche migliaio
 * di persone.
 */
export const loadPeople = cache(async (): Promise<Person[]> => {
  await requireAdmin();
  const { data, error } = await getGestionaleDb()
    .from("gw_people")
    .select(PERSON_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .range(0, 9999);
  if (error) fail("persone", error);
  return (data ?? []) as Person[];
});

export async function getPerson(id: string): Promise<Person | null> {
  if (!isUuidLike(id)) return null;
  return (await loadPeople()).find((person) => person.id === id) ?? null;
}

export type PersonHistoryRow = {
  participantId: string;
  personId: string;
  workshopId: string;
  workshopName: string;
  startsOn: string;
  endsOn: string | null;
  status: BookingStatus;
  /** D27: spunta "Presente" dell'iscrizione (una per iscrizione). */
  present: boolean;
  removedAt: string | null;
};

type HistoryRecord = {
  id: string;
  person_id: string;
  removed_at: string | null;
  gw_bookings: {
    status: BookingStatus;
    present: boolean;
    gw_workshops: { id: string; event_id: string | null; name: string; starts_on: string; ends_on: string | null };
  };
};

async function loadHistory(personIds: readonly string[]): Promise<PersonHistoryRow[]> {
  await requireAdmin();
  if (personIds.length === 0) return [];
  const [result, events] = await Promise.all([
    getGestionaleDb()
      .from("gw_booking_participants")
      .select(
        "id, person_id, removed_at, gw_bookings!inner(status, present, gw_workshops!inner(id, event_id, name, starts_on, ends_on))",
      )
      .in("person_id", personIds)
      .is("deleted_at", null),
    loadLuxuriaEvents(),
  ]);
  if (result.error) fail("storico", result.error);

  const eventsById = new Map(events.map((event) => [event.id, event]));
  return ((result.data ?? []) as unknown as HistoryRecord[]).map((record) => {
    const workshop = record.gw_bookings.gw_workshops;
    // Nome e date dall'evento, se esiste ancora (D14).
    const event = workshop.event_id ? eventsById.get(workshop.event_id) : undefined;
    return {
      participantId: record.id,
      workshopId: workshop.id,
      workshopName: event?.name ?? workshop.name,
      startsOn: event?.startsOn ?? workshop.starts_on,
      endsOn: event ? event.endsOn : workshop.ends_on,
      status: record.gw_bookings.status,
      present: record.gw_bookings.present,
      removedAt: record.removed_at,
      personId: record.person_id,
    };
  });
}

/** Storico workshop della persona, dal più recente. */
export async function getPersonHistory(personId: string): Promise<PersonHistoryRow[]> {
  return (await loadHistory([personId])).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

/** Ultimi workshop (iscrizioni attive) per ogni persona, per i risultati di ricerca. */
export async function getRecentWorkshops(
  personIds: readonly string[],
  perPerson = 3,
): Promise<Map<string, PersonHistoryRow[]>> {
  const byPerson = new Map<string, PersonHistoryRow[]>();
  for (const row of await loadHistory(personIds)) {
    if (row.removedAt) continue;
    const list = byPerson.get(row.personId) ?? [];
    list.push(row);
    byPerson.set(row.personId, list);
  }
  for (const [id, list] of byPerson) {
    byPerson.set(id, list.sort((a, b) => b.startsOn.localeCompare(a.startsOn)).slice(0, perPerson));
  }
  return byPerson;
}

// ---------------------------------------------------------------------------
// Workshop
// ---------------------------------------------------------------------------

async function loadWorkshops(): Promise<Workshop[]> {
  const { data, error } = await getGestionaleDb().from("gw_workshops").select(WORKSHOP_COLUMNS).is("deleted_at", null);
  if (error) fail("workshop", error);
  return (data ?? []).map(toWorkshop);
}

export async function getWorkshopView(id: string): Promise<WorkshopView | null> {
  if (!isUuidLike(id)) return null;
  const { data, error } = await getGestionaleDb()
    .from("gw_workshops")
    .select(WORKSHOP_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) fail("workshop", error);
  if (!data) return null;

  const workshop = toWorkshop(data);
  const event = workshop.event_id ? await getLuxuriaEvent(workshop.event_id) : null;
  return toWorkshopView(workshop, event ?? undefined);
}

/** Home (D23): workshop con conteggi (D15) e recap economico, da una sola lettura aggregata. */
export async function getDashboard(): Promise<DashboardEntry[]> {
  const [events, workshops, overview] = await Promise.all([loadLuxuriaEvents(), loadWorkshops(), loadEconomicOverview()]);
  const counts = new Map([...overview].map(([id, { statuses }]) => [id, countBookings(statuses)]));
  const recaps = new Map([...overview].map(([id, { recap }]) => [id, recap]));
  return buildDashboard(events, workshops, counts, recaps);
}

/** Workshop gestionali con impostazioni, per "Copia impostazioni da un workshop precedente". */
export async function listWorkshopsForCopy(excludeId: string): Promise<WorkshopView[]> {
  const [workshops, events] = await Promise.all([loadWorkshops(), loadLuxuriaEvents()]);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  return workshops
    .filter((workshop) => workshop.id !== excludeId)
    .map((workshop) => toWorkshopView(workshop, workshop.event_id ? eventsById.get(workshop.event_id) : undefined))
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

type BookingRecord = {
  id: string;
  version: number;
  status: BookingStatus;
  present: boolean;
  notes: string | null;
  agreed_fee_cents: number | string | null;
  fee_custom: boolean;
  created_at: string;
  gw_operators: { display_name: string; role: OperatorRole } | { display_name: string; role: OperatorRole }[] | null;
  gw_booking_participants: {
    id: string;
    person_id: string;
    is_primary: boolean;
    entered_as: string | null;
    entered_email: string | null;
    match_status: MatchStatus;
    possible_duplicate_person_id: string | null;
    added_at: string;
    removed_at: string | null;
  }[];
  gw_payments: PaymentRecord[];
};

const BOOKING_COLUMNS = [
  "id, version, status, present, notes, agreed_fee_cents, fee_custom, created_at",
  "gw_operators!gw_bookings_created_by_fkey(display_name, role)",
  "gw_booking_participants(id, person_id, is_primary, entered_as, entered_email, match_status, possible_duplicate_person_id, added_at, removed_at)",
  "gw_payments(id, kind, amount_cents, payment_type, paid_on, method, received_by, description, corrects_payment_id, created_at)",
].join(", ");

/** Iscrizioni del workshop (D15), con il principale per primo e lo stato socio di ogni persona. */
export async function getWorkshopBookings(workshop: WorkshopView): Promise<BookingView[]> {
  await requireAdmin();
  const [bookingsResult, people] = await Promise.all([
    getGestionaleDb()
      .from("gw_bookings")
      .select(BOOKING_COLUMNS)
      .eq("workshop_id", workshop.id)
      .is("deleted_at", null)
      .is("gw_booking_participants.deleted_at", null)
      .is("gw_payments.deleted_at", null)
      .order("created_at", { ascending: true }),
    loadPeople(),
  ]);
  if (bookingsResult.error) fail("iscrizioni", bookingsResult.error);

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const bookings = (bookingsResult.data ?? []) as unknown as BookingRecord[];
  const duplicateOf = (id: string | null) => {
    const person = id ? peopleById.get(id) : undefined;
    return person ? { id: person.id, displayName: displayName(person) } : null;
  };

  const activePeople = bookings
    .flatMap((booking) => booking.gw_booking_participants)
    .filter((participant) => !participant.removed_at)
    .map((participant) => peopleById.get(participant.person_id))
    .filter((person): person is Person => Boolean(person));

  // Lo stato socio si valuta sull'anno associativo che contiene l'inizio dell'evento (D11).
  // 4d: richieste di associazione del periodo associativo del workshop.
  const periodKey = membershipPeriodFor(workshop.startsOn)?.paymentsFrom ?? null;
  const [badges, members, contacts] = await Promise.all([
    getMembershipBadges(activePeople, workshop.startsOn),
    Promise.all(
      [...new Set(activePeople.map(memberKeyOfPerson).filter((key): key is string => Boolean(key)))].map(
        async (key) => [key, await getMemberSummary(key)] as const,
      ),
    ),
    periodKey ? getMembershipContacts(activePeople.map((person) => person.id), periodKey) : new Map<string, MembershipContact[]>(),
  ]);
  const memberByKey = new Map<string, MemberSummary | null>(members);

  return bookings.map((booking) => {
    const active = booking.gw_booking_participants
      .filter((p) => !p.removed_at)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

    return {
      bookingId: booking.id,
      version: booking.version,
      status: booking.status,
      present: booking.present,
      notes: booking.notes,
      agreedFeeCents: booking.agreed_fee_cents === null ? null : Number(booking.agreed_fee_cents),
      feeCustom: booking.fee_custom,
      payments: sortPayments((booking.gw_payments ?? []).map(toPayment)),
      createdBy: (() => {
        const creator = Array.isArray(booking.gw_operators) ? booking.gw_operators[0] : booking.gw_operators;
        return creator ? { displayName: creator.display_name, role: creator.role } : null;
      })(),
      people: active.flatMap((participant) => {
        const person = peopleById.get(participant.person_id);
        if (!person) return [];
        const member = memberByKey.get(memberKeyOfPerson(person) ?? "") ?? null;
        return [
          {
            participantId: participant.id,
            isPrimary: participant.is_primary,
            enteredAs: participant.entered_as,
            enteredEmail: participant.entered_email ?? null,
            matchStatus: participant.match_status,
            possibleDuplicate: duplicateOf(participant.possible_duplicate_person_id),
            member,
            person,
            displayName: displayName(person),
            fullName: fullNameOf(person, member),
            membership: badges.get(person.id) ?? { kind: "non_collegata" },
            contacts: contacts.get(person.id) ?? [],
          },
        ];
      }),
      formerPartners: booking.gw_booking_participants
        .filter((p) => p.removed_at)
        .map((p) => {
          const person = peopleById.get(p.person_id);
          return { displayName: person ? displayName(person) : "Persona", removedAt: p.removed_at! };
        }),
    };
  });
}

/** Persone con un'iscrizione attiva al workshop (per segnalarle nella ricerca). */
export async function getEnrolledPersonIds(workshopId: string): Promise<Set<string>> {
  await requireAdmin();
  const { data, error } = await getGestionaleDb()
    .from("gw_booking_participants")
    .select("person_id")
    .eq("workshop_id", workshopId)
    .is("removed_at", null)
    .is("deleted_at", null);
  if (error) fail("partecipanti", error);
  return new Set((data ?? []).map((row) => row.person_id as string));
}


/** Iscrizioni effettive nei workshop LuXuria non conclusi.
 * Non include interessati, cancellati o persone rimosse dalla coppia. */
export async function loadUpcomingLuxuriaPeople(today: string): Promise<{
  key: string; title: string; startsOn: string; endsOn: string | null; href: string;
  bookings: { bookingId: string; personIds: string[]; statuses?:Record<string,"valid"|"payment_missing"|"missing_form"|null> }[];
}[]> {
  await requireAdmin();
  const db = getGestionaleDb();
  type FutureHistoryRecord = HistoryRecord & {
    booking_id: string; is_primary: boolean;
    gw_bookings: HistoryRecord["gw_bookings"] & {
      deleted_at: string | null;
      gw_workshops: HistoryRecord["gw_bookings"]["gw_workshops"] & { deleted_at: string | null };
    };
  };
  const records: FutureHistoryRecord[] = [];
  for(let offset=0;offset<10000;offset+=500){
    const result=await db.from("gw_booking_participants")
      .select("id,booking_id,is_primary,person_id,removed_at,gw_bookings!inner(status,present,deleted_at,gw_workshops!inner(id,event_id,name,starts_on,ends_on,deleted_at))")
      .is("deleted_at",null).is("removed_at",null)
      .order("id",{ascending:true}).range(offset,offset+499);
    if(result.error)fail("iscrizioni prossimi workshop",result.error);
    records.push(...((result.data??[]) as unknown as FutureHistoryRecord[]));
    if((result.data??[]).length<500)break;
  }
  const events=await loadLuxuriaEvents();
  const byEventId=new Map(events.map(event=>[event.id,event]));
  const groups=new Map<string,{
    key:string;title:string;startsOn:string;endsOn:string|null;href:string;
    bookings:{bookingId:string;personIds:string[];statuses?:Record<string,"valid"|"payment_missing"|"missing_form"|null>}[];
  }>();
  for(const row of records){
    if(row.removed_at||row.gw_bookings.deleted_at||row.gw_bookings.gw_workshops.deleted_at||
      !["prenotato","acconto","saldato"].includes(row.gw_bookings.status))continue;
    const ws=row.gw_bookings.gw_workshops;
    const event=ws.event_id?byEventId.get(ws.event_id):null;
    const startsOn=event?.startsOn??ws.starts_on;
    const endsOn=event?.endsOn??ws.ends_on;
    if((endsOn??startsOn)<today)continue;
    const group=groups.get(ws.id)??{
      key:`luxuria:${ws.id}`,title:event?.name??ws.name,startsOn,endsOn,
      href:`/gestione/w/${ws.id}`,bookings:[],
    };
    let booking=group.bookings.find(b=>b.bookingId===row.booking_id);
    if(!booking){booking={bookingId:row.booking_id,personIds:[]};group.bookings.push(booking);}
    if(!booking.personIds.includes(row.person_id)){
      if(row.is_primary)booking.personIds.unshift(row.person_id);
      else booking.personIds.push(row.person_id);
    }
    groups.set(ws.id,group);
  }
  const personById=new Map((await loadPeople()).map(person=>[person.id,person]));
  // Stessa funzione di verifica socio già usata negli eventi LuXuria.
  for(const group of groups.values()){
    const ids=[...new Set(group.bookings.flatMap(booking=>booking.personIds))];
    const members=ids.map(id=>personById.get(id)).filter((p):p is Person=>Boolean(p));
    try{
      const badges=await getMembershipBadges(members,group.startsOn);
      for(const booking of group.bookings){
        booking.statuses=Object.fromEntries(booking.personIds.map(id=>{
          const badge=badges.get(id);
          const status=badge?.kind==="in_regola"?"valid":
            badge?.kind==="quota_mancante"?"payment_missing":
            badge?.kind==="modulo_mancante"?"missing_form":null;
          return [id,status];
        }));
      }
    }catch(error){
      console.error("Gestionale (stati LuXuria):",error instanceof Error?error.message:"errore");
    }
  }
  return [...groups.values()].sort((a,b)=>a.startsOn.localeCompare(b.startsOn));
}
