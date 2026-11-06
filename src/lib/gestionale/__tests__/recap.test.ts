// Recap economico (Fase 4c, D23): stesse definizioni in home, card e tab
// Conti; totali per anno; conguagli da fare. Dati inventati.

import { describe, expect, it } from "vitest";

import {
  availableYears,
  conguagliText,
  homeView,
  inYear,
  parseYearFilter,
  recapLine,
  residuoShort,
  sumRecaps,
  workshopRecap,
  type OverviewRow,
} from "../recap";
import { workshopTabRedirect, resolveWorkshopTab } from "../tabs";

function row(extra: Partial<OverviewRow> = {}): OverviewRow {
  return {
    workshopId: "w1",
    status: "provvisorio",
    paymentCount: 0,
    expenseCount: 0,
    bookings: [],
    verifiedSnapshot: null,
    input: { peonyPct: 30, lossPeonyCents: null, payments: [], expenses: [], transfers: [], carryoversIn: [], carryoversOut: [] },
    ...extra,
  };
}

describe("recap di un workshop", () => {
  it("Entrate = ricavi, Uscite = spese, Rimane = utile; Da incassare senza cancellati né lista d'attesa", () => {
    const recap = workshopRecap(
      row({
        paymentCount: 4,
        expenseCount: 1,
        input: {
          peonyPct: 30,
          lossPeonyCents: null,
          payments: [
            { receivedBy: "redsabbath", amountCents: 70000 },
            { receivedBy: "peony", amountCents: 10000 },
          ],
          expenses: [{ advancedBy: "peony", amountCents: 20000 }],
          transfers: [],
          carryoversIn: [],
          carryoversOut: [],
        },
        bookings: [
          { status: "saldato", agreedFeeCents: 45000, paidCents: 45000 },
          { status: "acconto", agreedFeeCents: 45000, paidCents: 25000 },
          { status: "cancellato", agreedFeeCents: 45000, paidCents: 10000 },
          { status: "lista_attesa", agreedFeeCents: 45000, paidCents: 0 },
          { status: "prenotato", agreedFeeCents: null, paidCents: 0 },
        ],
      }),
    );
    expect(recap).toMatchObject({ entrate: 80000, uscite: 20000, rimane: 60000, daIncassare: 20000, movimenti: true, economic: "aperto" });
    expect(recapLine(recap)).toBe("Entrate 800 € · Spese 200 € · Guadagno 600 €");
  });

  it("senza movimenti: 'Nessun movimento'; utile negativo: Rimane negativo, residuo non calcolato", () => {
    const empty = workshopRecap(row());
    expect(recapLine(empty)).toBe("Nessun movimento");
    expect(recapLine(null)).toBe("Nessun movimento");

    const loss = workshopRecap(
      row({
        paymentCount: 1,
        expenseCount: 1,
        input: { ...row().input, payments: [{ receivedBy: "redsabbath", amountCents: 100000 }], expenses: [{ advancedBy: "peony", amountCents: 120000 }] },
      }),
    );
    expect(loss).toMatchObject({ entrate: 100000, uscite: 120000, rimane: -20000, residuo: null });
    expect(residuoShort(loss.residuo)).toBe("Da dividere");
  });
});

describe("totali della home", () => {
  const a = workshopRecap(
    row({ paymentCount: 1, input: { ...row().input, payments: [{ receivedBy: "redsabbath", amountCents: 300000 }] } }),
  );
  const b = workshopRecap(
    row({
      paymentCount: 1,
      expenseCount: 1,
      input: { ...row().input, payments: [{ receivedBy: "peony", amountCents: 100000 }], expenses: [{ advancedBy: "redsabbath", amountCents: 10000 }] },
    }),
  );

  it("somma dei workshop; conguagli per direzione sui workshop non saldati", () => {
    const totals = sumRecaps([a, b, null]);
    expect(totals).toMatchObject({ entrate: 400000, uscite: 10000, rimane: 390000 });
    expect(a.residuo).toBe(90000);
    expect(b.residuo).toBeLessThan(0);
    expect(totals.conguagli).toEqual({ alePeony: 90000, peonyAle: -b.residuo! });
    // 4g (#2): frasi intere, in seconda persona per Ale.
    const back = (-b.residuo! / 100).toString();
    expect(conguagliText(totals.conguagli)).toBe(`Ale deve dare 900 € a Peony · Peony deve dare ${back} € ad Ale`);
    expect(conguagliText(totals.conguagli, "organizzatrice")).toBe(`Devi dare 900 € a Peony · Peony ti deve ${back} €`);
    expect(conguagliText({ alePeony: 0, peonyAle: 0 })).toBeNull();
    expect(conguagliText({ alePeony: 0, peonyAle: 0 }, "organizzatrice")).toBe("Siete pari");
    expect(residuoShort(a.residuo)).toBe("Ale deve dare 900 € a Peony");
    expect(residuoShort(a.residuo, "organizzatrice")).toBe("Devi dare 900 € a Peony");
  });

  it("anno: quello di inizio; predefinito l'anno corrente; 'Tutti' = tutti", () => {
    const entries = [
      { startsOn: "2026-11-14", recap: a },
      { startsOn: "2027-02-06", recap: b },
    ];
    expect(parseYearFilter(undefined, "2026-10-29")).toBe(2026);
    expect(parseYearFilter("2027", "2026-10-29")).toBe(2027);
    expect(parseYearFilter("tutti", "2026-10-29")).toBe("tutti");
    expect(parseYearFilter("x", "2026-10-29")).toBe(2026);
    const of = (year: number | "tutti") => sumRecaps(entries.filter((e) => inYear(e.startsOn, year)).map((e) => e.recap));
    expect(of(2026).entrate).toBe(300000);
    expect(of(2027).entrate).toBe(100000);
    expect(of("tutti").entrate).toBe(of(2026).entrate + of(2027).entrate);
    expect(availableYears(["2025-09-01", "2027-02-06"], "2026-10-29")).toEqual([2027, 2026, 2025]);
  });
});

describe("tab Pagamenti (D23)", () => {
  it("admin: ?tab=pagamenti → Conti; per Ale resta non consentito", () => {
    expect(workshopTabRedirect("admin", "pagamenti")).toBe("conti");
    expect(resolveWorkshopTab("admin", "pagamenti")).toBeNull();
    expect(workshopTabRedirect("organizzatrice", "pagamenti")).toBeNull();
    expect(resolveWorkshopTab("admin", "conti")).toBe("conti");
  });
});

describe("filtro anno solo sui passati", () => {
  const recap = (entrate: number) =>
    workshopRecap(row({ paymentCount: 1, input: { ...row().input, payments: [{ receivedBy: "redsabbath", amountCents: entrate }] } }));
  const entries = [
    { key: "passato-2025", startsOn: "2025-11-15", endsOn: null, recap: recap(1000) },
    { key: "passato-2026", startsOn: "2026-03-07", endsOn: null, recap: recap(2000) },
    { key: "in-corso-2026", startsOn: "2026-10-28", endsOn: "2026-10-30", recap: recap(4000) },
    { key: "prossimo-2026", startsOn: "2026-12-05", endsOn: null, recap: recap(8000) },
    { key: "prossimo-2027", startsOn: "2027-02-06", endsOn: null, recap: recap(16000) },
  ];
  const keys = (list: readonly { key: string }[]) => list.map((e) => e.key);

  it("In corso e Prossimi sempre tutti, di qualsiasi anno; Passati dell'anno; riquadri dell'anno", () => {
    const view = homeView(entries, 2026, "2026-10-29");
    expect(keys(view.groups.in_corso)).toEqual(["in-corso-2026"]);
    expect(keys(view.groups.prossimo)).toEqual(["prossimo-2026", "prossimo-2027"]);
    expect(keys(view.groups.passato)).toEqual(["passato-2026"]);
    expect(view.totals.entrate).toBe(2000 + 4000 + 8000);

    const past = homeView(entries, 2025, "2026-10-29");
    expect(keys(past.groups.prossimo)).toEqual(["prossimo-2026", "prossimo-2027"]);
    expect(keys(past.groups.passato)).toEqual(["passato-2025"]);
    expect(past.totals.entrate).toBe(1000);
  });

  it("tabella: somma delle righe visibili, 'Totale righe visibili' se diversa dai riquadri", () => {
    const view = homeView(entries, 2026, "2026-10-29");
    expect(keys(view.rows)).toEqual(["in-corso-2026", "prossimo-2026", "prossimo-2027", "passato-2026"]);
    expect(sumRecaps(view.rows.map((e) => e.recap)).entrate).toBe(30000);
    expect(view.totalLabel).toBe("Totale righe visibili");

    const all = homeView(entries, "tutti", "2026-10-29");
    expect(all.rows).toHaveLength(5);
    expect(all.totalLabel).toBe("Totale");
  });
});
