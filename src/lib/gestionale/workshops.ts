// Logica pura dei workshop: eventi LuXuria (D14), stato temporale, conteggi
// per prenotazione (D15), impostazioni modificabili.

import { parseEuroToCents } from "./format";
import { ORPHAN_EVENT_LABEL, UNLINKED_EVENT_LABEL, isConfirmed } from "./labels";
import type { WorkshopRecap } from "./recap";
import type { BookingCounts, BookingStatus, LuxuriaEvent, Workshop, WorkshopView } from "./types";

export type TemporalStatus = "prossimo" | "in_corso" | "passato";

const ROME_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data di oggi (YYYY-MM-DD) nel fuso Europe/Rome. */
export function todayInRome(now: Date = new Date()): string {
  return ROME_DATE.format(now);
}

/** Timestamp di `events` (salvato in UTC) → data nel fuso Europe/Rome. */
export function timestampToRomeDate(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : ROME_DATE.format(date);
}

/** D14: sono workshop gestiti gli eventi il cui nome contiene "LuXuria". */
export function isLuxuriaTitle(title: string | null | undefined): boolean {
  return (title ?? "").toLowerCase().includes("luxuria");
}

type Dated = { startsOn: string; endsOn: string | null };

export function temporalStatus(item: Dated, today: string): TemporalStatus {
  const end = item.endsOn ?? item.startsOn;
  if (item.startsOn > today) return "prossimo";
  if (end < today) return "passato";
  return "in_corso";
}

export function groupByTime<T extends Dated>(items: readonly T[], today: string): Record<TemporalStatus, T[]> {
  const groups: Record<TemporalStatus, T[]> = { prossimo: [], in_corso: [], passato: [] };
  for (const item of items) groups[temporalStatus(item, today)].push(item);
  // Prossimi e in corso: dal più vicino. Passati: dal più recente.
  groups.prossimo.sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  groups.in_corso.sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  groups.passato.sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  return groups;
}

/**
 * D15: si contano le prenotazioni, non le persone (una coppia = 1).
 * "Iscrizioni" = prenotazioni confermate (prenotato + acconto + saldato).
 */
export function countBookings(statuses: readonly BookingStatus[]): BookingCounts {
  const counts: BookingCounts = { iscrizioni: 0, lista_attesa: 0, interessati: 0, cancellati: 0 };
  for (const status of statuses) {
    if (isConfirmed(status)) counts.iscrizioni += 1;
    else if (status === "lista_attesa") counts.lista_attesa += 1;
    else if (status === "interessato") counts.interessati += 1;
    else counts.cancellati += 1;
  }
  return counts;
}

/** Nome e date dall'evento se esiste ancora, altrimenti dalla copia salvata. */
export function toWorkshopView(workshop: Workshop, event: LuxuriaEvent | undefined): WorkshopView {
  if (event) {
    return { ...workshop, displayName: event.name, startsOn: event.startsOn, endsOn: event.endsOn, eventNotice: null };
  }
  return {
    ...workshop,
    displayName: workshop.name,
    startsOn: workshop.starts_on,
    endsOn: workshop.ends_on,
    eventNotice: workshop.event_id ? ORPHAN_EVENT_LABEL : UNLINKED_EVENT_LABEL,
  };
}

export type DashboardEntry = {
  key: string;
  name: string;
  startsOn: string;
  endsOn: string | null;
  capacity: number | null;
  counts: BookingCounts;
  /** Evento non ancora aperto: il link passa da /gestione/e/[eventId] che crea la riga. */
  href: string;
  notice: string | null;
  /** Fase 4: stato economico (Aperto / Saldato); null se il workshop non ha ancora una riga gestionale. */
  economic: EconomicState | null;
  /** D23: Entrate · Uscite · Rimane · Da incassare; null se il workshop non ha ancora una riga gestionale. */
  recap: WorkshopRecap | null;
};

/** D24: Saldato = residuo del conguaglio 0 (settlement.ts, isSettled); altrimenti Aperto. */
export type EconomicState = "aperto" | "saldato";

const NO_BOOKINGS: BookingCounts = { iscrizioni: 0, lista_attesa: 0, interessati: 0, cancellati: 0 };

/**
 * Voci della dashboard: tutti gli eventi LuXuria (con o senza riga gestionale)
 * più i workshop gestionali il cui evento non è più su Ticket Tailor.
 */
export function buildDashboard(
  events: readonly LuxuriaEvent[],
  workshops: readonly Workshop[],
  countsByWorkshop: ReadonlyMap<string, BookingCounts>,
  recapByWorkshop: ReadonlyMap<string, WorkshopRecap> = new Map(),
): DashboardEntry[] {
  const byEvent = new Map(workshops.filter((w) => w.event_id).map((w) => [w.event_id as string, w]));
  const eventIds = new Set(events.map((event) => event.id));

  const fromEvents = events.map((event): DashboardEntry => {
    const workshop = byEvent.get(event.id);
    return {
      key: `e-${event.id}`,
      name: event.name,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      capacity: workshop?.capacity ?? null,
      counts: (workshop && countsByWorkshop.get(workshop.id)) || NO_BOOKINGS,
      // Passa sempre da /gestione/e/: crea la riga se manca e aggiorna nome e date.
      href: `/gestione/e/${event.id}`,
      notice: null,
      economic: (workshop && recapByWorkshop.get(workshop.id)?.economic) || null,
      recap: (workshop && recapByWorkshop.get(workshop.id)) || null,
    };
  });

  const orphans = workshops
    .filter((workshop) => !workshop.event_id || !eventIds.has(workshop.event_id))
    .map((workshop): DashboardEntry => {
      const view = toWorkshopView(workshop, undefined);
      return {
        key: `w-${workshop.id}`,
        name: view.displayName,
        startsOn: view.startsOn,
        endsOn: view.endsOn,
        capacity: workshop.capacity,
        counts: countsByWorkshop.get(workshop.id) ?? NO_BOOKINGS,
        href: `/gestione/w/${workshop.id}`,
        notice: view.eventNotice,
        economic: recapByWorkshop.get(workshop.id)?.economic ?? null,
        recap: recapByWorkshop.get(workshop.id) ?? null,
      };
    });

  return [...fromEvents, ...orphans];
}

// ---------------------------------------------------------------------------
// Impostazioni modificabili nel tab Info (D14)
// ---------------------------------------------------------------------------

export type WorkshopSettingsValues = {
  description: string;
  capacity: string;
  default_fee: string;
  peony_pct: string;
};

export type WorkshopSettingsPayload = {
  description: string | null;
  capacity: number | null;
  default_fee_cents: number | null;
  peony_pct: number;
};

export function validateWorkshopSettings(
  values: WorkshopSettingsValues,
):
  | { ok: true; payload: WorkshopSettingsPayload }
  | { ok: false; errors: Partial<Record<keyof WorkshopSettingsValues, string>> } {
  const errors: Partial<Record<keyof WorkshopSettingsValues, string>> = {};

  let capacity: number | null = null;
  if (values.capacity.trim()) {
    capacity = Number(values.capacity.trim());
    if (!Number.isInteger(capacity) || capacity <= 0) errors.capacity = "Indica un numero intero maggiore di zero.";
  }

  let defaultFee: number | null = null;
  if (values.default_fee.trim()) {
    defaultFee = parseEuroToCents(values.default_fee);
    if (defaultFee === null) errors.default_fee = "Importo non valido (es. 250 o 250,50).";
  }

  const pctText = values.peony_pct.trim().replace(",", ".") || "30";
  const peonyPct = Number(pctText);
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(pctText) || peonyPct < 0 || peonyPct > 100) {
    errors.peony_pct = "Percentuale tra 0 e 100.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      description: values.description.trim() || null,
      capacity,
      default_fee_cents: defaultFee,
      peony_pct: peonyPct,
    },
  };
}

/** Percentuale della seconda parte (Ale): sempre 100 − Peony. */
export function secondPartyPct(peonyPctText: string): string {
  const pct = Number(peonyPctText.trim().replace(",", "."));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return "—";
  return `${Math.round((100 - pct) * 100) / 100}`.replace(".", ",");
}
