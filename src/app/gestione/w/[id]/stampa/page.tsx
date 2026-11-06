import { notFound } from "next/navigation";

import { PrintButton } from "@/components/gestionale/PrintButton";
import { expensesByCategory } from "@/lib/gestionale/accounts";
import { formatCents, formatDate, formatDateRange, formatDateTime } from "@/lib/gestionale/format";
import { PARTY_LABELS, PAYMENT_METHOD_LABELS, SETTLEMENT_STATUS_LABELS, TRANSFER_STATUS_LABELS } from "@/lib/gestionale/labels";
import { getAccounts } from "@/lib/gestionale/server/accounts";
import { requireOperator } from "@/lib/gestionale/server/auth";
import { getWorkshopView } from "@/lib/gestionale/server/data";
import { logExport } from "@/lib/gestionale/server/mutations";
import type { Party } from "@/lib/gestionale/types";

// Stampa del consuntivo (Fase 4, D8): layout A4 senza navigazione (fuori dal
// gruppo (app)), "Salva come PDF" del browser. Admin e organizzatrice (D18).
// Contiene solo dati economici e i nomi come li ha scritti Ale: niente note
// fiscali, niente stato socio né anagrafica. Ogni apertura va nello storico.

export const dynamic = "force-dynamic";

const PARTIES: readonly Party[] = ["peony", "redsabbath"];

const th = "border-b border-[#211815]/20 py-1 pr-2 text-left font-semibold";
const td = "border-b border-[#211815]/10 py-1 pr-2 align-top";
const tdRight = `${td} text-right tabular-nums`;

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 break-after-avoid font-serif text-xl font-medium">{children}</h2>;
}

function MoneyLine({ label, cents, strong }: { label: string; cents: number | null | undefined; strong?: boolean }) {
  return (
    <tr className={strong ? "font-semibold" : ""}>
      <td className={td}>{label}</td>
      <td className={tdRight}>{cents === null || cents === undefined ? "—" : formatCents(cents)}</td>
    </tr>
  );
}

export default async function PrintAccountsPage({ params }: { params: Promise<{ id: string }> }) {
  const operator = await requireOperator();
  const { id } = await params;
  const workshop = await getWorkshopView(id);
  if (!workshop) notFound();
  const data = await getAccounts(workshop);
  if (!data) notFound();
  await logExport(operator.id, workshop.id, "stampa");

  const { settlement } = data;
  const pct = (basis: number) => `${String(basis / 100).replace(".", ",")}%`;

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-8 py-8 text-sm text-[#211815] print:max-w-none print:p-0">
      <style>{`@page { size: A4; margin: 15mm; } @media print { body { background: #fff !important; } }`}</style>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a href={`/gestione/w/${workshop.id}?tab=conti`} className="text-[#5f524c] underline">
          ← Torna ai conti
        </a>
        <PrintButton />
      </div>

      <header className="border-b border-[#211815]/20 pb-3">
        <p className="text-xs uppercase tracking-wide text-[#5f524c]">Consuntivo</p>
        <h1 className="font-serif text-3xl font-medium leading-tight">{workshop.displayName}</h1>
        <p>{formatDateRange(workshop.startsOn, workshop.endsOn)}</p>
        <p className="mt-1 text-xs text-[#5f524c]">
          Generato il {formatDateTime(new Date())} da {operator.displayName} · Stato della verifica: {SETTLEMENT_STATUS_LABELS[data.workshop.status]}
        </p>
      </header>

      <section className="mt-4 rounded-lg border border-[#211815]/20 p-4">
        <p className="text-xs uppercase tracking-wide text-[#5f524c]">Risultato</p>
        <p className="font-serif text-2xl font-medium">{settlement.frase}</p>
        {settlement.avviso ? <p className="mt-1">{settlement.avviso}</p> : null}
      </section>

      <H2>Entrate</H2>
      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Iscrizione</th>
            <th className={`${th} text-right`}>Totale pagato</th>
          </tr>
        </thead>
        <tbody>
          {data.income.map((row) => (
            <tr key={row.bookingId}>
              <td className={td}>
                {row.title}
                {row.cancelled ? " (cancellata)" : ""}
              </td>
              <td className={tdRight}>{formatCents(row.paidCents)}</td>
            </tr>
          ))}
          {PARTIES.map((party) => (
            <MoneyLine key={party} label={`Incassato da ${PARTY_LABELS[party]}`} cents={settlement.incassato[party]} />
          ))}
          {data.incomeByMethod.map(({ method, cents }) => (
            <MoneyLine key={method ?? "nessuno"} label={method ? PAYMENT_METHOD_LABELS[method] : "Metodo non indicato"} cents={cents} />
          ))}
          <MoneyLine label="Totale entrate" cents={settlement.ricavi} strong />
        </tbody>
      </table>

      <H2>Spese</H2>
      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Categoria</th>
            <th className={th}>Descrizione</th>
            <th className={th}>Pagata da</th>
            <th className={th}>Data</th>
            <th className={`${th} text-right`}>Importo</th>
          </tr>
        </thead>
        <tbody>
          {expensesByCategory(data.expenses).flatMap((group) => [
            ...group.expenses.map((expense, i) => (
              <tr key={expense.id}>
                <td className={td}>{i === 0 ? group.label : ""}</td>
                <td className={td}>{expense.description}</td>
                <td className={td}>{PARTY_LABELS[expense.advancedBy]}</td>
                <td className={td}>{expense.spentOn ? formatDate(expense.spentOn) : ""}</td>
                <td className={tdRight}>{formatCents(expense.amountCents)}</td>
              </tr>
            )),
            <tr key={`${group.category}-totale`} className="italic">
              <td className={td} colSpan={4}>
                Totale {group.label.toLowerCase()}
              </td>
              <td className={tdRight}>{formatCents(group.totalCents)}</td>
            </tr>,
          ])}
          <tr className="font-semibold">
            <td className={td} colSpan={4}>
              Totale spese
            </td>
            <td className={tdRight}>{formatCents(settlement.spese)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2 grid grid-cols-2 gap-6 break-inside-avoid">
        <div>
          <H2>Ripartizione</H2>
          <table className="mt-2 w-full border-collapse">
            <tbody>
              <MoneyLine label="Entrate" cents={settlement.ricavi} />
              <MoneyLine label="Spese" cents={settlement.spese} />
              <MoneyLine label="Guadagno" cents={settlement.utile} strong />
              {settlement.allocation.kind === "utile" ? (
                <tr>
                  <td className={td}>Percentuali</td>
                  <td className={tdRight}>
                    {PARTY_LABELS.peony} {pct(settlement.peonyPctBasis)} · {PARTY_LABELS.redsabbath} {pct(10000 - settlement.peonyPctBasis)}
                  </td>
                </tr>
              ) : (
                <MoneyLine label={`Perdita sostenuta da ${PARTY_LABELS.peony}`} cents={data.workshop.lossPeonyCents} />
              )}
              {PARTIES.map((party) => (
                <MoneyLine key={party} label={`Quota ${PARTY_LABELS[party]}`} cents={settlement.quota?.[party]} strong />
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <H2>Posizioni</H2>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr>
                <th className={th} />
                {PARTIES.map((party) => (
                  <th key={party} className={`${th} text-right`}>
                    {PARTY_LABELS[party]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Incassato", (p: Party) => settlement.incassato[p]],
                  ["Quota", (p: Party) => settlement.quota?.[p]],
                  ["Rimborso spese pagate", (p: Party) => settlement.anticipato[p]],
                  ["Spettanza", (p: Party) => settlement.spettanza?.[p]],
                  ["Posizione", (p: Party) => settlement.posizione?.[p]],
                ] as const
              ).map(([label, get]) => (
                <tr key={label} className={label === "Posizione" ? "font-semibold" : ""}>
                  <td className={td}>{label}</td>
                  {PARTIES.map((party) => {
                    const value = get(party);
                    return (
                      <td key={party} className={tdRight}>
                        {value === undefined ? "—" : formatCents(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <H2>Trasferimenti</H2>
      {data.transfers.length === 0 ? (
        <p className="mt-2 text-[#5f524c]">Nessuno.</p>
      ) : (
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Da → a</th>
              <th className={th}>Stato</th>
              <th className={th}>Note</th>
              <th className={`${th} text-right`}>Importo</th>
            </tr>
          </thead>
          <tbody>
            {data.transfers.map((transfer) => (
              <tr key={transfer.id}>
                <td className={td}>
                  {PARTY_LABELS[transfer.fromParty]} → {PARTY_LABELS[transfer.toParty]}
                </td>
                <td className={td}>
                  {TRANSFER_STATUS_LABELS[transfer.status]}
                  {transfer.executedOn ? ` il ${formatDate(transfer.executedOn)}` : ""}
                </td>
                <td className={td}>{transfer.notes ?? ""}</td>
                <td className={tdRight}>{formatCents(transfer.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <H2>Riporti</H2>
      {data.carryoversIn.length + data.carryoversOut.length === 0 ? (
        <p className="mt-2 text-[#5f524c]">Nessuno.</p>
      ) : (
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Direzione</th>
              <th className={th}>Workshop</th>
              <th className={th}>Chi deve a chi</th>
              <th className={`${th} text-right`}>Importo</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...data.carryoversIn.map((c) => ({ ...c, direction: "In entrata da" })),
              ...data.carryoversOut.map((c) => ({ ...c, direction: "In uscita verso" })),
            ].map((carryover) => (
              <tr key={carryover.id}>
                <td className={td}>{carryover.direction}</td>
                <td className={td}>{carryover.otherWorkshop.name}</td>
                <td className={td}>
                  {PARTY_LABELS[carryover.debtor]} → {PARTY_LABELS[carryover.creditor]}
                </td>
                <td className={tdRight}>{formatCents(carryover.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <H2>Divisione {PARTY_LABELS.peony} / {PARTY_LABELS.redsabbath}</H2>
      <table className="mt-2 w-full border-collapse">
        <tbody>
          <MoneyLine label={`Posizione ${PARTY_LABELS.peony}`} cents={settlement.posizione?.peony} />
          <MoneyLine label="Riporti in entrata" cents={settlement.riportiEntrata} />
          <MoneyLine label="Riporti in uscita" cents={settlement.riportiUscita} />
          <MoneyLine label="Trasferimenti eseguiti" cents={settlement.trasferimentiEseguiti} />
          <tr className="font-semibold">
            <td className={td}>Risultato</td>
            <td className={`${td} text-right`}>{settlement.frase}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
