// Box di testo "Scrivi o incolla dagli appunti" (contesto sezione 6, D19–D21).
// Funzione pura: NON salva nulla, produce righe per l'anteprima con i punti
// da chiarire. Il salvataggio è gw_import_roster (tutto o niente).

import { normalizeText, parseEuroToCents } from "./format";
import { autoStatus, paidCents } from "./payments";
import type { BookingStatus, InvoiceStatus, PaymentMethod, PaymentType, Registration } from "./types";

export type ParsedPayment = {
  amountCents: number;
  method: PaymentMethod | null;
  /** true = risposto "Non so": il metodo resta vuoto ma la domanda è chiusa. */
  methodAnswered: boolean;
  paymentType: PaymentType;
  /** Importo successivo al primo senza indicazioni: tipo "altro", da chiarire. */
  typeUncertain: boolean;
  /** 4g (#28): tipo scritto nel testo (saldo/acconto); se manca l'anteprima lo deduce. Presente solo se vero. */
  typeExplicit?: true;
};

export type ParsedRow = {
  /** Numero di riga nel testo (da 1). */
  line: number;
  original: string;
  /** entered_as: il principale per primo, poi l'eventuale partner. */
  people: string[];
  /** 4d (B2): email trovata nella riga per ogni persona (stesso ordine di people), o null. */
  emails: (string | null)[];
  /** Stato scritto nel testo (o prenotato), prima della regola automatica dei pagamenti. */
  baseStatus: BookingStatus;
  feeCents: number | null;
  /** Quota scritta nel testo (`X€/ Y€`): tariffa dedicata. */
  feeCustom: boolean;
  invoiceStatus: InvoiceStatus;
  /** "fattura" senza "ok": Richiesta, da confermare (D9 provvisoria). */
  invoiceUncertain: boolean;
  /** `X€/` senza secondo importo: X preso come pagamento, da confermare. */
  ambiguousSlash: boolean;
  payments: ParsedPayment[];
  notes: string | null;
  /** Avvisi informativi (non domande). */
  warnings: string[];
};

export type Question =
  | { kind: "metodo"; paymentIndex: number }
  | { kind: "tipo"; paymentIndex: number }
  | { kind: "fattura" }
  | { kind: "formato" };

// ---------------------------------------------------------------------------
// Riconoscimento
// ---------------------------------------------------------------------------

const AMOUNT = String.raw`(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
/** `€250`, `€ 250`, `250€`, `250 €`, `250 euro`, `250,50€`. Gruppi: 1 (€ prima) o 2 (€ dopo). */
const AMOUNT_WITH_EURO = String.raw`(?:€\s*(${AMOUNT})|(${AMOUNT})\s*(?:€|euro\b))`;

const RE = {
  space: /[\s,;:]+/y,
  paren: /\(([^)]*)\)?/y,
  slash: new RegExp(String.raw`${AMOUNT_WITH_EURO}\s*\/\s*(?:${AMOUNT_WITH_EURO})?`, "iy"),
  plus: new RegExp(String.raw`\+\s*${AMOUNT_WITH_EURO}`, "iy"),
  amount: new RegExp(AMOUNT_WITH_EURO, "iy"),
  // "+"/"&" seguiti da un nome (non da un numero o da €): partner.
  join: /[+&]\s*(?=[^\s\d€+&])/y,
  word: /[^\s,;:()+&]+/y,
};
const AMOUNT_ANYWHERE = new RegExp(AMOUNT_WITH_EURO, "i");

const METHOD_WORDS: Record<string, PaymentMethod> = {
  cash: "contanti",
  contanti: "contanti",
  contante: "contanti",
  paypal: "paypal",
  pp: "paypal",
  bonifico: "bonifico",
  bon: "bonifico",
  iban: "bonifico",
};

function typeWord(word: string): PaymentType | null {
  if (/^saldat?[oa]$/.test(word) || word === "saldo") return "saldo";
  if (word === "acconto" || word === "anticipo") return "acconto";
  return null;
}

function statusWord(word: string): BookingStatus | null {
  if (/^(cancellat|annullat|disdett)/.test(word)) return "cancellato";
  if (word === "attesa" || word === "waiting") return "lista_attesa";
  if (/^interessat/.test(word) || word === "forse") return "interessato";
  return null;
}

/** Se più parole di stato compaiono nella stessa riga, vince la più "forte". */
const STATUS_PRIORITY: BookingStatus[] = ["cancellato", "lista_attesa", "interessato"];

function isKeyword(word: string): boolean {
  return Boolean(METHOD_WORDS[word] || typeWord(word) || statusWord(word)) || word === "fattura";
}

/** D9 (provvisoria, da confermare con Ale): UNICO punto della regola sulla fattura. */
export function invoiceFromText(hasOk: boolean): { status: InvoiceStatus; uncertain: boolean } {
  return hasOk ? { status: "emessa", uncertain: false } : { status: "richiesta", uncertain: true };
}

function centsFrom(match: RegExpExecArray, group: number): number | null {
  const raw = match[group] ?? match[group + 1];
  if (!raw) return null;
  // "1.200,50" → "1200,50"
  const plain = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw) ? raw.replace(/\./g, "") : raw;
  return parseEuroToCents(plain);
}

type Token =
  | { t: "paren"; inside: string }
  | { t: "slash"; first: number | null; second: number | null }
  | { t: "amount"; cents: number | null; plus: boolean }
  | { t: "join"; raw: string }
  | { t: "word"; raw: string; norm: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const at = (re: RegExp, index: number) => {
    re.lastIndex = index;
    const match = re.exec(text);
    return match ? { match, end: re.lastIndex } : null;
  };

  let index = 0;
  while (index < text.length) {
    let found = at(RE.space, index);
    if (found) {
      index = found.end;
      continue;
    }
    if ((found = at(RE.paren, index))) {
      tokens.push({ t: "paren", inside: found.match[1].trim() });
    } else if ((found = at(RE.slash, index))) {
      tokens.push({ t: "slash", first: centsFrom(found.match, 1), second: centsFrom(found.match, 3) });
    } else if ((found = at(RE.plus, index))) {
      tokens.push({ t: "amount", cents: centsFrom(found.match, 1), plus: true });
    } else if ((found = at(RE.amount, index))) {
      tokens.push({ t: "amount", cents: centsFrom(found.match, 1), plus: false });
    } else if ((found = at(RE.join, index))) {
      tokens.push({ t: "join", raw: found.match[0].trim() });
    } else if ((found = at(RE.word, index))) {
      tokens.push({ t: "word", raw: found.match[0], norm: normalizeText(found.match[0]) });
    } else {
      // Carattere isolato non riconosciuto (es. ")" o "+" da solo): va nelle note.
      tokens.push({ t: "word", raw: text[index], norm: text[index] });
      found = { match: [] as unknown as RegExpExecArray, end: index + 1 };
    }
    index = found.end;
  }
  return tokens;
}

/** Indirizzo email (formato minimo, come la validazione di client e server). */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_IN_TEXT = /[^\s@(),;:<>[\]]+@[^\s@(),;:<>[\]]+\.[^\s@(),;:<>[\]]+/g;

/** Prima email scritta in un testo libero (es. le note dell'iscrizione), o null. */
export function findEmail(text: string | null | undefined): string | null {
  const match = (text ?? "").match(EMAIL_IN_TEXT);
  return match ? match[0].toLowerCase() : null;
}

/**
 * B2: le email scritte dopo il nome si tolgono dalla riga: la prima va al
 * principale, la seconda al partner (in una coppia); le altre restano nelle
 * note. Un'email all'inizio della riga è il nome stesso e resta lì.
 */
function extractEmails(text: string): { text: string; emails: string[] } {
  const emails: string[] = [];
  const rest = text.replace(EMAIL_IN_TEXT, (email, offset: number) => {
    if (text.slice(0, offset).trim() === "") return email;
    emails.push(email.toLowerCase().replace(/\.$/, ""));
    return " ";
  });
  return { text: rest, emails };
}

type DraftPayment = { amountCents: number; method: PaymentMethod | null; type: PaymentType | null };

function parseLine(line: string) {
  const { text, emails } = extractEmails(line);
  const tokens = tokenize(text);
  const people: string[][] = [[]];
  let i = 0;

  // 1. Nome (e partner): fino al primo "(", importo o parola chiave. La prima
  //    parola è sempre un nome.
  while (i < tokens.length) {
    const token = tokens[i];
    const current = people[people.length - 1];
    if (
      token.t === "word" && token.norm === "e" && people.length < 2 && current.length > 0 &&
      tokens[i + 1]?.t === "word" && !isKeyword(tokens[i + 1].norm)
    ) {
      // "Aizen e Franco" significa due partecipanti della stessa iscrizione,
      // come "Aizen + Franco", non un unico nome.
      people.push([]);
      i += 1;
    } else if (token.t === "word" && (current.length === 0 || !isKeyword(token.norm))) {
      current.push(token.raw);
      i += 1;
    } else if (token.t === "join" && people.length < 2 && current.length > 0 && tokens[i + 1]?.t === "word") {
      people.push([]);
      i += 1;
    } else {
      break;
    }
  }

  // 2. Il resto: importi, metodi, tipi, stato, fattura, note.
  const payments: DraftPayment[] = [];
  const statuses = new Set<BookingStatus>();
  const notes: string[] = [];
  const warnings: string[] = [];
  let feeCents: number | null = null;
  let feeCustom = false;
  let ambiguousSlash = false;
  let invoice: { status: InvoiceStatus; uncertain: boolean } | null = null;
  let lastWasPayment = false;
  let pendingType: PaymentType | null = null;

  const addPayment = (cents: number | null) => {
    if (cents === null || cents <= 0) return;
    payments.push({ amountCents: cents, method: null, type: pendingType });
    pendingType = null;
    lastWasPayment = true;
  };
  const nextIsAmount = (k: number) => {
    const next = tokens[k + 1];
    return next?.t === "amount" || next?.t === "slash";
  };

  for (; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.t === "paren") {
      lastWasPayment = false;
      if (/^ig$/i.test(token.inside)) {
        warnings.push("contatto Instagram, handle non indicato");
        continue;
      }
      const amount = AMOUNT_ANYWHERE.exec(token.inside);
      if (!amount) {
        if (token.inside) notes.push(`(${token.inside})`);
        continue;
      }
      addPayment(centsFrom(amount, 1));
      const payment = payments[payments.length - 1];
      for (const raw of token.inside.replace(amount[0], " ").split(/[\s,;:]+/).filter(Boolean)) {
        const word = normalizeText(raw);
        if (payment && METHOD_WORDS[word] && !payment.method) payment.method = METHOD_WORDS[word];
        else if (payment && typeWord(word) && !payment.type) payment.type = typeWord(word);
        else notes.push(raw);
      }
      lastWasPayment = false;
      continue;
    }

    if (token.t === "slash") {
      if (token.second !== null) {
        // X€/ Y€ → quota X (tariffa dedicata), pagamento Y.
        feeCents = token.first;
        feeCustom = token.first !== null;
        if (token.first !== null) warnings.push(`interpretato ${formatEuro(token.first)} come quota`);
        addPayment(token.second);
      } else {
        // X€/ senza secondo importo: X è un pagamento, formato ambiguo.
        ambiguousSlash = true;
        addPayment(token.first);
      }
      continue;
    }

    if (token.t === "amount") {
      addPayment(token.cents);
      continue;
    }

    if (token.t === "join") {
      notes.push(token.raw);
      lastWasPayment = false;
      continue;
    }

    const word = token.norm;
    const last = payments[payments.length - 1];

    if (METHOD_WORDS[word] && last && lastWasPayment && !last.method) {
      last.method = METHOD_WORDS[word];
      continue;
    }

    const type = typeWord(word);
    if (type && nextIsAmount(i)) {
      pendingType = type;
      lastWasPayment = false;
      continue;
    }
    if (type && last && lastWasPayment && !last.type) {
      last.type = type;
      continue;
    }

    lastWasPayment = false;

    if (word === "fattura") {
      const next = tokens[i + 1];
      const hasOk = next?.t === "word" && next.norm === "ok";
      invoice = invoiceFromText(hasOk);
      if (hasOk) i += 1;
      continue;
    }

    const next = tokens[i + 1];
    if (word === "in" && next?.t === "word" && next.norm === "attesa") {
      statuses.add("lista_attesa");
      i += 1;
      continue;
    }

    const status = statusWord(word);
    if (status) {
      statuses.add(status);
      continue;
    }

    notes.push(token.raw);
  }

  const names = people.map((words) => words.join(" ").trim()).filter(Boolean);
  notes.push(...emails.slice(names.length));
  return {
    people: names,
    emails: names.map((_, index) => emails[index] ?? null),
    baseStatus: STATUS_PRIORITY.find((status) => statuses.has(status)) ?? ("prenotato" as BookingStatus),
    feeCents,
    feeCustom,
    invoiceStatus: invoice?.status ?? ("non_richiesta" as InvoiceStatus),
    invoiceUncertain: invoice?.uncertain ?? false,
    ambiguousSlash,
    payments: payments.map(
      (payment, index): ParsedPayment => ({
        amountCents: payment.amountCents,
        method: payment.method,
        methodAnswered: false,
        // Il primo importo senza indicazioni è un acconto; i successivi "altro", da chiarire.
        paymentType: payment.type ?? (index === 0 ? "acconto" : "altro"),
        typeUncertain: payment.type === null && index > 0,
        ...(payment.type ? { typeExplicit: true as const } : {}),
      }),
    ),
    notes: notes.join(" ").trim() || null,
    warnings,
  };
}

function formatEuro(cents: number): string {
  return `${cents % 100 ? (cents / 100).toFixed(2).replace(".", ",") : cents / 100} €`;
}

const NUMBERING = /^\s*(?:\d+\s*[.)]|[-•*–])\s*/;

/**
 * Interpreta il testo incollato. Senza quota esplicita la riga prende la
 * quota standard del workshop (D19); lo stato finale applica la regola
 * automatica dei pagamenti (D21) allo stato scritto.
 */
export function parseRoster(text: string, options: { standardFeeCents: number | null }): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/);
  let seenContent = false;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const numbered = NUMBERING.test(line);
    // Una prima riga senza numerazione né importi di norma è un titolo.
    // Eccezione: "Aizen e Franco" è un'iscrizione di coppia autonoma.
    const simplePair = /^[\p{L}][\p{L}'’.-]*\s+e\s+[\p{L}][\p{L}'’.-]*$/iu.test(line);
    if (!seenContent && !numbered && !AMOUNT_ANYWHERE.test(line) && !simplePair) {
      seenContent = true;
      return;
    }
    seenContent = true;

    const parsed = parseLine(line.replace(NUMBERING, ""));
    if (parsed.people.length === 0) return;

    rows.push({
      line: index + 1,
      original: line,
      ...parsed,
      feeCents: parsed.feeCents ?? options.standardFeeCents,
    });
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Anteprima
// ---------------------------------------------------------------------------

/** Stato finale della riga (come lo salverà gw_apply_auto_status). */
export function rowStatus(row: Pick<ParsedRow, "baseStatus" | "feeCents" | "payments">): BookingStatus {
  return autoStatus(row.baseStatus, row.feeCents, paidCents(row.payments));
}

/**
 * Anteprima (moduli compatti): un solo stato per riga, quello dei pagamenti.
 * Se il testo diceva altro è un punto da chiarire; tenere lo stato del testo
 * si può solo per Interessato e Prenotato a parola (gw_import_roster,
 * forced_status: la scelta a mano vale, D21).
 */
export function statusConflict(
  textStatus: BookingStatus,
  paymentsStatus: BookingStatus,
): { text: BookingStatus; payments: BookingStatus; canKeepText: boolean } | null {
  if (textStatus === paymentsStatus) return null;
  return { text: textStatus, payments: paymentsStatus, canKeepText: textStatus === "interessato" || textStatus === "prenotato" };
}

/** Punti da chiarire ancora aperti, con risposta a un tocco. */
export function rowQuestions(row: ParsedRow): Question[] {
  const questions: Question[] = [];
  if (row.ambiguousSlash) questions.push({ kind: "formato" });
  row.payments.forEach((payment, paymentIndex) => {
    if (!payment.method && !payment.methodAnswered) questions.push({ kind: "metodo", paymentIndex });
    if (payment.typeUncertain) questions.push({ kind: "tipo", paymentIndex });
  });
  if (row.invoiceUncertain) questions.push({ kind: "fattura" });
  return questions;
}

export type ExistingMatch = {
  bookingId: string;
  version: number;
  /** Indici dei pagamenti della riga uguali a uno già registrato (importo, metodo, data). */
  duplicatePayments: number[];
};

/**
 * Riga il cui principale ha lo stesso entered_as normalizzato di una
 * prenotazione esistente → "Aggiorna l'iscrizione esistente". Un pagamento
 * uguale a uno già registrato (importo, metodo, data) è un possibile doppione.
 */
export function findExisting(
  row: Pick<ParsedRow, "people" | "payments">,
  registrations: readonly Pick<Registration, "bookingId" | "version" | "people" | "payments">[],
  paidOn: string,
): ExistingMatch | null {
  const name = normalizeText(row.people[0]);
  if (!name) return null;

  const registration = registrations.find((r) => {
    const primary = r.people.find((p) => p.isPrimary) ?? r.people[0];
    return primary?.enteredAs && normalizeText(primary.enteredAs) === name;
  });
  if (!registration) return null;
  return existingFromRegistration(row, registration, paidOn);
}

/**
 * 4e (#5): stessa "Aggiorna l'iscrizione esistente" di findExisting, per
 * un'iscrizione scelta da Ale ("Sembra già iscritta come «X»" → "Aggiorna
 * quella iscrizione").
 */
export function existingFromRegistration(
  row: Pick<ParsedRow, "payments">,
  registration: Pick<Registration, "bookingId" | "version" | "payments">,
  paidOn: string,
): ExistingMatch {
  const duplicatePayments = row.payments.flatMap((payment, index) =>
    paidOn &&
    registration.payments.some(
      (existing) =>
        existing.kind === "pagamento" &&
        existing.amountCents === payment.amountCents &&
        existing.method === payment.method &&
        existing.paidOn === paidOn,
    )
      ? [index]
      : [],
  );

  return { bookingId: registration.bookingId, version: registration.version, duplicatePayments };
}
