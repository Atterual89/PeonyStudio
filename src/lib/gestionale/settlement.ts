// Consuntivo di un workshop (00-contesto.md sezione 5, formule vincolanti).
// Funzione pura, usata dal server (tab Conti, dashboard, export, controlli
// delle azioni) e dal client solo per l'anteprima della perdita: nessun
// calcolo duplicato in SQL o nei componenti. Tutti i valori in centesimi.

import { formatCents } from "./format";
import { PARTY_LABELS } from "./labels";
import type { Party, SettlementStatus } from "./types";

export type SettlementInput = {
  /** gw_workshops.peony_pct (0–100, due decimali). Ale = 100 − peony_pct. */
  peonyPct: number;
  /** D6: perdita sostenuta da Peony; usata solo se l'utile è negativo. */
  lossPeonyCents: number | null;
  /** Tutti i movimenti di gw_payments del workshop, anche delle prenotazioni cancellate. */
  payments: readonly { amountCents: number; receivedBy: Party }[];
  expenses: readonly { amountCents: number; advancedBy: Party }[];
  transfers: readonly { fromParty: Party; toParty: Party; amountCents: number; status: "da_eseguire" | "eseguito" }[];
  /** Riporti con destinazione = questo workshop. */
  carryoversIn: readonly { debtor: Party; creditor: Party; amountCents: number }[];
  /** Riporti con origine = questo workshop. */
  carryoversOut: readonly { debtor: Party; creditor: Party; amountCents: number }[];
};

export type PerParty = Record<Party, number>;

/**
 * Come si ripartisce l'utile:
 * - utile: Utile ≥ 0, percentuali;
 * - perdita: Utile < 0 e perdita di Peony indicata e valida;
 * - perdita_da_ripartire: Utile < 0 e perdita di Peony non indicata;
 * - da_correggere: perdita di Peony indicata ma non più valida (oltre la
 *   perdita, oppure l'utile è tornato positivo): nessun residuo finché non si
 *   corregge.
 */
export type Allocation =
  | { kind: "utile" }
  | { kind: "perdita"; perdita: number }
  | { kind: "perdita_da_ripartire"; perdita: number }
  | { kind: "da_correggere"; reason: "oltre_perdita" | "utile_positivo"; perdita: number };

export type Settlement = {
  incassato: PerParty;
  anticipato: PerParty;
  ricavi: number;
  spese: number;
  utile: number;
  /** Percentuale di Peony in centesimi di punto (30% = 3000). */
  peonyPctBasis: number;
  allocation: Allocation;
  /** null finché la ripartizione non è definita (perdita da ripartire / da correggere). */
  quota: PerParty | null;
  spettanza: PerParty | null;
  /** Posizione_X = Spettanza_X − Incassato_X (positivo = a X spettano soldi). */
  posizione: PerParty | null;
  /** Effetto sul residuo (dal lato di Peony) di riporti e trasferimenti eseguiti. */
  riportiEntrata: number;
  riportiUscita: number;
  trasferimentiEseguiti: number;
  /** Trasferimenti ancora da eseguire (solo informativo, non toccano il residuo). */
  trasferimentiDaEseguire: number;
  /** Positivo = Ale deve a Peony; negativo = Peony deve ad Ale. null = non calcolabile. */
  residuo: number | null;
  frase: string;
  avviso: string | null;
};

const P: Party = "peony";
const R: Party = "redsabbath";

function sumBy<T>(items: readonly T[], party: Party, partyOf: (item: T) => Party, amountOf: (item: T) => number): number {
  return items.reduce((sum, item) => (partyOf(item) === party ? sum + amountOf(item) : sum), 0);
}

/** Percentuale (fino a due decimali) → centesimi di punto interi, per calcolare senza virgola mobile. */
export function pctBasis(pct: number): number {
  const basis = Math.round(pct * 100);
  if (!Number.isFinite(basis) || basis < 0 || basis > 10000) throw new Error("Percentuale Peony non valida.");
  return basis;
}

/** round(utile × pct / 100) al centesimo, metà per eccesso, in aritmetica intera (utile ≥ 0). */
function shareOf(utile: number, basis: number): number {
  return Math.floor((utile * basis + 5000) / 10000);
}

/** Effetto sul residuo di Peony di un importo di cui `creditor` è creditore. */
function towardsPeony(creditor: Party, amount: number): number {
  return creditor === P ? amount : -amount;
}

export function computeSettlement(input: SettlementInput): Settlement {
  const incassato: PerParty = {
    peony: sumBy(input.payments, P, (p) => p.receivedBy, (p) => p.amountCents),
    redsabbath: sumBy(input.payments, R, (p) => p.receivedBy, (p) => p.amountCents),
  };
  const anticipato: PerParty = {
    peony: sumBy(input.expenses, P, (e) => e.advancedBy, (e) => e.amountCents),
    redsabbath: sumBy(input.expenses, R, (e) => e.advancedBy, (e) => e.amountCents),
  };
  const ricavi = incassato.peony + incassato.redsabbath;
  const spese = anticipato.peony + anticipato.redsabbath;
  const utile = ricavi - spese;
  const basis = pctBasis(input.peonyPct);
  const loss = input.lossPeonyCents;

  let allocation: Allocation;
  let quotaP: number | null = null;
  if (utile >= 0) {
    // Utile esattamente 0 con perdita 0 indicata: quote 0, nessun avviso.
    if (loss !== null && (utile > 0 || loss > 0)) {
      allocation = { kind: "da_correggere", reason: utile > 0 ? "utile_positivo" : "oltre_perdita", perdita: 0 };
    } else {
      allocation = { kind: "utile" };
      quotaP = shareOf(utile, basis);
    }
  } else if (loss === null) {
    allocation = { kind: "perdita_da_ripartire", perdita: -utile };
  } else if (loss > -utile || loss < 0) {
    allocation = { kind: "da_correggere", reason: "oltre_perdita", perdita: -utile };
  } else {
    allocation = { kind: "perdita", perdita: -utile };
    quotaP = loss === 0 ? 0 : -loss; // niente −0
  }

  const riportiEntrata = input.carryoversIn.reduce((sum, c) => sum + towardsPeony(c.creditor, c.amountCents), 0);
  // In uscita l'opposto: il residuo è stato spostato sul workshop di destinazione.
  const riportiUscita = input.carryoversOut.reduce((sum, c) => sum - towardsPeony(c.creditor, c.amountCents), 0);
  // Eseguito R→P: −importo (Peony ha ricevuto); P→R: +importo.
  const trasferimentiEseguiti = input.transfers
    .filter((t) => t.status === "eseguito")
    .reduce((sum, t) => sum - towardsPeony(t.toParty, t.amountCents), 0);
  const trasferimentiDaEseguire = input.transfers
    .filter((t) => t.status === "da_eseguire")
    .reduce((sum, t) => sum + t.amountCents, 0);

  const base = {
    incassato,
    anticipato,
    ricavi,
    spese,
    utile,
    peonyPctBasis: basis,
    allocation,
    riportiEntrata,
    riportiUscita,
    trasferimentiEseguiti,
    trasferimentiDaEseguire,
  };

  if (quotaP === null) {
    return {
      ...base,
      quota: null,
      spettanza: null,
      posizione: null,
      residuo: null,
      frase: allocation.kind === "perdita_da_ripartire" ? "Perdita da ripartire" : "Ripartizione della perdita da correggere",
      avviso: allocationWarning(allocation),
    };
  }

  const quota: PerParty = { peony: quotaP, redsabbath: utile - quotaP };
  const spettanza: PerParty = {
    peony: quota.peony + anticipato.peony,
    redsabbath: quota.redsabbath + anticipato.redsabbath,
  };
  const posizioneP = spettanza.peony - incassato.peony;
  const posizioneR = spettanza.redsabbath - incassato.redsabbath;
  if (posizioneR !== -posizioneP) throw new Error("Consuntivo incoerente: Posizione_R ≠ −Posizione_P.");

  const residuo = posizioneP + riportiEntrata + riportiUscita + trasferimentiEseguiti;
  return {
    ...base,
    quota,
    spettanza,
    posizione: { peony: posizioneP, redsabbath: posizioneR },
    residuo,
    frase: residuoPhrase(residuo),
    avviso: null,
  };
}

/**
 * 4g (#2, ipotesi 5): frase intera, in terza persona (admin, export):
 * "Ale deve dare X € a Peony" · "Peony deve dare X € ad Ale" · "Pari".
 * Ad Ale si mostra in seconda persona (debtPhrase in recap.ts).
 */
export function residuoPhrase(residuo: number): string {
  if (residuo > 0) return `${PARTY_LABELS.redsabbath} deve dare ${formatCents(residuo)} a ${PARTY_LABELS.peony}`;
  if (residuo < 0) return `${PARTY_LABELS.peony} deve dare ${formatCents(-residuo)} ad ${PARTY_LABELS.redsabbath}`;
  return "Pari";
}

function allocationWarning(allocation: Allocation): string | null {
  switch (allocation.kind) {
    case "perdita_da_ripartire":
      return `Perdita di ${formatCents(allocation.perdita)} da ripartire: indica quanta ne sostiene ${PARTY_LABELS.peony}.`;
    case "da_correggere":
      return allocation.reason === "utile_positivo"
        ? `L'utile non è più negativo: togli la perdita sostenuta da ${PARTY_LABELS.peony} per calcolare quanto trasferire.`
        : `La perdita sostenuta da ${PARTY_LABELS.peony} supera la perdita del workshop (${formatCents(allocation.perdita)}): correggila.`;
    default:
      return null;
  }
}

/** D6: la perdita sostenuta da Peony deve stare tra 0 e |Utile|, e solo con utile negativo. */
export function validateLossPeony(settlement: Pick<Settlement, "utile">, lossCents: number | null): string | null {
  if (lossCents === null) return null;
  if (settlement.utile >= 0) return "Il workshop non è in perdita: non c'è nessuna perdita da ripartire.";
  if (lossCents < 0 || lossCents > -settlement.utile) {
    return `Indica un importo tra 0 e ${formatCents(-settlement.utile)}.`;
  }
  return null;
}

/**
 * D24: "Saldato" = residuo del conguaglio uguale a 0, sempre dai numeri
 * (trasferimenti eseguiti compresi). Se poi gli importi cambiano, il workshop
 * torna da solo "Aperto · da trasferire X".
 */
export function isSettled(settlement: Pick<Settlement, "residuo">): boolean {
  return settlement.residuo === 0;
}

/**
 * D24 (migrazione 024): stato salvato → stato manuale. I valori vecchi
 * da_conguagliare / conguagliato (prima della migrazione) valgono verificato.
 */
export function settlementStatusOf(value: string | null | undefined): SettlementStatus {
  return value === "provvisorio" || !value ? "provvisorio" : "verificato";
}

/** D24: "Registra trasferimento di X € (Ale → Peony)": chi trasferisce a chi per portare il residuo a 0. */
export function residualTransfer(residuo: number | null): { fromParty: Party; toParty: Party; amountCents: number } | null {
  if (!residuo) return null;
  return residuo > 0
    ? { fromParty: R, toParty: P, amountCents: residuo }
    : { fromParty: P, toParty: R, amountCents: -residuo };
}

/** #18: consuntivo verificato e modificato dopo: "Da ricontrollare". */
export function needsRecheck(status: SettlementStatus, snapshot: unknown, settlement: Settlement, lossPeonyCents: number | null): boolean {
  return status === "verificato" && snapshotChanges(snapshot, settlementSnapshot(settlement, lossPeonyCents)).length > 0;
}



// ---------------------------------------------------------------------------
// Snapshot della verifica (sezione 5): totali salvati in verified_snapshot.
// ---------------------------------------------------------------------------

export const SNAPSHOT_LABELS = {
  ricavi: "Entrate",
  spese: "Spese",
  utile: "Guadagno",
  incassatoPeony: `Incassato da ${PARTY_LABELS.peony}`,
  incassatoAle: `Incassato da ${PARTY_LABELS.redsabbath}`,
  anticipatoPeony: `Spese pagate da ${PARTY_LABELS.peony}`,
  anticipatoAle: `Spese pagate da ${PARTY_LABELS.redsabbath}`,
  peonyPct: `Percentuale ${PARTY_LABELS.peony}`,
  perditaPeony: `Perdita sostenuta da ${PARTY_LABELS.peony}`,
  quotaPeony: `Quota ${PARTY_LABELS.peony}`,
  quotaAle: `Quota ${PARTY_LABELS.redsabbath}`,
  posizionePeony: `Posizione ${PARTY_LABELS.peony}`,
  riporti: "Riporti",
  trasferimenti: "Trasferimenti eseguiti",
  residuo: "Da trasferire",
} as const;

export type SnapshotKey = keyof typeof SNAPSHOT_LABELS;
export type SettlementSnapshot = Record<SnapshotKey, number | null>;

export function settlementSnapshot(settlement: Settlement, lossPeonyCents: number | null): SettlementSnapshot {
  return {
    ricavi: settlement.ricavi,
    spese: settlement.spese,
    utile: settlement.utile,
    incassatoPeony: settlement.incassato.peony,
    incassatoAle: settlement.incassato.redsabbath,
    anticipatoPeony: settlement.anticipato.peony,
    anticipatoAle: settlement.anticipato.redsabbath,
    peonyPct: settlement.peonyPctBasis,
    perditaPeony: lossPeonyCents,
    quotaPeony: settlement.quota?.peony ?? null,
    quotaAle: settlement.quota?.redsabbath ?? null,
    posizionePeony: settlement.posizione?.peony ?? null,
    riporti: settlement.riportiEntrata + settlement.riportiUscita,
    trasferimenti: settlement.trasferimentiEseguiti,
    residuo: settlement.residuo,
  };
}

export type SnapshotChange = { key: SnapshotKey; label: string; before: string; after: string };

function formatSnapshotValue(key: SnapshotKey, value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (key === "peonyPct") return `${String(value / 100).replace(".", ",")}%`;
  return formatCents(value);
}

/** Valori cambiati dopo la verifica (prima → ora). Lo snapshot arriva dal database: si legge con prudenza. */
export function snapshotChanges(saved: unknown, current: SettlementSnapshot): SnapshotChange[] {
  if (!saved || typeof saved !== "object") return [];
  const before = saved as Partial<Record<SnapshotKey, unknown>>;
  return (Object.keys(SNAPSHOT_LABELS) as SnapshotKey[]).flatMap((key) => {
    const old = typeof before[key] === "number" ? (before[key] as number) : before[key] === null ? null : undefined;
    if (old === undefined || old === current[key]) return [];
    return [{ key, label: SNAPSHOT_LABELS[key], before: formatSnapshotValue(key, old), after: formatSnapshotValue(key, current[key]) }];
  });
}
