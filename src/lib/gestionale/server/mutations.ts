import "server-only";

import { rpcErrorMessage } from "@/lib/gestionale/errors";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import type {
  ActionResult,
  BookingStatus,
  ExpenseCategory,
  InvoiceStatus,
  LuxuriaEvent,
  Party,
  PaymentMethod,
  PaymentType,
  PersonFields,
  SettlementStatus,
  TransferStatus,
} from "@/lib/gestionale/types";
import type { WorkshopSettingsPayload } from "@/lib/gestionale/workshops";

// Scritture del gestionale: sempre tramite funzioni gw_* (migrazioni 011–020),
// che scrivono lo storico nella stessa transazione e controllano `version`.
// Chi chiama deve aver già eseguito requireOperator().

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const { data, error } = await getGestionaleDb().rpc(fn, args);
  if (error) {
    if (!error.code?.startsWith("GW")) {
      console.error(`Gestionale ${fn}:`, error.code, error.message);
    }
    return { ok: false, error: rpcErrorMessage(error) };
  }
  return { ok: true, data } as ActionResult<T>;
}

/** D14: crea (se manca) la riga gestionale dell'evento e aggiorna la copia di nome e date. */
export function ensureWorkshopForEvent(operatorId: string, event: LuxuriaEvent) {
  return callRpc<string>("gw_ensure_workshop_for_event", {
    p_operator_id: operatorId,
    p_event_id: event.id,
    p_name: event.name,
    p_starts_on: event.startsOn,
    p_ends_on: event.endsOn,
  });
}

/**
 * D14: solo capienza, quota standard, percentuale e descrizione. D19 (015): se
 * la quota cambia, le prenotazioni non dedicate la seguono nella stessa
 * transazione; `unsettled` = quante non sono più saldate.
 */
export function updateWorkshopSettings(operatorId: string, id: string, version: number, payload: WorkshopSettingsPayload) {
  return callRpc<{ version: number; unsettled: number }>("gw_update_workshop_settings", {
    p_operator_id: operatorId,
    p_id: id,
    p_version: version,
    p_data: payload,
  });
}

export function updatePerson(operatorId: string, id: string, version: number, fields: PersonFields) {
  return callRpc<number>("gw_update_person", {
    p_operator_id: operatorId,
    p_id: id,
    p_version: version,
    p_data: fields,
  });
}

/**
 * D11 (016): socio come lo vede la pagina admin. `memberId` = validazione
 * manuale (manual_override), altrimenti `email` = chiave del libro soci /
 * modulo; nome e cognome riempiono i campi vuoti. null = scollega.
 */
export type MemberLinkInput = { memberId: string | null; email: string | null; firstName: string | null; lastName: string | null };

export function setMembershipLink(operatorId: string, personId: string, version: number, link: MemberLinkInput | null) {
  return callRpc<number>("gw_set_membership_link", {
    p_operator_id: operatorId,
    p_person_id: personId,
    p_version: version,
    p_member_id: link?.memberId ?? null,
    p_email: link?.email ?? null,
    p_first_name: link?.firstName ?? null,
    p_last_name: link?.lastName ?? null,
  });
}

export function mergePeople(
  operatorId: string,
  primary: { id: string; version: number },
  secondary: { id: string; version: number },
  values: PersonFields & { association_member_id: string | null },
) {
  return callRpc<number>("gw_merge_people", {
    p_operator_id: operatorId,
    p_primary_id: primary.id,
    p_primary_version: primary.version,
    p_secondary_id: secondary.id,
    p_secondary_version: secondary.version,
    p_values: values,
  });
}

export type BookingPersonInput =
  | { person_id: string }
  | { new: Partial<PersonFields> & { association_member_id?: string | null; membership_email?: string | null } };

/**
 * Aggiunta rapida degli admin con la ricerca. Il primo elemento di `people` è
 * il principale, il secondo il partner (D15). La quota è quella standard del
 * workshop (D19, la applica gw_create_booking).
 */
export function createBooking(
  operatorId: string,
  input: {
    workshopId: string;
    people: BookingPersonInput[];
    status: BookingStatus;
    notes: string | null;
  },
) {
  return callRpc<string>("gw_create_booking", {
    p_operator_id: operatorId,
    p_workshop_id: input.workshopId,
    p_people: input.people,
    p_status: input.status,
    p_agreed_fee_cents: null,
    p_notes: input.notes,
  });
}

/** Admin (3b): solo le note della prenotazione (gw_update_booking_notes, migrazione 014). */
export function updateBookingNotes(operatorId: string, input: { bookingId: string; version: number; notes: string | null }) {
  return callRpc<number>("gw_update_booking_notes", {
    p_operator_id: operatorId,
    p_booking_id: input.bookingId,
    p_version: input.version,
    p_notes: input.notes,
  });
}

export function setPartner(
  operatorId: string,
  input: {
    bookingId: string;
    version: number;
    removeParticipantId: string | null;
    addPerson: BookingPersonInput | null;
  },
) {
  return callRpc<number>("gw_set_partner", {
    p_operator_id: operatorId,
    p_booking_id: input.bookingId,
    p_version: input.version,
    p_remove_participant_id: input.removeParticipantId,
    p_add_person: input.addPerson,
  });
}

// ---------------------------------------------------------------------------
// Fase 3 (migrazione 013)
// ---------------------------------------------------------------------------

/** Riga aperta del tab Iscrizioni: stato, note, fattura. La quota si cambia con setBookingFee. */
export function updateRegistration(
  operatorId: string,
  input: {
    bookingId: string;
    version: number;
    status: BookingStatus;
    notes: string | null;
    invoiceStatus: InvoiceStatus;
  },
) {
  return callRpc<number>("gw_update_registration", {
    p_operator_id: operatorId,
    p_booking_id: input.bookingId,
    p_version: input.version,
    p_status: input.status,
    p_notes: input.notes,
    p_invoice_status: input.invoiceStatus,
  });
}

/** D19, matita: tariffa dedicata (feeCents) o "Ripristina quota del workshop" (null). */
export function setBookingFee(operatorId: string, bookingId: string, version: number, feeCents: number | null) {
  return callRpc<number>("gw_set_booking_fee", {
    p_operator_id: operatorId,
    p_booking_id: bookingId,
    p_version: version,
    p_fee_cents: feeCents,
  });
}

export type PaymentInput = {
  kind: "pagamento" | "rimborso";
  amount_cents: number;
  payment_type: PaymentType;
  method: PaymentMethod | null;
  /** null = data non indicata (026). */
  paid_on: string | null;
  received_by: Party;
  description: string | null;
};

/** D21: "+ Pagamento" e "Rimborso". Lo stato si aggiorna nella stessa transazione. */
export function addPayment(operatorId: string, bookingId: string, payment: PaymentInput) {
  return callRpc<string>("gw_add_payment", {
    p_operator_id: operatorId,
    p_booking_id: bookingId,
    p_data: payment,
  });
}

/**
 * "Aggiungi" di Ale con il primo pagamento nella stessa transazione
 * (obbligatorio per Acconto pagato / Saldato; migrazione 019).
 */
export function createRegistration(
  operatorId: string,
  input: {
    workshopId: string;
    entries: EnteredEntry[];
    status: BookingStatus;
    feeCents: number | null;
    notes: string | null;
    payment: Omit<PaymentInput, "kind"> | null;
  },
) {
  return callRpc<string>("gw_create_registration", {
    p_operator_id: operatorId,
    p_workshop_id: input.workshopId,
    p_entries: input.entries,
    p_status: input.status,
    p_fee_cents: input.feeCents,
    p_notes: input.notes,
    p_payment: input.payment,
  });
}

/** D21: "Modifica" = rettifica collegata + movimento giusto (o solo rettifica: annulla). */
export function correctPayment(
  operatorId: string,
  paymentId: string,
  replacement: Omit<PaymentInput, "kind"> | null,
  description: string | null,
) {
  return callRpc<string>("gw_correct_payment", {
    p_operator_id: operatorId,
    p_payment_id: paymentId,
    p_replacement: replacement,
    p_description: description,
  });
}

/** Persona scritta da Ale: il testo, oppure testo + email (4d, B2: gw_create_booking_entered). */
export type EnteredEntry = string | { text: string; email: string };

export type ImportRowInput = {
  booking_id: string | null;
  booking_version: number | null;
  people: EnteredEntry[];
  status: BookingStatus;
  /** Anteprima: stato tenuto contro i pagamenti (righe nuove, solo interessato / prenotato; migrazione 023). */
  forced_status: "interessato" | "prenotato" | null;
  fee_cents: number | null;
  invoice_status: InvoiceStatus;
  notes: string | null;
  /** 4e (#9): righe già presenti, email scritta da Ale da salvare se l'iscrizione non ne ha una. */
  entered_email?: string | null;
  /**
   * paid_on e description facoltativi (019): altrimenti la data comune e
   * "importazione testo". received_by facoltativo (025): altrimenti quello comune.
   */
  payments: {
    amount_cents: number;
    method: PaymentMethod | null;
    payment_type: PaymentType;
    paid_on?: string | null;
    received_by?: Party | null;
    description?: string | null;
  }[];
};

/**
 * 4e (#5/#28, sola lettura): per ogni nome dell'anteprima, l'iscrizione di
 * questo workshop a cui il server lo abbinerebbe. Solo id e testo di Ale.
 */
export function previewEnteredMatches(workshopId: string, entries: EnteredEntry[]) {
  return callRpc<({ booking_id: string; entered_as: string | null } | null)[]>("gw_preview_entered_matches", {
    p_workshop_id: workshopId,
    p_entries: entries,
  });
}

/** 4e (#2): rimborso del pagato netto (un movimento per parte, o uno solo della parte indicata). */
export function refundBooking(
  operatorId: string,
  input: { bookingId: string; expectedCents: number; method: PaymentMethod | null; paidOn: string | null; receivedBy: Party | null },
) {
  return callRpc<number>("gw_refund_booking", {
    p_operator_id: operatorId,
    p_booking_id: input.bookingId,
    p_expected_cents: input.expectedCents,
    p_method: input.method,
    p_paid_on: input.paidOn,
    p_received_by: input.receivedBy,
  });
}

/** Box di testo: tutto o niente (gw_import_roster). */
export function importRoster(
  operatorId: string,
  input: { workshopId: string; paidOn: string | null; receivedBy: Party; rows: ImportRowInput[] },
) {
  return callRpc<{ created: number; updated: number; payments: number }>("gw_import_roster", {
    p_operator_id: operatorId,
    p_workshop_id: input.workshopId,
    p_paid_on: input.paidOn,
    p_received_by: input.receivedBy,
    p_rows: input.rows,
  });
}

type ParticipantRef = { bookingId: string; version: number; participantId: string };

/** D20 (solo admin): "Conferma" l'abbinamento automatico. */
export function confirmMatch(operatorId: string, ref: ParticipantRef) {
  return callRpc<number>("gw_confirm_match", {
    p_operator_id: operatorId,
    p_booking_id: ref.bookingId,
    p_version: ref.version,
    p_participant_id: ref.participantId,
  });
}

/** D20 (solo admin): "Non è questa persona". */
export function rejectMatch(operatorId: string, ref: ParticipantRef) {
  return callRpc<number>("gw_reject_match", {
    p_operator_id: operatorId,
    p_booking_id: ref.bookingId,
    p_version: ref.version,
    p_participant_id: ref.participantId,
  });
}

export type ResolveAction = "crea_nuova" | "collega" | "collega_socio" | "unisci";

/** D20 + D11 (016): riga "da abbinare" → "Collega" a un socio delle fonti admin. */
export function resolveMatchMembership(operatorId: string, ref: ParticipantRef, link: MemberLinkInput) {
  return callRpc<number>("gw_resolve_match_membership", {
    p_operator_id: operatorId,
    p_booking_id: ref.bookingId,
    p_version: ref.version,
    p_participant_id: ref.participantId,
    p_member_id: link.memberId,
    p_email: link.email,
    p_first_name: link.firstName,
    p_last_name: link.lastName,
  });
}

/** D20 (solo admin): riga "da abbinare" → Crea nuova / Collega / Unisci. */
export function resolveMatch(operatorId: string, ref: ParticipantRef, action: ResolveAction, targetId: string | null) {
  return callRpc<number>("gw_resolve_match", {
    p_operator_id: operatorId,
    p_booking_id: ref.bookingId,
    p_version: ref.version,
    p_participant_id: ref.participantId,
    p_action: action,
    p_target: targetId,
  });
}

// ---------------------------------------------------------------------------
// Consuntivo (Fase 4, migrazione 018). I controlli di ruolo e i limiti che
// dipendono dai totali (perdita, residuo da riportare) li fa chi chiama.
// ---------------------------------------------------------------------------

export type ExpensePayload = {
  description: string;
  amount_cents: number;
  advanced_by: Party;
  category: ExpenseCategory;
  spent_on: string | null;
};

export function createExpense(operatorId: string, workshopId: string, data: ExpensePayload) {
  return callRpc<string>("gw_create_expense", { p_operator_id: operatorId, p_workshop_id: workshopId, p_data: data });
}

export function updateExpense(operatorId: string, id: string, version: number, data: ExpensePayload) {
  return callRpc<number>("gw_update_expense", { p_operator_id: operatorId, p_id: id, p_version: version, p_data: data });
}

export function deleteExpense(operatorId: string, id: string, version: number) {
  return callRpc<null>("gw_delete_expense", { p_operator_id: operatorId, p_id: id, p_version: version });
}

export type TransferPayload = {
  from_party: Party;
  to_party: Party;
  amount_cents: number;
  status: TransferStatus;
  executed_on: string | null;
  notes: string | null;
};

export function createTransfer(operatorId: string, workshopId: string, data: TransferPayload) {
  return callRpc<string>("gw_create_transfer", { p_operator_id: operatorId, p_workshop_id: workshopId, p_data: data });
}

export function setTransferExecuted(operatorId: string, id: string, version: number, executedOn: string | null) {
  return callRpc<number>("gw_set_transfer_executed", {
    p_operator_id: operatorId,
    p_id: id,
    p_version: version,
    p_executed_on: executedOn,
  });
}

export function deleteTransfer(operatorId: string, id: string, version: number) {
  return callRpc<null>("gw_delete_transfer", { p_operator_id: operatorId, p_id: id, p_version: version });
}

export function createCarryover(
  operatorId: string,
  data: {
    origin_workshop_id: string;
    destination_workshop_id: string;
    debtor: Party;
    creditor: Party;
    amount_cents: number;
    notes: string | null;
  },
) {
  return callRpc<string>("gw_create_carryover", { p_operator_id: operatorId, p_data: data });
}

export function deleteCarryover(operatorId: string, id: string, version: number) {
  return callRpc<null>("gw_delete_carryover", { p_operator_id: operatorId, p_id: id, p_version: version });
}

/** Solo admin (D18): il controllo di ruolo è nell'azione. */
export function setPeonyPct(operatorId: string, workshopId: string, version: number, peonyPct: number) {
  return callRpc<number>("gw_set_peony_pct", {
    p_operator_id: operatorId,
    p_workshop_id: workshopId,
    p_version: version,
    p_peony_pct: peonyPct,
  });
}

/** D6: perdita sostenuta da Peony (null = da decidere). */
export function setLossPeony(operatorId: string, workshopId: string, version: number, lossCents: number | null) {
  return callRpc<number>("gw_set_loss_peony", {
    p_operator_id: operatorId,
    p_workshop_id: workshopId,
    p_version: version,
    p_loss_peony_cents: lossCents,
  });
}

/** Stato del consuntivo; per "verificato" lo snapshot dei totali calcolati dal server. */
export function setSettlementStatus(
  operatorId: string,
  workshopId: string,
  version: number,
  status: SettlementStatus,
  snapshot: Record<string, number | null> | null,
) {
  return callRpc<number>("gw_set_settlement_status", {
    p_operator_id: operatorId,
    p_workshop_id: workshopId,
    p_version: version,
    p_status: status,
    p_snapshot: snapshot,
  });
}

/** D7 (Fase 4): solo l'organizzatrice. Lo storico non contiene il testo. */
export function setTaxNotes(operatorId: string, workshopId: string, version: number, notes: string | null) {
  return callRpc<number>("gw_set_tax_notes", {
    p_operator_id: operatorId,
    p_workshop_id: workshopId,
    p_version: version,
    p_notes: notes,
  });
}

/** Storico degli export (azione `export`). */
export function logExport(operatorId: string, workshopId: string, format: "xlsx" | "stampa") {
  return callRpc<null>("gw_log_export", { p_operator_id: operatorId, p_workshop_id: workshopId, p_format: format });
}

/**
 * Completa la scheda dal libro soci: riempie SOLO i campi vuoti (nome,
 * cognome, email) con storico; false = niente da riempire. Valori letti dal
 * server (fonti admin), mai dal browser.
 */
export function fillPersonFromMember(
  operatorId: string,
  personId: string,
  fill: { first_name?: string; last_name?: string; email?: string },
) {
  return callRpc<boolean>("gw_fill_person_fields", {
    p_operator_id: operatorId,
    p_person_id: personId,
    p_first_name: fill.first_name ?? null,
    p_last_name: fill.last_name ?? null,
    p_email: fill.email ?? null,
  });
}

// ---------------------------------------------------------------------------
// Eliminazioni (Fase 4b, D22, migrazione 020): logiche, con storico. Ruoli e
// condizioni li controlla chi chiama (le condizioni anche il database).
// ---------------------------------------------------------------------------

export type DeletedEntity = "payment" | "booking" | "person" | "workshop" | "expense" | "transfer" | "carryover";

/** Pagamento con l'eventuale catena della Modifica (rettifiche e originali). */
export function deletePayment(operatorId: string, paymentId: string) {
  return callRpc<number>("gw_delete_payment", { p_operator_id: operatorId, p_payment_id: paymentId });
}

/** Iscrizione senza soldi (pagato netto 0): con lei partecipanti e movimenti a saldo zero. */
export function deleteBooking(operatorId: string, bookingId: string, version: number) {
  return callRpc<null>("gw_delete_booking", { p_operator_id: operatorId, p_booking_id: bookingId, p_version: version });
}

/** 4e (#21): iscrizione e pagamenti insieme (stesso gruppo: un solo "Annulla"). `expectedCents` = pagato netto visto. */
export function deleteBookingWithPayments(operatorId: string, bookingId: string, version: number, expectedCents: number) {
  return callRpc<null>("gw_delete_booking_with_payments", {
    p_operator_id: operatorId,
    p_booking_id: bookingId,
    p_version: version,
    p_expected_cents: expectedCents,
  });
}

/** Solo admin: persona senza iscrizioni attive. */
export function deletePerson(operatorId: string, personId: string, version: number) {
  return callRpc<null>("gw_delete_person", { p_operator_id: operatorId, p_person_id: personId, p_version: version });
}

/** Solo admin: workshop non collegato a Ticket Tailor, con tutto il contenuto. */
export function deleteWorkshop(operatorId: string, workshopId: string, version: number, confirmName: string) {
  return callRpc<null>("gw_delete_workshop", {
    p_operator_id: operatorId,
    p_workshop_id: workshopId,
    p_version: version,
    p_confirm_name: confirmName,
  });
}

/** "Annulla": ripristina ciò che è stato eliminato insieme (solo chi ha eliminato, entro 10 minuti). */
export function restoreDeleted(operatorId: string, entity: DeletedEntity, id: string) {
  return callRpc<null>("gw_restore_deleted", { p_operator_id: operatorId, p_entity: entity, p_id: id });
}

/** Storico di "Segna quota ok" / "Annulla validazione manuale" fatti dal gestionale (migrazione 022). */
export function logMemberValidation(
  operatorId: string,
  personId: string,
  action: "quota_ok" | "annulla_quota_ok",
  data: Record<string, unknown>,
) {
  return callRpc<null>("gw_log_member_validation", {
    p_operator_id: operatorId,
    p_person_id: personId,
    p_action: action,
    p_data: data,
  });
}

// ---------------------------------------------------------------------------
// Richieste di associazione (4d, migrazione 023): per persona e periodo
// associativo; il numero del sollecito lo calcola il database.
// ---------------------------------------------------------------------------

export function addMembershipContact(operatorId: string, personId: string, periodKey: string, sentOn: string, note: string | null) {
  return callRpc<{ id: string; kind: "richiesta" | "sollecito"; number: number }>("gw_add_membership_contact", {
    p_operator_id: operatorId,
    p_person_id: personId,
    p_period_key: periodKey,
    p_sent_on: sentOn,
    p_note: note,
  });
}

/** "Segna come inviata a tutti": tutte o nessuna, nella stessa transazione. */
export function addMembershipContacts(operatorId: string, personIds: string[], periodKey: string, sentOn: string) {
  return callRpc<number>("gw_add_membership_contacts", {
    p_operator_id: operatorId,
    p_person_ids: personIds,
    p_period_key: periodKey,
    p_sent_on: sentOn,
  });
}

export function deleteMembershipContact(operatorId: string, id: string) {
  return callRpc<null>("gw_delete_membership_contact", { p_operator_id: operatorId, p_id: id });
}

export function restoreMembershipContact(operatorId: string, id: string) {
  return callRpc<null>("gw_restore_membership_contact", { p_operator_id: operatorId, p_id: id });
}

// ---------------------------------------------------------------------------
// Parte B2 (migrazione 023): email scritta da Ale e altri nomi delle persone.
// ---------------------------------------------------------------------------

/** "+ Email" nella riga di Ale (null = toglie). Completa la scheda se è vuota. */
export function setEnteredEmail(operatorId: string, participantId: string, email: string | null) {
  return callRpc<null>("gw_set_entered_email", { p_operator_id: operatorId, p_participant_id: participantId, p_email: email });
}

export function addPersonAlias(operatorId: string, personId: string, alias: string) {
  return callRpc<string>("gw_add_person_alias", { p_operator_id: operatorId, p_person_id: personId, p_alias: alias });
}

export function deletePersonAlias(operatorId: string, id: string) {
  return callRpc<null>("gw_delete_person_alias", { p_operator_id: operatorId, p_id: id });
}

/** 4e (#23): "Annulla" dopo aver tolto un altro nome (solo chi l'ha tolto, entro 10 minuti). */
export function restorePersonAlias(operatorId: string, id: string) {
  return callRpc<null>("gw_restore_person_alias", { p_operator_id: operatorId, p_id: id });
}

/** "+ Nuova persona": scheda e altri nomi nella stessa transazione. */
export function createPersonWithAliases(operatorId: string, data: Partial<PersonFields>, aliases: string[]) {
  return callRpc<string>("gw_create_person_with_aliases", { p_operator_id: operatorId, p_data: data, p_aliases: aliases });
}

// ---------------------------------------------------------------------------
// Fase 5 (D27, migrazione 027): presenze
// ---------------------------------------------------------------------------

/** Spunta "Presente" dell'iscrizione (una per iscrizione). Restituisce la nuova versione. */
export function setPresent(operatorId: string, bookingId: string, version: number, present: boolean) {
  return callRpc<number>("gw_set_present", {
    p_operator_id: operatorId,
    p_booking_id: bookingId,
    p_version: version,
    p_present: present,
  });
}

/** Collegamento nominale, esclusivamente per una corrispondenza unica
 * nel libro soci ufficiale senza indirizzo email. */
export function setMembershipNameLink(operatorId:string,personId:string,version:number,nameKey:string|null){
  return callRpc<number>("gw_set_member_name_link",{
    p_operator_id:operatorId,p_person_id:personId,p_version:version,p_name_key:nameKey,
  });
}
