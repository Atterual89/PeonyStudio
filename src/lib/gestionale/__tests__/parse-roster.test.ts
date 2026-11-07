// Parser del box di testo (contesto sezione 6). Nomi inventati.

import { describe, expect, it } from "vitest";

import { findExisting, parseRoster, rowQuestions, rowStatus, statusConflict, type ParsedRow } from "../parse-roster";
import type { Registration } from "../types";

const STANDARD = 50000;

const FIXTURE = `Level 2+ November

1. Aster (300€) ex Masterclass +200€ cash
2. Bruma Vale (225€) ex Level 2 ok cancellata ma ha pagato anticipo
3. Corvo (250€ paypal) fattura ok +250€ cash
4. Dalia €250 fattura ok +250€ cash
5. Elio €250 fattura ok +250€ cash
6. Fiamma (IG) 580€/ 180€ fattura ok +400€ cash
7. Gaia Monti (IG) 180€/ fattura ok +400€ cash
`;

function parse(text: string) {
  return parseRoster(text, { standardFeeCents: STANDARD });
}

/** Riga compatta per confrontarla con la tabella attesa del contesto. */
function summary(row: ParsedRow) {
  return {
    people: row.people,
    status: rowStatus(row),
    fee: row.feeCents === null ? null : row.feeCents / 100,
    custom: row.feeCustom,
    payments: row.payments.map((p) => `${p.amountCents / 100} ${p.method ?? "?"} ${p.paymentType}`),
    invoice: row.invoiceStatus,
    notes: row.notes,
    questions: rowQuestions(row).map((q) => q.kind),
  };
}

describe("fixture della sezione 6", () => {
  const rows = parse(FIXTURE);

  it("titolo ignorato, 7 righe", () => {
    expect(rows.map((r) => r.line)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it("corrisponde alla tabella attesa", () => {
    expect(rows.map(summary)).toEqual([
      {
        people: ["Aster"],
        status: "saldato",
        fee: 500,
        custom: false,
        payments: ["300 ? acconto", "200 contanti altro"],
        invoice: "non_richiesta",
        notes: "ex Masterclass",
        questions: ["metodo", "tipo"],
      },
      {
        people: ["Bruma Vale"],
        status: "cancellato",
        fee: 500,
        custom: false,
        payments: ["225 ? acconto"],
        invoice: "non_richiesta",
        notes: "ex Level 2 ok ma ha pagato anticipo",
        questions: ["metodo"],
      },
      {
        people: ["Corvo"],
        status: "saldato",
        fee: 500,
        custom: false,
        payments: ["250 paypal acconto", "250 contanti altro"],
        invoice: "emessa",
        notes: null,
        questions: ["tipo"],
      },
      {
        people: ["Dalia"],
        status: "saldato",
        fee: 500,
        custom: false,
        payments: ["250 ? acconto", "250 contanti altro"],
        invoice: "emessa",
        notes: null,
        questions: ["metodo", "tipo"],
      },
      {
        people: ["Elio"],
        status: "saldato",
        fee: 500,
        custom: false,
        payments: ["250 ? acconto", "250 contanti altro"],
        invoice: "emessa",
        notes: null,
        questions: ["metodo", "tipo"],
      },
      {
        people: ["Fiamma"],
        status: "saldato",
        fee: 580,
        custom: true,
        payments: ["180 ? acconto", "400 contanti altro"],
        invoice: "emessa",
        notes: null,
        questions: ["metodo", "tipo"],
      },
      {
        people: ["Gaia Monti"],
        status: "saldato",
        fee: 500,
        custom: false,
        payments: ["180 ? acconto", "400 contanti altro"],
        invoice: "emessa",
        notes: null,
        questions: ["formato", "metodo", "tipo"],
      },
    ]);
  });

  it("avvisi: (IG) e quota interpretata", () => {
    expect(rows[5].warnings).toEqual(["contatto Instagram, handle non indicato", "interpretato 580 € come quota"]);
    expect(rows[6].warnings).toEqual(["contatto Instagram, handle non indicato"]);
    expect(rows[6].ambiguousSlash).toBe(true);
  });
});

describe("regole aggiuntive della Fase 3", () => {
  it("coppia con + e con &; il primo è il principale", () => {
    const [plus, amp] = parse("1. Lino + Mara Rossi (300€ paypal)\n2. Ombra & Nube 200€");
    expect(plus.people).toEqual(["Lino", "Mara Rossi"]);
    expect(plus.payments).toHaveLength(1);
    expect(amp.people).toEqual(["Ombra", "Nube"]);
  });

  it("coppia con 'e', anche in una nota breve senza importi: entrambi sono persone", () => {
    const [first, second] = parse("1. aizen e Franco 200€ paypal\n2. Mario Rossi e Luca Verdi");
    expect(first.people).toEqual(["aizen", "Franco"]);
    expect(first.emails).toEqual([null, null]);
    expect(first.payments[0].amountCents).toBe(20000);
    expect(second.people).toEqual(["Mario Rossi", "Luca Verdi"]);
    expect(second.feeCents).toBe(STANDARD);
    expect(second.notes).toBeNull();
    expect(parse("aizen e Franco")[0].people).toEqual(["aizen", "Franco"]);
    // Stato e metodo di pagamento continuano ad essere riconosciuti.
    expect(parse("1. Aizen e Franco cancellata")[0].baseStatus).toBe("cancellato");
  });

  it("+200€ non è un partner", () => {
    const [row] = parse("1. Lino +200€ cash");
    expect(row.people).toEqual(["Lino"]);
    expect(row.payments[0]).toMatchObject({ amountCents: 20000, method: "contanti", paymentType: "acconto" });
    const [spaced] = parse("1. Lino + 200 € bonifico");
    expect(spaced.people).toEqual(["Lino"]);
    expect(spaced.payments[0]).toMatchObject({ amountCents: 20000, method: "bonifico" });
  });

  it("'interessata' e 'in attesa'", () => {
    const [interested, waiting, waiting2] = parse("1. Rugiada interessata\n2. Selce in attesa\n3. Tufo waiting list");
    expect(rowStatus(interested)).toBe("interessato");
    expect(interested.notes).toBeNull();
    expect(rowStatus(waiting)).toBe("lista_attesa");
    expect(waiting.notes).toBeNull();
    expect(rowStatus(waiting2)).toBe("lista_attesa");
    expect(waiting2.notes).toBe("list");
  });

  it("interessata con pagamento: la regola automatica la porta ad acconto", () => {
    const [row] = parse("1. Rugiada interessata 100€ pp");
    expect(row.baseStatus).toBe("interessato");
    expect(rowStatus(row)).toBe("acconto");
  });

  it("acconto e saldo espliciti, prima o dopo l'importo", () => {
    const [row] = parse("1. Lucciola acconto 200€ paypal +300€ saldo cash");
    expect(row.payments.map((p) => [p.amountCents, p.method, p.paymentType, p.typeUncertain])).toEqual([
      [20000, "paypal", "acconto", false],
      [30000, "contanti", "saldo", false],
    ]);
    expect(row.notes).toBeNull();
    expect(rowStatus(row)).toBe("saldato");
  });

  it("quota dedicata X€/ Y€", () => {
    const [row] = parse("1. Pervinca 400€/ 100€ bonifico");
    expect(row).toMatchObject({ feeCents: 40000, feeCustom: true });
    expect(row.payments).toEqual([{ amountCents: 10000, method: "bonifico", methodAnswered: false, paymentType: "acconto", typeUncertain: false }]);
    expect(rowStatus(row)).toBe("acconto");
  });

  it("importo con virgola, € prima e dopo, 'euro', migliaia", () => {
    const [comma, before, after, word, thousands] = parse(
      "1. Uno 250,50€\n2. Due € 99\n3. Tre 120 €\n4. Quattro 75 euro contanti\n5. Cinque 1.200,50€",
    );
    expect(comma.payments[0].amountCents).toBe(25050);
    expect(before.payments[0].amountCents).toBe(9900);
    expect(after.payments[0].amountCents).toBe(12000);
    expect(word.payments[0]).toMatchObject({ amountCents: 7500, method: "contanti" });
    expect(thousands.payments[0].amountCents).toBe(120050);
  });

  it("accenti: nel nome restano, le parole chiave si riconoscono", () => {
    const [row] = parse("1. Noèmi Àlvarez (200€) CANCELLÀTA");
    expect(row.people).toEqual(["Noèmi Àlvarez"]);
    expect(rowStatus(row)).toBe("cancellato");
  });

  it("'fattura' senza ok → Richiesta da chiarire", () => {
    const [row] = parse("1. Brezza 200€ cash fattura");
    expect(row).toMatchObject({ invoiceStatus: "richiesta", invoiceUncertain: true });
    expect(rowQuestions(row).map((q) => q.kind)).toEqual(["fattura"]);
  });

  it("senza quota standard la quota resta vuota (Ale non può importare senza quota)", () => {
    const [row] = parseRoster("1. Vento 100€", { standardFeeCents: null });
    expect(row.feeCents).toBeNull();
    expect(rowStatus(row)).toBe("acconto");
  });
});

describe("iscrizione già presente", () => {
  const registrations: Pick<Registration, "bookingId" | "version" | "people" | "payments">[] = [
    {
      bookingId: "b-1",
      version: 3,
      people: [{ participantId: "x", isPrimary: true, enteredAs: "Àster", enteredEmail: null, alreadyAs: null }],
      payments: [
        {
          id: "p-1",
          kind: "pagamento",
          amountCents: 30000,
          paymentType: "acconto",
          paidOn: "2026-10-05",
          method: null,
          receivedBy: "redsabbath",
          description: null,
          correctsPaymentId: null,
          createdAt: "2026-10-05T10:00:00Z",
        },
      ],
    },
  ];

  it("stesso entered_as normalizzato → aggiorna; pagamento uguale (importo, metodo, data) → possibile doppione", () => {
    const [row] = parse("1. aster (300€) +200€ cash");
    expect(findExisting(row, registrations, "2026-10-05")).toEqual({ bookingId: "b-1", version: 3, duplicatePayments: [0] });
    // Data diversa: nessun doppione.
    expect(findExisting(row, registrations, "2026-10-06")?.duplicatePayments).toEqual([]);
    expect(findExisting(parse("1. Altra 100€")[0], registrations, "2026-10-05")).toBeNull();
  });
});

describe("moduli compatti: un solo stato per riga nell'anteprima", () => {
  it("se il testo dice uno stato e i pagamenti un altro è un punto da chiarire; il testo si tiene solo per Interessato / Prenotato", () => {
    const [row] = parseRoster("Brezza prenotata 500€ cash", { standardFeeCents: 50000 });
    expect(row.baseStatus).toBe("prenotato");
    expect(rowStatus(row)).toBe("saldato");
    expect(statusConflict(row.baseStatus, rowStatus(row))).toEqual({ text: "prenotato", payments: "saldato", canKeepText: true });
    expect(statusConflict("cancellato", "cancellato")).toBeNull();
    expect(statusConflict("lista_attesa", "acconto")?.canKeepText).toBe(false);
  });
});
