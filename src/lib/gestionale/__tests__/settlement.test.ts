// Consuntivo (00-contesto.md sezione 5, specifica sez. 18 "Consuntivo"):
// formule, casi obbligatori, snapshot della verifica, proprietà su input
// casuali. Importi in centesimi, dati inventati.

import { describe, expect, it } from "vitest";

import { buildAccounts, expensesByCategory, exportFileName, type Expense } from "../accounts";
import {
  computeSettlement,
  isSettled,
  settlementSnapshot,
  snapshotChanges,
  validateLossPeony,
  type SettlementInput,
} from "../settlement";
import type { Party, Registration } from "../types";

const EUR = (euros: number) => Math.round(euros * 100);

function input(partial: Partial<SettlementInput> = {}): SettlementInput {
  return {
    peonyPct: 30,
    lossPeonyCents: null,
    payments: [],
    expenses: [],
    transfers: [],
    carryoversIn: [],
    carryoversOut: [],
    ...partial,
  };
}

const paid = (euros: number, receivedBy: Party) => ({ amountCents: EUR(euros), receivedBy });
const spent = (euros: number, advancedBy: Party) => ({ amountCents: EUR(euros), advancedBy });

describe("casi obbligatori (sezione 5)", () => {
  it("1. esempio della specifica: 3.000 € a R, spese 200 € P + 300 € R, 30/70 → R deve 950 € a P", () => {
    const s = computeSettlement(input({ payments: [paid(3000, "redsabbath")], expenses: [spent(200, "peony"), spent(300, "redsabbath")] }));
    expect(s.ricavi).toBe(EUR(3000));
    expect(s.spese).toBe(EUR(500));
    expect(s.utile).toBe(EUR(2500));
    expect(s.quota).toEqual({ peony: EUR(750), redsabbath: EUR(1750) });
    expect(s.spettanza).toEqual({ peony: EUR(950), redsabbath: EUR(2050) });
    expect(s.posizione).toEqual({ peony: EUR(950), redsabbath: -EUR(950) });
    expect(s.residuo).toBe(EUR(950));
    expect(s.frase).toBe("Ale deve dare 950 € a Peony");
  });

  describe("2. perdita: 1.000 € a R, spese 1.200 € tutte P → utile −200 €", () => {
    const base = { payments: [paid(1000, "redsabbath")], expenses: [spent(1200, "peony")] };

    it("a) perdita di Peony non indicata → nessun residuo, richiesta di ripartizione", () => {
      const s = computeSettlement(input(base));
      expect(s.utile).toBe(-EUR(200));
      expect(s.allocation).toEqual({ kind: "perdita_da_ripartire", perdita: EUR(200) });
      expect(s.quota).toBeNull();
      expect(s.residuo).toBeNull();
      expect(s.frase).toBe("Perdita da ripartire");
      expect(s.avviso).toBe("Perdita di 200 € da ripartire: indica quanta ne sostiene Peony.");
    });

    it("b) Peony sostiene 0 € → R deve 1.200 € a P, R chiude a −200 €", () => {
      const s = computeSettlement(input({ ...base, lossPeonyCents: 0 }));
      expect(s.quota).toEqual({ peony: 0, redsabbath: -EUR(200) });
      expect(s.spettanza?.peony).toBe(EUR(1200));
      expect(s.residuo).toBe(EUR(1200));
      expect(s.frase).toBe("Ale deve dare 1.200 € a Peony");
      // Ale: incassato 1.000 − trasferito 1.200 = −200 = la sua quota.
      expect(s.incassato.redsabbath - s.residuo!).toBe(s.quota!.redsabbath);
    });

    it("c) Peony sostiene 100 € → Quota_P −100 €, Spettanza_P 1.100 €, R deve 1.100 € a P", () => {
      const s = computeSettlement(input({ ...base, lossPeonyCents: EUR(100) }));
      expect(s.quota).toEqual({ peony: -EUR(100), redsabbath: -EUR(100) });
      expect(s.spettanza?.peony).toBe(EUR(1100));
      expect(s.residuo).toBe(EUR(1100));
    });

    it("d) Peony sostiene 250 € → rifiutato (oltre la perdita)", () => {
      const s = computeSettlement(input({ ...base, lossPeonyCents: EUR(250) }));
      expect(s.allocation).toMatchObject({ kind: "da_correggere", reason: "oltre_perdita" });
      expect(s.residuo).toBeNull();
      expect(validateLossPeony(s, EUR(250))).toBe("Indica un importo tra 0 e 200 €.");
      expect(validateLossPeony(s, EUR(200))).toBeNull();
      expect(validateLossPeony(s, 0)).toBeNull();
      expect(validateLossPeony(s, null)).toBeNull();
    });

    it("e) dopo (c) gli incassi salgono a 1.300 € → utile positivo, avviso, nessun residuo finché non si corregge", () => {
      const s = computeSettlement(input({ ...base, payments: [paid(1300, "redsabbath")], lossPeonyCents: EUR(100) }));
      expect(s.utile).toBe(EUR(100));
      expect(s.allocation).toMatchObject({ kind: "da_correggere", reason: "utile_positivo" });
      expect(s.residuo).toBeNull();
      expect(s.avviso).toContain("togli la perdita sostenuta da Peony");
      // Corretto (perdita tolta): torna il calcolo normale.
      expect(computeSettlement(input({ ...base, payments: [paid(1300, "redsabbath")] })).residuo).toBe(EUR(1200 + 30));
      // Anche la perdita che diventa più piccola della quota indicata va corretta.
      const smaller = computeSettlement(input({ ...base, payments: [paid(1150, "redsabbath")], lossPeonyCents: EUR(100) }));
      expect(smaller.allocation).toMatchObject({ kind: "da_correggere", reason: "oltre_perdita" });
      expect(validateLossPeony({ utile: EUR(100) }, EUR(10))).toContain("non è in perdita");
    });
  });

  it("3. ripartizione 40/60", () => {
    const s = computeSettlement(input({ peonyPct: 40, payments: [paid(1000, "redsabbath")] }));
    expect(s.quota).toEqual({ peony: EUR(400), redsabbath: EUR(600) });
    expect(s.residuo).toBe(EUR(400));
  });

  it("4. incassi divisi tra P e R", () => {
    const s = computeSettlement(input({ payments: [paid(600, "peony"), paid(1400, "redsabbath")] }));
    expect(s.incassato).toEqual({ peony: EUR(600), redsabbath: EUR(1400) });
    // Quota_P 600 = già incassati da Peony → nessun conguaglio.
    expect(s.residuo).toBe(0);
    expect(s.frase).toBe("Pari");
    const t = computeSettlement(input({ payments: [paid(1000, "peony"), paid(1000, "redsabbath")] }));
    expect(t.residuo).toBe(-EUR(400));
    expect(t.frase).toBe("Peony deve dare 400 € ad Ale");
  });

  it("5. rimborso a un partecipante pagato da R (movimento negativo)", () => {
    const s = computeSettlement(input({ payments: [paid(1000, "redsabbath"), paid(-200, "redsabbath")] }));
    expect(s.ricavi).toBe(EUR(800));
    expect(s.quota?.peony).toBe(EUR(240));
    expect(s.residuo).toBe(EUR(240));
  });

  it("6. riporto in entrata e in uscita: lo stesso importo non compare due volte", () => {
    // Workshop A: R deve 950 a P → riportato su B.
    const a = input({ payments: [paid(3000, "redsabbath")], expenses: [spent(200, "peony"), spent(300, "redsabbath")] });
    const carry = { debtor: "redsabbath" as Party, creditor: "peony" as Party, amountCents: EUR(950) };
    const origin = computeSettlement({ ...a, carryoversOut: [carry] });
    expect(origin.riportiUscita).toBe(-EUR(950));
    expect(origin.residuo).toBe(0);

    const destination = computeSettlement(input({ payments: [paid(100, "peony")], carryoversIn: [carry] }));
    // Su B: posizione −70 (Peony ha incassato 100, quota 30) + riporto 950 = 880.
    expect(destination.riportiEntrata).toBe(EUR(950));
    expect(destination.residuo).toBe(EUR(880));
    // Totale sui due workshop: 950 + (−70) contato una volta sola.
    expect(origin.residuo! + destination.residuo!).toBe(EUR(950) - EUR(70));

    // Credito a favore di Ale in entrata: −importo.
    const towardsAle = computeSettlement(input({ carryoversIn: [{ debtor: "peony", creditor: "redsabbath", amountCents: EUR(50) }] }));
    expect(towardsAle.residuo).toBe(-EUR(50));
  });

  it("7. trasferimento parziale già eseguito (quelli da eseguire non contano)", () => {
    const base = input({ payments: [paid(3000, "redsabbath")], expenses: [spent(200, "peony"), spent(300, "redsabbath")] });
    const s = computeSettlement({
      ...base,
      transfers: [
        { fromParty: "redsabbath", toParty: "peony", amountCents: EUR(500), status: "eseguito" },
        { fromParty: "redsabbath", toParty: "peony", amountCents: EUR(450), status: "da_eseguire" },
      ],
    });
    expect(s.trasferimentiEseguiti).toBe(-EUR(500));
    expect(s.trasferimentiDaEseguire).toBe(EUR(450));
    expect(s.residuo).toBe(EUR(450));
    const back = computeSettlement({ ...base, transfers: [{ fromParty: "peony", toParty: "redsabbath", amountCents: EUR(50), status: "eseguito" }] });
    expect(back.residuo).toBe(EUR(1000));
  });

  it("8. arrotondamento: utile 100,01 € con 30/70 → somma delle quote esatta; utile 0 → quote 0", () => {
    const s = computeSettlement(input({ payments: [{ amountCents: 10001, receivedBy: "redsabbath" }] }));
    expect(s.quota).toEqual({ peony: 3000, redsabbath: 7001 });
    expect(s.quota!.peony + s.quota!.redsabbath).toBe(10001);

    const zero = computeSettlement(input({ payments: [paid(500, "redsabbath")], expenses: [spent(500, "peony")] }));
    expect(zero.utile).toBe(0);
    expect(zero.allocation).toEqual({ kind: "utile" });
    expect(zero.quota).toEqual({ peony: 0, redsabbath: 0 });
    expect(zero.avviso).toBeNull();
    // Peony ha anticipato 500, Ale ha incassato 500 → Ale deve 500.
    expect(zero.residuo).toBe(EUR(500));
    // Con perdita 0 indicata e utile 0: nessuna richiesta, nessun avviso.
    expect(computeSettlement(input({ payments: [paid(500, "redsabbath")], expenses: [spent(500, "peony")], lossPeonyCents: 0 })).residuo).toBe(EUR(500));
  });

  it("8b. percentuali con decimali: arrotondamento al centesimo, metà per eccesso", () => {
    expect(computeSettlement(input({ peonyPct: 33.33, payments: [paid(100, "peony")] })).quota).toEqual({ peony: 3333, redsabbath: 6667 });
    expect(computeSettlement(input({ peonyPct: 50, payments: [{ amountCents: 1, receivedBy: "peony" }] })).quota).toEqual({ peony: 1, redsabbath: 0 });
  });

  it("9. le note fiscali personali non influenzano alcun valore (non fanno parte dell'input)", () => {
    const base = input({ payments: [paid(3000, "redsabbath")], expenses: [spent(500, "peony")] });
    const withNotes = { ...base, personal_tax_notes: "IVA 22%, acconto 1.000 €" } as SettlementInput;
    expect(computeSettlement(withNotes)).toEqual(computeSettlement(base));
  });
});

describe("specifica sez. 18 — Consuntivo", () => {
  it("spese anticipate da entrambe le parti", () => {
    const s = computeSettlement(input({ payments: [paid(2000, "peony")], expenses: [spent(100, "peony"), spent(400, "redsabbath")] }));
    expect(s.anticipato).toEqual({ peony: EUR(100), redsabbath: EUR(400) });
    // Utile 1.500: P 450 + 100 = 550 di spettanza, ha incassato 2.000 → deve 1.450 ad Ale.
    expect(s.spettanza).toEqual({ peony: EUR(550), redsabbath: EUR(1450) });
    expect(s.residuo).toBe(-EUR(1450));
  });

  it("conguaglio già pagato, poi modifica successiva → nuovo residuo", () => {
    const base = input({ payments: [paid(3000, "redsabbath")], expenses: [spent(200, "peony"), spent(300, "redsabbath")] });
    const transfer = { fromParty: "redsabbath" as Party, toParty: "peony" as Party, amountCents: EUR(950), status: "eseguito" as const };
    const paidOff = computeSettlement({ ...base, transfers: [transfer] });
    expect(paidOff.residuo).toBe(0);
    // D24: Saldato si deduce dal residuo, senza stati da premere.
    expect(isSettled(paidOff)).toBe(true);

    // Si aggiunge una spesa di Peony da 100 €: Peony deve ricevere ancora 100 − 30 = 70.
    const later = computeSettlement({ ...base, expenses: [...base.expenses, spent(100, "peony")], transfers: [transfer] });
    expect(later.residuo).toBe(EUR(70));
    expect(later.frase).toBe("Ale deve dare 70 € a Peony");
    // D24: uno sconto o una spesa dell'ultimo momento → torna Aperto da solo.
    expect(isSettled(later)).toBe(false);
  });

  it("utile esattamente zero", () => {
    const s = computeSettlement(input({ payments: [paid(300, "redsabbath")], expenses: [spent(300, "redsabbath")] }));
    expect(s.utile).toBe(0);
    expect(s.quota).toEqual({ peony: 0, redsabbath: 0 });
    expect(s.residuo).toBe(0);
    expect(s.frase).toBe("Pari");
  });

  it("verifica snapshot: modifica dopo la verifica → differenze rilevate (prima → ora)", () => {
    const base = input({ payments: [paid(3000, "redsabbath")], expenses: [spent(200, "peony"), spent(300, "redsabbath")] });
    const verified = settlementSnapshot(computeSettlement(base), null);
    // Il valore salvato passa da jsonb: si confronta dopo un giro in JSON.
    const saved = JSON.parse(JSON.stringify(verified));
    expect(snapshotChanges(saved, settlementSnapshot(computeSettlement(base), null))).toEqual([]);

    const changed = settlementSnapshot(computeSettlement({ ...base, expenses: [...base.expenses, spent(100, "peony")] }), null);
    const diff = snapshotChanges(saved, changed);
    expect(diff.map((d) => d.key)).toEqual(["spese", "utile", "anticipatoPeony", "quotaPeony", "quotaAle", "posizionePeony", "residuo"]);
    expect(diff.find((d) => d.key === "residuo")).toEqual({ key: "residuo", label: "Da trasferire", before: "950 €", after: "1.020 €" });

    const pct = snapshotChanges(saved, settlementSnapshot(computeSettlement({ ...base, peonyPct: 40 }), null));
    expect(pct.find((d) => d.key === "peonyPct")).toMatchObject({ before: "30%", after: "40%" });
    expect(snapshotChanges(null, changed)).toEqual([]);
    expect(snapshotChanges("non un oggetto", changed)).toEqual([]);
  });
});

describe("spese per categoria e totali", () => {
  const expense = (id: string, category: Expense["category"], euros: number, advancedBy: Party = "peony"): Expense => ({
    id,
    version: 1,
    description: `Spesa ${id}`,
    amountCents: EUR(euros),
    advancedBy,
    category,
    spentOn: null,
    createdByRole: null,
  });

  it("raggruppa nell'ordine dei pulsanti, con il totale di ogni categoria; i totali coincidono col consuntivo", () => {
    const list = [expense("a", "altro", 10), expense("b", "viaggi", 120), expense("c", "vitto", 40, "redsabbath"), expense("d", "viaggi", 80.5)];
    const groups = expensesByCategory(list);
    expect(groups.map((g) => [g.label, g.totalCents, g.expenses.map((e) => e.id)])).toEqual([
      ["Viaggi", 20050, ["b", "d"]],
      ["Vitto", 4000, ["c"]],
      ["Altro", 1000, ["a"]],
    ]);
    const s = computeSettlement(input({ expenses: list.map((e) => ({ amountCents: e.amountCents, advancedBy: e.advancedBy })) }));
    expect(groups.reduce((sum, g) => sum + g.totalCents, 0)).toBe(s.spese);
    expect(s.anticipato).toEqual({ peony: 21050, redsabbath: 4000 });
  });
});

describe("dati del tab Conti", () => {
  const registration = (id: string, status: Registration["status"], fee: number | null, amounts: [number, Party][], names: string[]): Registration => ({
    bookingId: id,
    version: 1,
    status,
    present: false,
    notes: null,
    invoiceStatus: "non_richiesta",
    agreedFeeCents: fee,
    feeCustom: false,
    createdAt: "2026-10-01T10:00:00Z",
    createdByRole: "organizzatrice",
    people: names.map((enteredAs, i) => ({ participantId: `${id}-${i}`, isPrimary: i === 0, enteredAs, enteredEmail: null, alreadyAs: null })),
    payments: amounts.map(([cents, receivedBy], i) => ({
      id: `${id}-m${i}`,
      kind: cents > 0 ? "pagamento" : "rimborso",
      amountCents: cents,
      paymentType: "acconto",
      paidOn: "2026-10-01",
      method: i === 0 ? "paypal" : null,
      receivedBy,
      description: null,
      correctsPaymentId: null,
      createdAt: "2026-10-01T10:00:00Z",
    })),
  });

  it("entrate per prenotazione (coppia = un importo, cancellate comprese), per metodo, residuo da incassare", () => {
    const data = buildAccounts({
      workshop: {
        id: "w",
        version: 1,
        name: "Luxuria prova",
        startsOn: "2026-11-14",
        endsOn: null,
        peonyPct: 30,
        lossPeonyCents: null,
        status: "provvisorio",
        verifiedSnapshot: null,
        verifiedAt: null,
        verifiedByRole: null,
      },
      registrations: [
        registration("b1", "saldato", 45000, [[20000, "redsabbath"], [25000, "peony"]], ["Aster", "Brina"]),
        registration("b2", "cancellato", 45000, [[10000, "redsabbath"]], ["Corvo"]),
        registration("b3", "acconto", 45000, [[15000, "redsabbath"]], ["Dalia"]),
        registration("b4", "prenotato", null, [], ["Elio"]),
      ],
      expenses: [],
      transfers: [],
      carryoversIn: [],
      carryoversOut: [],
    });
    expect(data.income.map(({ payments, ...row }) => ({ ...row, movimenti: payments.length }))).toEqual([
      { bookingId: "b1", title: "Aster + Brina", cancelled: false, paidCents: 45000, movimenti: 2 },
      { bookingId: "b2", title: "Corvo", cancelled: true, paidCents: 10000, movimenti: 1 },
      { bookingId: "b3", title: "Dalia", cancelled: false, paidCents: 15000, movimenti: 1 },
    ]);
    // D23: stessi numeri della home.
    expect(data.recap).toEqual({ entrate: 70000, uscite: 0, rimane: 70000, daIncassare: 30000 });
    expect(data.settlement.ricavi).toBe(70000);
    expect(data.settlement.incassato).toEqual({ peony: 25000, redsabbath: 45000 });
    expect(data.incomeByMethod).toEqual([
      { method: "paypal", cents: 45000 },
      { method: null, cents: 25000 },
    ]);
    expect(data.outstanding).toEqual({ daPagare: 30000, senzaQuota: 1 });
  });

  it("nome del file Excel", () => {
    expect(exportFileName("LuXuria — Level 2+ Novembre", "2026-11-20")).toBe("consuntivo-luxuria-level-2-novembre-2026-11-20.xlsx");
    expect(exportFileName("***", "2026-11-20")).toBe("consuntivo-workshop-2026-11-20.xlsx");
  });
});

describe("proprietà (200 input casuali)", () => {
  // Generatore deterministico: i fallimenti si riproducono.
  function rng(seed: number) {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
  }

  it("Posizione_P + Posizione_R = 0 e Quota_P + Quota_R = Utile", () => {
    const random = rng(20261028);
    const int = (max: number) => Math.floor(random() * (max + 1));
    const party = (): Party => (random() < 0.5 ? "peony" : "redsabbath");
    let losses = 0;

    for (let i = 0; i < 200; i++) {
      const base = input({
        peonyPct: int(10000) / 100,
        payments: Array.from({ length: int(8) }, () => ({ amountCents: int(200000) - (random() < 0.15 ? 250000 : 0), receivedBy: party() })),
        expenses: Array.from({ length: int(6) }, () => ({ amountCents: 1 + int(150000), advancedBy: party() })),
        transfers: Array.from({ length: int(2) }, () => {
          const from = party();
          return { fromParty: from, toParty: from === "peony" ? ("redsabbath" as Party) : ("peony" as Party), amountCents: 1 + int(50000), status: random() < 0.5 ? ("eseguito" as const) : ("da_eseguire" as const) };
        }),
        carryoversIn: Array.from({ length: int(1) }, () => ({ debtor: "redsabbath" as Party, creditor: "peony" as Party, amountCents: 1 + int(30000) })),
      });
      const utile = computeSettlement(base).utile;
      // Utile positivo: percentuali; negativo: perdita di Peony valida (0 … |Utile|).
      const s = computeSettlement(utile < 0 ? { ...base, lossPeonyCents: int(-utile) } : base);
      if (utile < 0) losses++;

      expect(s.quota, `caso ${i}`).not.toBeNull();
      expect(s.posizione!.peony + s.posizione!.redsabbath, `caso ${i}`).toBe(0);
      expect(s.quota!.peony + s.quota!.redsabbath, `caso ${i}`).toBe(s.utile);
      expect(Number.isInteger(s.quota!.peony) && Number.isInteger(s.residuo), `caso ${i}`).toBe(true);
    }
    // Il generatore copre entrambi i rami.
    expect(losses).toBeGreaterThan(10);
    expect(losses).toBeLessThan(190);
  });
});
