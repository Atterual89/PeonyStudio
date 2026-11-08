// Tipi condivisi tra server e componenti del gestionale (solo tipi).
// Le etichette per l'interfaccia stanno in labels.ts.

export type Party = "peony" | "redsabbath";

/** D16. "Confermati" = prenotato + acconto + saldato (labels.ts). */
export type BookingStatus = "interessato" | "prenotato" | "acconto" | "saldato" | "lista_attesa" | "cancellato";

/** D18. */
export type OperatorRole = "admin" | "organizzatrice";

/** D20: come la persona scritta da Ale è stata collegata. */
export type MatchStatus = "automatico" | "da_abbinare" | "confermato";

export type InvoiceStatus = "non_richiesta" | "richiesta" | "emessa";
export type PaymentKind = "pagamento" | "rimborso" | "rettifica";
export type PaymentMethod = "contanti" | "paypal" | "bonifico" | "altro";
/** D21: tipo visibile del movimento, separato dal kind tecnico. */
export type PaymentType = "acconto" | "saldo" | "altro";

/** Fase 4: categoria della spesa (gw_expense_category). */
export type ExpenseCategory = "viaggi" | "vitto" | "alloggio" | "sala" | "materiali" | "altro";
export type TransferStatus = "da_eseguire" | "eseguito";
export type CarryoverStatus = "aperto" | "chiuso";
/**
 * D24 (4e, migrazione 024): gli stati manuali sono solo Provvisorio e
 * Verificato; "Saldato" / "Aperto · da trasferire X" si deducono dal residuo.
 * da_conguagliare e conguagliato restano nell'enum Postgres ma non si usano
 * più (settlementStatusOf li legge come verificato).
 */
export type SettlementStatus = "provvisorio" | "verificato";

/** Movimento di gw_payments (append-only). */
export type Payment = {
  id: string;
  kind: PaymentKind;
  amountCents: number;
  paymentType: PaymentType;
  /** null = data non indicata (026). */
  paidOn: string | null;
  method: PaymentMethod | null;
  receivedBy: Party;
  description: string | null;
  correctsPaymentId: string | null;
  createdAt: string;
};

/** Riga di gw_workshops. name/starts_on/ends_on sono la copia dei dati dell'evento (D14). */
export type Workshop = {
  id: string;
  event_id: string | null;
  name: string;
  starts_on: string;
  ends_on: string | null;
  description: string | null;
  capacity: number | null;
  default_fee_cents: number | null;
  peony_pct: number;
  version: number;
};

/** Evento LuXuria letto (in sola lettura) dalla tabella `events` del sito. */
export type LuxuriaEvent = {
  id: string;
  name: string;
  /** Date nel fuso Europe/Rome (YYYY-MM-DD). */
  startsOn: string;
  endsOn: string | null;
};

/** Workshop come si mostra: nome e date dall'evento, se esiste ancora (D14). */
export type WorkshopView = Workshop & {
  displayName: string;
  startsOn: string;
  endsOn: string | null;
  /** null = collegato a un evento ancora presente. */
  eventNotice: string | null;
};

/** Conteggi per prenotazione (D15): una coppia conta 1. */
export type BookingCounts = {
  iscrizioni: number;
  lista_attesa: number;
  interessati: number;
  cancellati: number;
};

export type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  email: string | null;
  instagram: string | null;
  phone: string | null;
  teamartist_id: string | null;
  notes: string | null;
  /** Solo righe manual_override del libro soci (D11, 016). */
  association_member_id: string | null;
  /** Chiave del socio come la usa la pagina admin (email) per libro soci e modulo (016). */
  membership_email: string | null;
  /** Collegamento esplicito a un socio senza email, nel libro ufficiale. */
  membership_name_key?: string | null;
  merged_into: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type PersonFields = Pick<
  Person,
  "first_name" | "last_name" | "nickname" | "email" | "instagram" | "phone" | "teamartist_id" | "notes"
>;

export const PERSON_FIELD_LABELS: Record<keyof PersonFields, string> = {
  nickname: "Nickname",
  first_name: "Nome",
  last_name: "Cognome",
  email: "Email",
  instagram: "Instagram",
  phone: "Telefono",
  teamartist_id: "ID TeamArtist",
  notes: "Note",
};

/**
 * D11 (016): stato socio come nella pagina admin (deriveMembershipState) per
 * il periodo associativo che contiene l'inizio del workshop. Le validazioni
 * manuali ("Quota ok", righe manual_override) danno `match: "manual"`.
 * gw_membership_overrides non si usa più (migrazione 022).
 * `paymentsFrom` = inizio pagamenti del periodo associativo del workshop
 * (membership-periods.ts), per "Quota non registrata dal …"; null se il
 * workshop è prima del primo periodo.
 */
export type MembershipBadge =
  | { kind: "in_regola"; expiresAt: string | null; match: "email" | "name" | "manual" | null }
  | { kind: "quota_mancante"; paymentsFrom: string | null }
  | { kind: "modulo_mancante" }
  /** 017: nessun collegamento esplicito al libro soci e nessuna riga trovata dall'abbinamento admin. */
  | { kind: "non_collegata" };

/** Una persona dentro una prenotazione. */
export type BookingPersonView = {
  participantId: string;
  isPrimary: boolean;
  /** D20: testo scritto da Ale (null se inserita da un admin con la ricerca). */
  enteredAs: string | null;
  /** 4d (B2): email scritta da Ale; se diversa da quella della scheda, "Ale ha indicato: … — usa questa". */
  enteredEmail: string | null;
  matchStatus: MatchStatus;
  /** Persona già iscritta a cui il testo corrispondeva: "possibile doppia iscrizione". */
  possibleDuplicate: { id: string; displayName: string } | null;
  /** Socio collegato (solo nome, cognome, email, scadenza), per "Nel libro soci: …". */
  member: MemberSummary | null;
  person: Person;
  displayName: string;
  /** "Nome Cognome" dalla scheda o, se lì manca, dal socio collegato; null se non c'è (solo admin). */
  fullName: string | null;
  membership: MembershipBadge;
  /** 4d: richieste di associazione e solleciti validi del periodo del workshop, dal più vecchio. */
  contacts: MembershipContact[];
};

/** 4d (migrazione 023): contatto per chiedere l'iscrizione; number 0 = richiesta, 1.. = solleciti. */
export type MembershipContact = {
  id: string;
  periodKey: string;
  kind: "richiesta" | "sollecito";
  number: number;
  sentOn: string;
  note: string | null;
};

/** Una prenotazione come la mostra il tab Partecipanti (D15): principale per primo. */
export type BookingView = {
  bookingId: string;
  version: number;
  status: BookingStatus;
  /** D27: spunta "Presente", una per iscrizione (una coppia = 1). */
  present: boolean;
  notes: string | null;
  agreedFeeCents: number | null;
  feeCustom: boolean;
  payments: Payment[];
  /** Operatore che ha creato la prenotazione (null = script o operatore rimosso). */
  createdBy: { displayName: string; role: OperatorRole } | null;
  people: BookingPersonView[];
  formerPartners: { displayName: string; removedAt: string }[];
};

/**
 * Socio come lo vede la pagina admin, mostrato nel gestionale: mai dati
 * sensibili. `id` è una chiave (member-key.ts): "m:<id>" validazione manuale
 * della tabella, "e:<email>" o "n:<nome cognome>" libro soci / modulo.
 */
export type MemberSummary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  expires_at: string | null;
  source: "manuale" | "libro" | "modulo";
  /** false = nome e cognome in un campo unico che non si sa separare (tutto in first_name). */
  name_split: boolean;
  /** Solo nei risultati della ricerca (4d): stato tessera che risulterebbe collegando la persona. */
  outcome?: MembershipBadge;
  /** Solo nei risultati della ricerca: il socio è nel libro soci (non solo nel modulo). */
  in_book?: boolean;
  /** True se questa fonte compare già in un abbinamento del gestionale. */
  alreadyLinked?: boolean;
  /** Nome inserito in una scheda persona o da Ale che ha prodotto il risultato. */
  matchedAlias?: string | null;
};

/**
 * Una prenotazione come la vede l'organizzatrice (D18): SOLO testo scritto da
 * Ale e dati economici, mai campi di gw_people né del libro soci.
 */
export type Registration = {
  bookingId: string;
  version: number;
  status: BookingStatus;
  /** D27: spunta "Presente", una per iscrizione. */
  present: boolean;
  notes: string | null;
  invoiceStatus: InvoiceStatus;
  agreedFeeCents: number | null;
  feeCustom: boolean;
  createdAt: string;
  /** Ruolo di chi l'ha creata (solo il ruolo, mai il nome): "Inserito da Peony/Ale". */
  createdByRole: OperatorRole | null;
  /**
   * Principale per primo. enteredAs null = inserita da un admin con la ricerca.
   * enteredEmail (4d, B2): SOLO l'email scritta da Ale, mai quella della scheda.
   * alreadyAs (4e, #28): il server ha abbinato la persona a un'altra iscrizione
   * di questo workshop, scritta da Ale così ("Sembra già iscritta come «X»").
   */
  people: { participantId: string; isPrimary: boolean; enteredAs: string | null; enteredEmail: string | null; alreadyAs: string | null }[];
  payments: Payment[];
};

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };
