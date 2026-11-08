import "server-only";
import { cache } from "react";

import {
  deriveMembershipState,
  normalizeMembershipEmail,
  normalizeMembershipNameKey,
  type MembershipEvidenceRow,
} from "@/lib/association/membership-state";
import { readOfficialMembersBookFromGoogleSheet } from "@/lib/google/members-book";
import { readAssociationMembersFromGoogleSheet } from "@/lib/google/sheets";
import { normalizeText } from "@/lib/gestionale/format";
import { memberLookupScore, previouslyVerifiedBookMember } from "@/lib/gestionale/member-lookup";
import { memberKeyOfPerson, memberKeyOfRow, parseMemberKey, type MemberKey } from "@/lib/gestionale/member-key";
import { resolveMemberName, singleNameOrder, type SingleNameOrder } from "@/lib/gestionale/member-name";
import { deriveForWorkshop, membershipBadge, paymentWindowFor } from "@/lib/gestionale/membership-rule";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import type { MemberCandidate } from "@/lib/gestionale/exact-matches";
import type { MemberSummary, MembershipBadge, Person } from "@/lib/gestionale/types";

// D11 (016): stato socio con le STESSE fonti e la STESSA logica della pagina
// admin (src/app/api/admin/association-members/lookup): Google Sheet live per
// modulo (google_sheet) e libro soci (official_members_book) + righe
// manual_override della tabella `association_members` (SOLA LETTURA), poi
// deriveMembershipState. D18: tutto riservato agli admin (requireAdmin).
// Delle righe si tengono SOLO nome, cognome, email, fonte, stato e date: mai
// codice fiscale, data di nascita o tessera (non arrivano né al browser né ad Ale).

/** Riga delle fonti admin; `tableId` solo per le righe manual_override della tabella. */
type EvidenceRow = MembershipEvidenceRow & { tableId: string | null };

type Evidence = {
  rows: EvidenceRow[];
  formNameOrder: SingleNameOrder;
  source: "live" | "snapshot";
  snapshotUpdatedAt: string | null;
};

const EVIDENCE_TTL_MS = 5 * 60_000;
let evidenceCache: { loadedAt: number; evidence: Promise<Evidence> } | null = null;

function pick(row: MembershipEvidenceRow, tableId: string | null): EvidenceRow {
  return {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    source: row.source,
    membership_status: row.membership_status,
    membership_starts_at: row.membership_starts_at,
    membership_expires_at: row.membership_expires_at,
    tableId,
  };
}

/**
 * Copia salvata delle fonti: utile anche quando Vercel non puo' accedere
 * all'account di servizio Google. Non si dichiara mai che sia in tempo reale.
 * TeamArtist/registro ufficiale e' la prova di pagamento e iscrizione, il
 * semplice modulo Google non equivale a quota verificata.
 */
async function fetchSavedEvidence(): Promise<Evidence> {
  const rows: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    source: string | null;
    membership_status: string | null;
    membership_starts_at: string | null;
    membership_expires_at: string | null;
    updated_at: string | null;
  }> = [];
  // Un singolo SELECT può fermarsi al limite PostgREST di 1000 righe.
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await getGestionaleDb()
      .from("association_members")
      .select("id,first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at,updated_at")
      .in("source", ["google_sheet", "official_members_book"])
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (error) throw new Error(`Gestionale (copia libro soci): ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }
  const timestamp = rows
    .filter((row) => row.source === "google_sheet" || row.source === "official_members_book")
    .map((row) => row.updated_at)
    .filter((value): value is string => typeof value === "string")
    .sort().at(-1) ?? null;
  return {
    rows: rows.map((row) => pick(row, null)),
    formNameOrder: null,
    source: "snapshot",
    snapshotUpdatedAt: timestamp,
  };
}

async function fetchEvidence(): Promise<Evidence> {
  // Evita che l'assenza di credenziali Google blocchi tutta la pagina workshop.
  // Il gestionale preferisce sempre le fonti live quando sono configurate.
  const canReadGoogle = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SHEET_ID",
    "GOOGLE_SHEET_RANGE",
    "GOOGLE_MEMBERS_BOOK_RANGE",
  ].every((name) => Boolean(process.env[name]?.trim()));
  if (!canReadGoogle) {
    return fetchSavedEvidence();
  }
  try {
    const [formSource, bookSource] = await Promise.all([
      readAssociationMembersFromGoogleSheet(),
      readOfficialMembersBookFromGoogleSheet(),
    ]);

    // Modulo con nome e cognome in un'unica colonna: l'ordine lo dice l'intestazione.
    const formFirst = formSource.detectedColumns?.first_name;
    const formLast = formSource.detectedColumns?.last_name;
    const formNameOrder =
      formFirst && formLast && formFirst.index !== null && formFirst.index === formLast.index
        ? singleNameOrder(formFirst.normalizedHeader)
        : null;

    return {
      rows: [
        ...formSource.rows.map((row) => pick(row, null)),
        ...bookSource.rows.map((row) => pick(row, null)),
      ],
      formNameOrder,
      source: "live",
      snapshotUpdatedAt: null,
    };
  } catch (error) {
    console.warn("[gestionale] Fonti associative live non disponibili: uso la copia salvata.", error);
    return fetchSavedEvidence();
  }
}

/** Le validazioni manuali NON vanno mai nella cache globale dei Google Sheet.
 * Su Netlify due richieste possono arrivare su istanze server diverse:
 * invalidare una cache locale non invalida quelle delle altre istanze.
 * La cache React limita a una sola lettura per render lato server.
 */
const readCurrentManualValidations = cache(async (): Promise<EvidenceRow[]> => {
  await requireAdmin();
  const rows: EvidenceRow[] = [];
  for(let offset=0;offset<10000;offset+=500) {
    const {data,error}=await getGestionaleDb().from("association_members")
      .select("id,first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at")
      .eq("source","manual_override").order("id",{ascending:true})
      .range(offset,offset+499);
    if(error)throw new Error(`Gestionale (quote manuali aggiornate): ${error.message}`);
    rows.push(...(data??[]).map(row=>pick(row,row.id)));
    if((data??[]).length<500)break;
  }
  return rows;
});

/** Per segnalare all'admin se le verifiche derivano da fonti live o da copia. */
export async function getMembershipEvidenceStatus(): Promise<{
  source: "live" | "snapshot";
  snapshotUpdatedAt: string | null;
}> {
  const evidence = await loadEvidenceWithOrder();
  return { source: evidence.source, snapshotUpdatedAt: evidence.snapshotUpdatedAt };
}

/** Fonti della pagina admin, con una cache lato server di 5 minuti (le letture dai Google Sheet sono lente). */
async function loadEvidenceWithOrder(): Promise<Evidence> {
  await requireAdmin();
  if (!evidenceCache || Date.now() - evidenceCache.loadedAt > EVIDENCE_TTL_MS) {
    const evidence = fetchEvidence();
    evidenceCache = { loadedAt: Date.now(), evidence };
    // Un errore non resta in cache: il prossimo caricamento riprova.
    evidence.catch(() => {
      if (evidenceCache?.evidence === evidence) evidenceCache = null;
    });
  }
  const [sources, manual]=await Promise.all([
    evidenceCache.evidence,
    readCurrentManualValidations(),
  ]);
  // Nessuna quota può risultare scaduta per colpa di una cache server obsoleta.
  return {...sources, rows:[...sources.rows, ...manual]};
}

async function loadEvidence(): Promise<EvidenceRow[]> {
  return (await loadEvidenceWithOrder()).rows;
}

/** "Aggiorna stato soci" e dopo ogni "Segna quota ok": la prossima lettura riprende le fonti. */
export async function clearMembershipCache(): Promise<void> {
  await requireAdmin();
  evidenceCache = null;
}

type Identity = { email: string | null; firstName: string | null; lastName: string | null };

const SOURCE_RANK: Record<string, number> = { manual_override: 0, official_members_book: 1, google_sheet: 2 };

/** Righe del socio indicato dalla chiave, la più autorevole per prima (manuale, libro soci, modulo). */
function rowsOfKey(key: MemberKey, rows: readonly EvidenceRow[]): EvidenceRow[] {
  const matching = rows.filter((row) => {
    if (key.kind === "manual") return row.tableId === key.id;
    if (key.kind === "email") return normalizeMembershipEmail(row.email) === key.email;
    return !normalizeMembershipEmail(row.email).includes("@") && normalizeMembershipNameKey(row.first_name, row.last_name) === key.nameKey;
  });
  return matching.sort((a, b) => (SOURCE_RANK[a.source ?? ""] ?? 9) - (SOURCE_RANK[b.source ?? ""] ?? 9));
}

function identityOfRow(row: EvidenceRow): Identity {
  return { email: row.email, firstName: row.first_name, lastName: row.last_name };
}

/**
 * Identità con cui la pagina admin cercherebbe la persona: il socio collegato
 * a mano (validazione manuale o email del libro soci), altrimenti email, nome
 * e cognome della persona. Stesso abbinamento dell'admin (email, oppure nome
 * se c'è un'unica riga nel libro ufficiale).
 */
function identityOfPerson(
  person: Pick<Person, "first_name" | "last_name" | "email" | "association_member_id" | "membership_email"> & {membership_name_key?:string|null},
  rows: readonly EvidenceRow[],
): Identity {
  if (person.association_member_id) {
    const manual = rows.find((row) => row.tableId === person.association_member_id);
    if (manual) return identityOfRow(manual);
  }
  const selected=person.membership_name_key ? rowsOfKey({kind:"name",nameKey:person.membership_name_key},rows) : [];
  if(selected.length===1) return {
    ...identityOfRow(selected[0]),
    // Un'email di modulo confermata dall'admin può integrare un libro soci
    // senza email e con secondo nome diverso, senza perdere il link ufficiale.
    email:person.email??selected[0].email,
  };
  return { email: person.membership_email ?? person.email, firstName: person.first_name, lastName: person.last_name };
}

/**
 * Identità della persona per la validazione manuale "Quota ok": la stessa con
 * cui si calcola il suo badge, così la validazione la ritrova.
 */
export async function membershipIdentityOf(
  person: Pick<Person, "first_name" | "last_name" | "email" | "association_member_id" | "membership_email"> & {membership_name_key?:string|null},
): Promise<Identity> {
  await requireAdmin();
  return identityOfPerson(person, await loadEvidence());
}

/** Senza workshop: come la pagina admin (periodo in corso). Con workshop: il suo periodo associativo. */
function stateFor(identity: Identity, rows: readonly EvidenceRow[], workshopStartsOn?: string) {
  return workshopStartsOn ? deriveForWorkshop([...rows], identity, workshopStartsOn) : deriveMembershipState([...rows], identity);
}

function toSummary(
  key: string,
  sameMember: readonly EvidenceRow[],
  rows: readonly EvidenceRow[],
  formNameOrder: SingleNameOrder = null,
  identity: Identity = identityOfRow(sameMember[0]),
): MemberSummary {
  const best = sameMember[0];
  // Nome e cognome separati anche se la riga migliore li ha in un campo unico.
  const name = resolveMemberName(
    sameMember,
    rows.filter((row) => row.source !== "google_sheet"),
    best.source === "google_sheet" ? formNameOrder : null,
  );
  return {
    id: key,
    first_name: name.firstName,
    last_name: name.lastName,
    name_split: name.split,
    email: best.email ?? sameMember.find((row) => row.email)?.email ?? null,
    // Scadenza come la mostra la pagina admin (anno associativo corrente).
    expires_at: stateFor(identity, rows).membershipExpiresAt,
    source: best.source === "manual_override" ? "manuale" : best.source === "official_members_book" ? "libro" : "modulo",
  };
}

/** Badge stato socio per ogni persona, per l'anno associativo che contiene l'inizio del workshop. */
export async function getMembershipBadges(
  people: readonly (Pick<Person, "id" | "first_name" | "last_name" | "email" | "association_member_id" | "membership_email"> & {membership_name_key?:string|null})[],
  workshopStartsOn: string,
): Promise<Map<string, MembershipBadge>> {
  await requireAdmin();
  const rows = people.length ? await loadEvidence() : [];

  const badges = new Map<string, MembershipBadge>();
  for (const person of people) {
    badges.set(
      person.id,
      membershipBadge({
        workshopStartsOn,
        state: stateFor(identityOfPerson(person, rows), rows, workshopStartsOn.slice(0, 10)),
        linked: Boolean(memberKeyOfPerson(person)),
        knownHistoricalMember: (() => {
          const key=memberKeyOfPerson(person);
          const parsed=key?parseMemberKey(key):null;
          return parsed ? previouslyVerifiedBookMember(
            rowsOfKey(parsed,rows),
            paymentWindowFor(workshopStartsOn).period?.paymentsFrom??null,
          ) : false;
        })(),
      }),
    );
  }
  return badges;
}

/** Socio indicato dalla chiave (member-key.ts), o null se non c'è più nelle fonti. */
export async function getMemberSummary(memberKey: string): Promise<MemberSummary | null> {
  await requireAdmin();
  const key = parseMemberKey(memberKey);
  if (!key) return null;
  const { rows, formNameOrder } = await loadEvidenceWithOrder();
  const sameMember = rowsOfKey(key, rows);
  return sameMember.length ? toSummary(memberKey, sameMember, rows, formNameOrder) : null;
}

/** Socio collegato esplicitamente alla persona, se c'è. */
export async function getLinkedMemberSummary(
  person: Pick<Person, "association_member_id" | "membership_email"> & {membership_name_key?:string|null},
): Promise<MemberSummary | null> {
  const key = memberKeyOfPerson(person);
  return key ? getMemberSummary(key) : null;
}

/**
 * Dati per collegare una persona al socio (gw_set_membership_link,
 * gw_person_from_membership): id della validazione manuale, oppure email del
 * libro soci / modulo; nome e cognome per i campi vuoti. Letti qui, mai dal browser.
 */
export async function getMemberLink(
  memberKey: string,
): Promise<{ memberId: string | null; email: string | null; firstName: string | null; lastName: string | null } | null> {
  await requireAdmin();
  const key = parseMemberKey(memberKey);
  const member = await getMemberSummary(memberKey);
  if (!key || !member) return null;
  return {
    memberId: key.kind === "manual" ? key.id : null,
    email: key.kind === "manual" ? null : member.email?.trim().toLowerCase() || null,
    firstName: member.first_name,
    lastName: member.last_name,
  };
}

const bySourceRank = (a: EvidenceRow, b: EvidenceRow) => (SOURCE_RANK[a.source ?? ""] ?? 9) - (SOURCE_RANK[b.source ?? ""] ?? 9);

/**
 * Righe delle fonti admin raggruppate per socio (4d): stessa email = stesso
 * socio; una riga senza email (es. libro soci) va con l'unico gruppo con email
 * che ha lo stesso nome e cognome, altrimenti fa gruppo per nome. Omonimi con
 * email diverse restano soci diversi.
 */
function groupMemberRows(rows: readonly EvidenceRow[]): EvidenceRow[][] {
  const byEmail = new Map<string, EvidenceRow[]>();
  const withoutEmail: EvidenceRow[] = [];
  for (const row of rows) {
    const email = normalizeMembershipEmail(row.email);
    if (email.includes("@")) byEmail.set(email, [...(byEmail.get(email) ?? []), row]);
    else withoutEmail.push(row);
  }
  const emailGroupsByName = new Map<string, EvidenceRow[][]>();
  for (const group of byEmail.values()) {
    for (const nameKey of new Set(group.map((row) => normalizeMembershipNameKey(row.first_name, row.last_name)))) {
      if (nameKey) emailGroupsByName.set(nameKey, [...(emailGroupsByName.get(nameKey) ?? []), group]);
    }
  }
  const groups = [...byEmail.values()];
  const byName = new Map<string, EvidenceRow[]>();
  for (const row of withoutEmail) {
    const nameKey = normalizeMembershipNameKey(row.first_name, row.last_name);
    const sameName = nameKey ? (emailGroupsByName.get(nameKey) ?? []) : [];
    if (sameName.length === 1) sameName[0].push(row);
    else if (row.tableId) groups.push([row]);
    else if (nameKey) {
      const group = byName.get(nameKey) ?? [];
      if (group.length === 0) {
        byName.set(nameKey, group);
        groups.push(group);
      }
      group.push(row);
    }
  }
  return groups.map((group) => [...group].sort(bySourceRank));
}

/**
 * Chiave con cui si collega il socio: l'email del libro soci o del modulo se
 * c'è, altrimenti la validazione manuale, altrimenti nome e cognome.
 */
function groupKey(group: readonly EvidenceRow[]): string | null {
  const withEmail = group.find((row) => !row.tableId && normalizeMembershipEmail(row.email).includes("@"));
  if (withEmail) return `e:${normalizeMembershipEmail(withEmail.email)}`;
  const manual = group.find((row) => row.tableId);
  return manual ? `m:${manual.tableId}` : memberKeyOfRow(group[0]);
}

function groupIdentity(group: readonly EvidenceRow[]): Identity {
  const email = group.find((row) => normalizeMembershipEmail(row.email).includes("@"))?.email ?? null;
  return { email, firstName: group[0].first_name, lastName: group[0].last_name };
}

/**
 * Soci (fonti admin) che corrispondono per nome, cognome o email e che non
 * sono già collegati a una persona del gestionale. Una voce per socio (non
 * per fonte). Con `referenceDate` (inizio del workshop, o oggi) ogni voce ha
 * lo stato tessera che risulterebbe collegando la persona.
 */
/** Chiavi dei soci già collegati a una persona del gestionale (non unita, non eliminata). */
async function loadLinkedMemberKeys(): Promise<Set<string>> {
  const { data, error } = await getGestionaleDb()
    .from("gw_people")
    .select("association_member_id, membership_email, membership_name_key")
    .is("merged_into", null)
    .is("deleted_at", null)
    .or("association_member_id.not.is.null,membership_email.not.is.null,membership_name_key.not.is.null");
  if (error) throw new Error(`Gestionale (collegamenti soci): ${error.message}`);
  return new Set(
    ((data ?? []) as (Pick<Person, "association_member_id" | "membership_email"> & {membership_name_key?:string|null})[])
      .map(memberKeyOfPerson)
      .filter((key): key is string => Boolean(key)),
  );
}

function isLinkedGroup(group: readonly EvidenceRow[], key: string, linked: ReadonlySet<string>): boolean {
  return group.some((row) => linked.has(memberKeyOfRow(row) ?? "")) || linked.has(key);
}

/** Ricerca parziale tra libro ufficiale, moduli Google e nickname già
 * registrati. L'elenco espanso NON equivale ad abbinamento automatico.
 * includeLinked è usato per cercare anche soci già collegati alla persona.
 */
export async function searchMembers(
  query: string,limit=8,referenceDate?:string,
  options:{includeLinked?:boolean}={},
):Promise<MemberSummary[]> {
  await requireAdmin();
  const normalized=normalizeText(query);
  if(normalized.length<2)return [];
  // Gli alias si cercano lato database: non scaricare tutte le iscrizioni
  // storiche ad ogni carattere digitato nella ricerca.
  const aliasTerm=normalized.split(/\s+/).find(token=>token.length>=2)
    ?.replace(/[%_\\]/g,"")??"";
  const aliasPattern=`%${aliasTerm}%`;
  const [rows,linked,aliasRows,bookingAliases]=await Promise.all([
    loadEvidence(),loadLinkedMemberKeys(),
    getGestionaleDb().from("gw_people")
      .select("id,nickname,association_member_id,membership_email,membership_name_key")
      .ilike("nickname",aliasPattern).is("deleted_at",null).is("merged_into",null).range(0,999),
    getGestionaleDb().from("gw_booking_participants")
      .select("person_id,entered_as").ilike("entered_as",aliasPattern).is("deleted_at",null).range(0,999),
  ]);
  if(aliasRows.error||bookingAliases.error)throw new Error("Impossibile leggere i nickname dell'anagrafica.");
  const byKey=new Map<string,string[]>();
  const keysByPerson=new Map<string,string>();
  for(const person of aliasRows.data??[]){
    const key=memberKeyOfPerson(person);
    if(key){
      keysByPerson.set(person.id,key);
      if(person.nickname)byKey.set(key,[...(byKey.get(key)??[]),person.nickname]);
    }
  }
  // Il nickname scritto da Ale può essere conservato solo nell'iscrizione.
  // Usa il collegamento della persona, MAI la somiglianza del nickname per
  // dichiarare verificata una quota.
  const unlinkedPeople=(bookingAliases.data??[])
    .filter(row=>!keysByPerson.has(row.person_id))
    .map(row=>row.person_id);
  if(unlinkedPeople.length){
    const ids=[...new Set(unlinkedPeople)].slice(0,9999);
    for(let i=0;i<ids.length;i+=500){
      const chunk=await getGestionaleDb().from("gw_people")
        .select("id,association_member_id,membership_email,membership_name_key")
        .in("id",ids.slice(i,i+500)).is("deleted_at",null).is("merged_into",null);
      if(chunk.error)throw new Error("Impossibile risolvere gli alias storici.");
      for(const person of chunk.data??[]){
        const key=memberKeyOfPerson(person);
        if(key)keysByPerson.set(person.id,key);
      }
    }
  }
  for(const row of bookingAliases.data??[]){
    const key=keysByPerson.get(row.person_id);
    if(key&&row.entered_as)byKey.set(key,[...(byKey.get(key)??[]),row.entered_as]);
  }
  const matches: {rank:number;summary:MemberSummary}[]=[];
  for(const group of groupMemberRows(rows)){
    const key=groupKey(group);
    if(!key)continue;
    const alreadyLinked=isLinkedGroup(group,key,linked);
    if(!options.includeLinked&&alreadyLinked)continue;
    const aliases=[...new Set(group.flatMap(row=>byKey.get(memberKeyOfRow(row)??"")??[]).concat(byKey.get(key)??[]))];
    const rank=memberLookupScore(query,{
      firstName:group.map(r=>r.first_name).filter(Boolean).join(" "),
      lastName:group.map(r=>r.last_name).filter(Boolean).join(" "),
      email:group.map(r=>r.email).filter(Boolean).join(" "),
    },aliases);
    if(rank===null)continue;
    const identity=groupIdentity(group);
    const summary=toSummary(key,group,rows,null,identity);
    if(options.includeLinked){
      summary.alreadyLinked=alreadyLinked;
      summary.matchedAlias=aliases.find(alias=>memberLookupScore(query,{
        firstName:null,lastName:null,email:null,
      },[alias])!==null)??null;
    }
    if(referenceDate){
      summary.outcome=membershipBadge({
        workshopStartsOn:referenceDate,
        state:stateFor(identity,rows,referenceDate.slice(0,10)),
        linked:true,
        knownHistoricalMember:previouslyVerifiedBookMember(
          group,paymentWindowFor(referenceDate).period?.paymentsFrom??null),
      });
      summary.in_book=group.some(row=>row.source==="official_members_book");
    }
    matches.push({rank,summary});
  }
  matches.sort((a,b)=>a.rank-b.rank||
    (a.summary.first_name??"").localeCompare(b.summary.first_name??"","it"));
  return matches.slice(0,limit).map(item=>item.summary);
}

/** Badge di un socio scelto per una persona nuova (aggiunta rapida, abbinamento). */
export async function getMemberBadge(memberKey: string, workshopStartsOn: string): Promise<MembershipBadge> {
  await requireAdmin();
  const key = parseMemberKey(memberKey);
  const rows = await loadEvidence();
  const best = key ? rowsOfKey(key, rows)[0] : undefined;
  const identity: Identity = best ? identityOfRow(best) : { email: null, firstName: null, lastName: null };
  return membershipBadge({
    workshopStartsOn,
    state:stateFor(identity,rows,workshopStartsOn.slice(0,10)),
    linked:Boolean(best),
    knownHistoricalMember:best?previouslyVerifiedBookMember(
      rowsOfKey(key!,rows),paymentWindowFor(workshopStartsOn).period?.paymentsFrom??null):false,
  });
}

/**
 * Fase 5 (collegamento in blocco): soci non ancora collegati a nessuna
 * persona, una voce per socio come la ricerca, con le email e i nomi
 * normalizzati di tutte le sue righe. Solo nome, cognome ed email.
 */
export async function listUnlinkedMembers(): Promise<MemberCandidate[]> {
  await requireAdmin();
  const [{ rows, formNameOrder }, linked] = await Promise.all([loadEvidenceWithOrder(), loadLinkedMemberKeys()]);
  const candidates: MemberCandidate[] = [];
  for (const group of groupMemberRows(rows)) {
    const key = groupKey(group);
    if (!key || isLinkedGroup(group, key, linked)) continue;
    const summary = toSummary(key, group, rows, formNameOrder, groupIdentity(group));
    candidates.push({
      key,
      name: [summary.first_name, summary.last_name].filter(Boolean).join(" ") || summary.email || "Socio",
      email: summary.email,
      emails: [...new Set(group.map((row) => normalizeMembershipEmail(row.email)).filter((email) => email.includes("@")))],
      nameKeys: [...new Set(group.map((row) => normalizeMembershipNameKey(row.first_name, row.last_name)).filter(Boolean))],
    });
  }
  return candidates;
}
