import "server-only";

import ExcelJS from "exceljs";

import { expensesByCategory, type AccountsData } from "@/lib/gestionale/accounts";
import { formatDate, formatDateRange } from "@/lib/gestionale/format";
import { EXPENSE_CATEGORY_LABELS, PARTY_LABELS, PAYMENT_METHOD_LABELS, SETTLEMENT_STATUS_LABELS, TRANSFER_STATUS_LABELS } from "@/lib/gestionale/labels";
import type { Party } from "@/lib/gestionale/types";

// Export .xlsx del consuntivo (Fase 4, D8). Fogli: Riepilogo, Incassi, Spese,
// Trasferimenti e riporti (4e, #26: titoli come nell'interfaccia). Importi come NUMERI con formato euro, mai come testo. Contenuto:
// solo dati economici e nomi come li ha scritti Ale (entered_as); niente note
// fiscali, niente stato socio né anagrafica.

const EURO = '#,##0.00 "€";-#,##0.00 "€"';
const PARTIES: readonly Party[] = ["peony", "redsabbath"];

const euros = (cents: number) => cents / 100;

function header(sheet: ExcelJS.Worksheet, values: string[]) {
  const row = sheet.addRow(values);
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2EDE3" } };
}

/** Riga "etichetta · importo" (importo in centesimi → numero in euro; null = vuoto). */
function moneyRow(sheet: ExcelJS.Worksheet, label: string, cents: number | null, bold = false) {
  const row = sheet.addRow([label, cents === null ? null : euros(cents)]);
  row.getCell(2).numFmt = EURO;
  if (bold) row.font = { bold: true };
  return row;
}

export async function buildAccountsWorkbook(
  data: AccountsData,
  meta: { generatedAt: string; operatorName: string },
): Promise<Buffer> {
  const { settlement, workshop } = data;
  const book = new ExcelJS.Workbook();
  book.creator = "Gestionale workshop";
  book.created = new Date();

  // --- Riepilogo -----------------------------------------------------------
  const summary = book.addWorksheet("Riepilogo");
  summary.columns = [{ width: 40 }, { width: 18 }];
  summary.addRow([`Consuntivo — ${workshop.name}`]).font = { bold: true, size: 14 };
  summary.addRow([formatDateRange(workshop.startsOn, workshop.endsOn)]);
  summary.addRow([`Generato il ${meta.generatedAt} da ${meta.operatorName}`]);
  summary.addRow([`Stato della verifica: ${SETTLEMENT_STATUS_LABELS[workshop.status]}`]);
  summary.addRow([]);
  summary.addRow(["Da trasferire", settlement.frase]).font = { bold: true, size: 12 };
  if (settlement.avviso) summary.addRow([settlement.avviso]);
  summary.addRow([]);

  header(summary, ["Ripartizione", ""]);
  moneyRow(summary, "Entrate", settlement.ricavi);
  moneyRow(summary, "Spese", settlement.spese);
  moneyRow(summary, "Guadagno", settlement.utile, true);
  if (settlement.allocation.kind === "utile") {
    for (const party of PARTIES) {
      const basis = party === "peony" ? settlement.peonyPctBasis : 10000 - settlement.peonyPctBasis;
      const row = summary.addRow([`Percentuale ${PARTY_LABELS[party]}`, basis / 10000]);
      row.getCell(2).numFmt = "0.00%";
    }
  } else {
    moneyRow(summary, `Perdita sostenuta da ${PARTY_LABELS.peony}`, workshop.lossPeonyCents);
  }
  for (const party of PARTIES) moneyRow(summary, `Quota ${PARTY_LABELS[party]}`, settlement.quota?.[party] ?? null);
  summary.addRow([]);

  for (const party of PARTIES) {
    header(summary, [`Posizione ${PARTY_LABELS[party]}`, ""]);
    moneyRow(summary, "Incassato", settlement.incassato[party]);
    moneyRow(summary, "Quota", settlement.quota?.[party] ?? null);
    moneyRow(summary, "Rimborso spese pagate", settlement.anticipato[party]);
    moneyRow(summary, "Spettanza", settlement.spettanza?.[party] ?? null, true);
    moneyRow(summary, "Posizione", settlement.posizione?.[party] ?? null, true);
    summary.addRow([]);
  }

  header(summary, [`Divisione ${PARTY_LABELS.peony} / ${PARTY_LABELS.redsabbath}`, ""]);
  moneyRow(summary, `Posizione ${PARTY_LABELS.peony}`, settlement.posizione?.peony ?? null);
  moneyRow(summary, "Riporti in entrata", settlement.riportiEntrata);
  moneyRow(summary, "Riporti in uscita", settlement.riportiUscita);
  moneyRow(summary, "Trasferimenti eseguiti", settlement.trasferimentiEseguiti);
  moneyRow(summary, `Da trasferire (positivo: ${PARTY_LABELS.redsabbath} → ${PARTY_LABELS.peony})`, settlement.residuo, true);

  // --- Incassi -------------------------------------------------------------
  const income = book.addWorksheet("Incassi");
  income.columns = [{ width: 36 }, { width: 14 }, { width: 18 }];
  header(income, ["Iscrizione", "Stato", "Totale pagato"]);
  for (const row of data.income) {
    income.addRow([row.title, row.cancelled ? "cancellata" : "", euros(row.paidCents)]).getCell(3).numFmt = EURO;
  }
  income.addRow([]);
  for (const party of PARTIES) {
    const row = income.addRow([`Incassato da ${PARTY_LABELS[party]}`, "", euros(settlement.incassato[party])]);
    row.getCell(3).numFmt = EURO;
  }
  for (const { method, cents } of data.incomeByMethod) {
    income.addRow([method ? PAYMENT_METHOD_LABELS[method] : "Metodo non indicato", "", euros(cents)]).getCell(3).numFmt = EURO;
  }
  const incomeTotal = income.addRow(["Totale entrate", "", euros(settlement.ricavi)]);
  incomeTotal.font = { bold: true };
  incomeTotal.getCell(3).numFmt = EURO;

  // --- Spese ---------------------------------------------------------------
  const expenses = book.addWorksheet("Spese");
  expenses.columns = [{ width: 14 }, { width: 36 }, { width: 16 }, { width: 14 }, { width: 16 }];
  header(expenses, ["Categoria", "Descrizione", "Pagata da", "Data", "Importo"]);
  for (const group of expensesByCategory(data.expenses)) {
    for (const expense of group.expenses) {
      expenses
        .addRow([
          EXPENSE_CATEGORY_LABELS[expense.category],
          expense.description,
          PARTY_LABELS[expense.advancedBy],
          expense.spentOn ? formatDate(expense.spentOn) : "",
          euros(expense.amountCents),
        ])
        .getCell(5).numFmt = EURO;
    }
    const subtotal = expenses.addRow([`Totale ${group.label.toLowerCase()}`, "", "", "", euros(group.totalCents)]);
    subtotal.font = { italic: true };
    subtotal.getCell(5).numFmt = EURO;
  }
  expenses.addRow([]);
  for (const party of PARTIES) {
    expenses.addRow([`Pagate da ${PARTY_LABELS[party]}`, "", "", "", euros(settlement.anticipato[party])]).getCell(5).numFmt = EURO;
  }
  const expensesTotal = expenses.addRow(["Totale spese", "", "", "", euros(settlement.spese)]);
  expensesTotal.font = { bold: true };
  expensesTotal.getCell(5).numFmt = EURO;

  // --- Trasferimenti e riporti ---------------------------------------------
  const transfers = book.addWorksheet("Trasferimenti e riporti");
  transfers.columns = [{ width: 24 }, { width: 30 }, { width: 18 }, { width: 16 }, { width: 30 }];
  header(transfers, ["Trasferimenti", "Da → a", "Stato", "Importo", "Note"]);
  for (const transfer of data.transfers) {
    transfers
      .addRow([
        transfer.executedOn ? formatDate(transfer.executedOn) : "",
        `${PARTY_LABELS[transfer.fromParty]} → ${PARTY_LABELS[transfer.toParty]}`,
        TRANSFER_STATUS_LABELS[transfer.status],
        euros(transfer.amountCents),
        transfer.notes ?? "",
      ])
      .getCell(4).numFmt = EURO;
  }
  transfers.addRow([]);
  header(transfers, ["Riporti", "Workshop", "Chi deve a chi", "Importo", "Note"]);
  for (const [label, list] of [
    ["In entrata", data.carryoversIn],
    ["In uscita", data.carryoversOut],
  ] as const) {
    for (const carryover of list) {
      transfers
        .addRow([
          label,
          carryover.otherWorkshop.name,
          `${PARTY_LABELS[carryover.debtor]} → ${PARTY_LABELS[carryover.creditor]}`,
          euros(carryover.amountCents),
          carryover.notes ?? "",
        ])
        .getCell(4).numFmt = EURO;
    }
  }
  transfers.addRow([]);
  transfers.addRow(["Da trasferire", settlement.frase]).font = { bold: true };

  return Buffer.from(await book.xlsx.writeBuffer());
}
