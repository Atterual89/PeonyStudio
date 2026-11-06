import { describe, expect, it } from "vitest";

import { centsToInput, formatCents, parseEuroToCents } from "../format";
import { CONFIRMED_STATUSES, ORPHAN_EVENT_LABEL, UNLINKED_EVENT_LABEL, isConfirmed } from "../labels";
import type { LuxuriaEvent, Workshop } from "../types";
import {
  buildDashboard,
  countBookings,
  groupByTime,
  isLuxuriaTitle,
  secondPartyPct,
  temporalStatus,
  timestampToRomeDate,
  toWorkshopView,
  todayInRome,
  validateWorkshopSettings,
} from "../workshops";

function workshop(fields: Partial<Workshop> & { id: string }): Workshop {
  return {
    event_id: null,
    name: "Copia",
    starts_on: "2026-01-01",
    ends_on: null,
    description: null,
    capacity: null,
    default_fee_cents: null,
    peony_pct: 30,
    version: 1,
    ...fields,
  };
}

describe("D14 — eventi LuXuria", () => {
  it("riconosce 'LuXuria' senza distinzione di maiuscole; gli altri eventi no", () => {
    expect(isLuxuriaTitle("SOLD OUT - Kinbaku Luxuria Level 1 - workshop")).toBe(true);
    expect(isLuxuriaTitle("Kinbaku LUXURIA - Body Handling")).toBe(true);
    expect(isLuxuriaTitle("Jam del giovedì")).toBe(false);
    expect(isLuxuriaTitle(null)).toBe(false);
  });

  it("date di events (UTC) convertite nella data di Roma", () => {
    // Come salvate dalla sincronizzazione Ticket Tailor: mezzanotte italiana in UTC.
    expect(timestampToRomeDate("2026-09-24T23:00:00+00:00")).toBe("2026-09-25");
    expect(timestampToRomeDate("2027-02-18T23:00:00+00:00")).toBe("2027-02-19");
    expect(timestampToRomeDate(null)).toBeNull();
    expect(timestampToRomeDate("non-una-data")).toBeNull();
  });

  it("dashboard: tutti gli eventi LuXuria, con o senza riga gestionale; conteggi per prenotazione", () => {
    const events: LuxuriaEvent[] = [
      { id: "ev-1", name: "Luxuria Level 1", startsOn: "2026-11-14", endsOn: "2026-11-15" },
      { id: "ev-2", name: "Luxuria Level 2", startsOn: "2027-02-06", endsOn: null },
    ];
    const workshops = [workshop({ id: "w-1", event_id: "ev-1", capacity: 10 })];
    const entries = buildDashboard(events, workshops, new Map([["w-1", countBookings(["prenotato", "acconto"])]]));

    expect(entries.map((e) => [e.name, e.href, e.counts.iscrizioni, e.capacity])).toEqual([
      ["Luxuria Level 1", "/gestione/e/ev-1", 2, 10],
      ["Luxuria Level 2", "/gestione/e/ev-2", 0, null],
    ]);
  });

  it("evento sparito da Ticket Tailor: il workshop resta con l'etichetta; senza evento: etichetta diversa", () => {
    const workshops = [
      workshop({ id: "w-1", event_id: "ev-sparito", name: "Luxuria passato", starts_on: "2026-03-01" }),
      workshop({ id: "w-2", event_id: null, name: "Prova manuale" }),
    ];
    const entries = buildDashboard([], workshops, new Map());
    expect(entries.map((e) => [e.name, e.href, e.notice])).toEqual([
      ["Luxuria passato", "/gestione/w/w-1", ORPHAN_EVENT_LABEL],
      ["Prova manuale", "/gestione/w/w-2", UNLINKED_EVENT_LABEL],
    ]);
  });

  it("nome e date si leggono dall'evento, non dalla copia salvata", () => {
    const view = toWorkshopView(workshop({ id: "w-1", event_id: "ev-1", name: "Vecchio", starts_on: "2026-01-01" }), {
      id: "ev-1",
      name: "Nuovo nome",
      startsOn: "2026-11-14",
      endsOn: "2026-11-15",
    });
    expect([view.displayName, view.startsOn, view.endsOn, view.eventNotice]).toEqual(["Nuovo nome", "2026-11-14", "2026-11-15", null]);
  });
});

describe("D15/D16 — conteggi e stati", () => {
  it("si contano le prenotazioni: una coppia confermata conta 1", () => {
    // Le righe sono prenotazioni (una per coppia), non persone.
    expect(countBookings(["prenotato", "acconto", "saldato", "interessato", "lista_attesa", "cancellato"])).toEqual({
      iscrizioni: 3,
      lista_attesa: 1,
      interessati: 1,
      cancellati: 1,
    });
  });

  it("'confermati' = prenotato + acconto + saldato", () => {
    expect(CONFIRMED_STATUSES).toEqual(["prenotato", "acconto", "saldato"]);
    expect(isConfirmed("interessato")).toBe(false);
    expect(isConfirmed("lista_attesa")).toBe(false);
    expect(isConfirmed("saldato")).toBe(true);
  });
});

describe("stato temporale (fuso Europe/Rome)", () => {
  it("usa la data di Roma, non quella UTC", () => {
    expect(todayInRome(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
    expect(todayInRome(new Date("2026-06-30T22:30:00Z"))).toBe("2026-07-01");
  });

  it("prossimo / in corso / passato e ordinamento", () => {
    const today = "2026-11-14";
    expect(temporalStatus({ startsOn: "2026-11-15", endsOn: "2026-11-16" }, today)).toBe("prossimo");
    expect(temporalStatus({ startsOn: "2026-11-13", endsOn: "2026-11-15" }, today)).toBe("in_corso");
    expect(temporalStatus({ startsOn: "2026-11-12", endsOn: "2026-11-13" }, today)).toBe("passato");

    const groups = groupByTime(
      [
        { startsOn: "2026-12-01", endsOn: null },
        { startsOn: "2026-11-20", endsOn: null },
        { startsOn: "2026-01-10", endsOn: null },
        { startsOn: "2026-05-10", endsOn: null },
      ],
      today,
    );
    expect(groups.prossimo.map((w) => w.startsOn)).toEqual(["2026-11-20", "2026-12-01"]);
    expect(groups.passato.map((w) => w.startsOn)).toEqual(["2026-05-10", "2026-01-10"]);
  });
});

describe("impostazioni (tab Info)", () => {
  it("capienza, quota standard in centesimi, percentuale 0–100", () => {
    const ok = validateWorkshopSettings({ description: " ", capacity: "12", default_fee: "250,50", peony_pct: "30" });
    expect(ok.ok && ok.payload).toEqual({ description: null, capacity: 12, default_fee_cents: 25050, peony_pct: 30 });

    const ko = validateWorkshopSettings({ description: "", capacity: "0", default_fee: "abc", peony_pct: "120" });
    expect(ko.ok).toBe(false);
    if (!ko.ok) expect(Object.keys(ko.errors).sort()).toEqual(["capacity", "default_fee", "peony_pct"]);
  });

  it("percentuale della seconda parte calcolata", () => {
    expect(secondPartyPct("30")).toBe("70");
    expect(secondPartyPct("33,5")).toBe("66,5");
    expect(secondPartyPct("abc")).toBe("—");
  });
});

describe("importi", () => {
  it("converte '250' e '250,50' in centesimi senza float", () => {
    expect(parseEuroToCents("250")).toBe(25000);
    expect(parseEuroToCents("250,50")).toBe(25050);
    expect(parseEuroToCents("€ 0,10")).toBe(10);
    expect(parseEuroToCents("")).toBeNull();
    expect(parseEuroToCents("12,345")).toBeNull();
    expect(parseEuroToCents("-5")).toBeNull();
  });

  it("formatta e riconverte", () => {
    expect(formatCents(25050)).toBe("250,50 €");
    expect(formatCents(100000)).toBe("1.000 €");
    expect(centsToInput(25050)).toBe("250,50");
    expect(centsToInput(null)).toBe("");
  });
});
