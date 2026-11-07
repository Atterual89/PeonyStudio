"use client";

import { ChevronDown, Download, History, Printer } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  setLossPeonyAction,
  setPeonyPctAction,
  setSettlementStatusAction,
  setTaxNotesAction,
  addTransferAction,
} from "@/app/gestione/(app)/w/accounts-actions";
import { expensesByCategory, type AccountsData, type IncomeRow } from "@/lib/gestionale/accounts";
import { centsToInput, formatCents, formatDate, parseEuroToCents } from "@/lib/gestionale/format";
import { PARTY_LABELS, PAYMENT_METHOD_LABELS, SETTLEMENT_STATUS_LABELS, verifiedByLabel } from "@/lib/gestionale/labels";
import {
  computeSettlement,
  settlementSnapshot,
  snapshotChanges,
  type Settlement,
  type SnapshotChange,
} from "@/lib/gestionale/settlement";
import { debtPhrase, residuoShort, settleLabels } from "@/lib/gestionale/recap";
import type { ActionResult, OperatorRole, Party, SettlementStatus } from "@/lib/gestionale/types";
import { secondPartyPct } from "@/lib/gestionale/workshops";

import { DeletePaymentConfirm } from "./Deletion";
import { AddExpense, ExpensesBlock } from "./ExpensesBlock";
import { CurrentPaymentList } from "./PaymentBits";
import { FinanceDashboard } from "./FinanceDashboard";
import { CarryoversBlock, TransfersBlock } from "./TransfersBlock";
import { Field, InlineConfirm, Notice, RowMenu, Section, buttonClass, cardClass, inputClass } from "./ui";

type Message = { tone: "success" | "error"; text: string } | null;

/** 4g (#34): ad Ale, al posto dei controlli della perdita. */
export const LOSS_FOR_ALE = "Il workshop è in perdita: Laura deciderà come dividerla.";

const PARTIES: readonly Party[] = ["peony", "redsabbath"];

function pctText(basis: number): string {
  return `${String(basis / 100).replace(".", ",")}%`;
}

function useSave() {
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  function save(action: () => Promise<ActionResult>, success: string, after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) after?.();
      setMessage(result.ok ? { tone: "success", text: success } : { tone: "error", text: result.error });
    });
  }
  return { message, pending, save };
}

// ---------------------------------------------------------------------------
// In cima: Entrate · Uscite · Rimane, da incassare, modificato dopo la verifica
// ---------------------------------------------------------------------------

function Summary({ data, changes }: { data: AccountsData; changes: readonly SnapshotChange[] }) {
  return (
    <div className="space-y-2">
      <FinanceDashboard data={data} />
      {changes.length > 0 ? (
        <div role="status" className="rounded-xl border border-[#b7791f]/30 bg-[#fdf3e1] px-3 py-2 text-sm text-[#7a5212]">
          <p className="font-semibold">Conti modificati dopo la verifica: da ricontrollare</p>
          <ul className="mt-1 space-y-0.5">
            {changes.map((change) => (
              <li key={change.key}>
                {change.label}: {change.before} → <strong>{change.after}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Divisione: risultato del conguaglio
// ---------------------------------------------------------------------------

function ResultBlock({ data, viewer, today, withSettle = true }: { data: AccountsData; viewer: OperatorRole; today: string; withSettle?: boolean }) {
  const { settlement, workshop } = data;
  const tone =
    settlement.residuo === null ? "text-[#7a5212]" : settlement.residuo === 0 ? "text-[#2f5d3b]" : "text-[#a8583e]";

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-3`}>
        <p className="text-sm text-[#5f524c]">Da trasferire</p>
        <p className={`mt-1 font-serif text-3xl font-medium leading-tight ${tone}`}>{debtPhrase(settlement.residuo, viewer) ?? settlement.frase}</p>
        {settlement.avviso ? <p className="mt-2 text-sm text-[#7a5212]">{settlement.avviso}</p> : null}
        {settlement.trasferimentiDaEseguire > 0 ? (
          <p className="mt-2 text-sm text-[#5f524c]">
            Trasferimenti registrati ma da eseguire: {formatCents(settlement.trasferimentiDaEseguire)} (non ancora contati).
          </p>
        ) : null}
        <p className="mt-3 text-sm">
          Stato della verifica: <strong>{SETTLEMENT_STATUS_LABELS[workshop.status]}</strong>
          {/* D25: chi ha verificato, solo come Peony / Ale. */}
          {workshop.verifiedAt && workshop.status === "verificato" ? (
            <span className="text-[#5f524c]">
              {" "}
              {verifiedByLabel(workshop.verifiedByRole)} il {formatDate(workshop.verifiedAt)}
            </span>
          ) : null}
        </p>
      </div>
      {withSettle ? <SettleResidual data={data} viewer={viewer} today={today} /> : null}
    </div>
  );
}

/**
 * D24, 4g (#33): quando il residuo non è 0, "Ho dato X € a Peony" (Ale) o
 * "Ale ha dato X € a Peony" (admin): scritto come un fatto, con la conferma
 * "L'hai già dato? Lo segno come fatto oggi". Registra il trasferimento come
 * eseguito oggi e porta il residuo a 0.
 */
/** Inserimento rapido: il saldo effettivo può essere maggiore, minore o
 * precedente al conguaglio calcolato. Solo i movimenti eseguiti lo riducono.
 */
function SettleResidual({ data, viewer, today }: { data: AccountsData; viewer: OperatorRole; today: string }) {
  const [open,setOpen]=useState(false);
  const [fromParty,setFromParty]=useState<Party>(data.settlement.residuo!==null&&data.settlement.residuo<0?"peony":"redsabbath");
  const [amount,setAmount]=useState(data.settlement.residuo ? centsToInput(Math.abs(data.settlement.residuo)) : "");
  const [status,setStatus]=useState<"eseguito"|"da_eseguire">("eseguito");
  const [date,setDate]=useState(today);
  const [notes,setNotes]=useState("");
  const [asking,setAsking]=useState(false);
  const {message,pending,save}=useSave();
  const current=data.settlement.residuo;
  const typed=parseEuroToCents(amount);
  const toParty=fromParty==="peony"?"redsabbath":"peony";
  const preview=typed!==null&&typed>0
    ?computeSettlement({...data.input,transfers:[...data.input.transfers,{
      fromParty,toParty,amountCents:typed,status,
    }]})
    :null;
  const labels=settleLabels(current,viewer);
  const involvedCarryovers=data.carryoversOut.length>0||data.carryoversIn.length>0;

  return (
    <div className="space-y-2">
      {!open?(
        <button type="button" className={buttonClass.secondary} onClick={()=>{
          setOpen(true);
          setFromParty(current!==null&&current<0?"peony":"redsabbath");
          setAmount(current?centsToInput(Math.abs(current)):"");
        }}>
          Registra importo effettivo o in sospeso
        </button>
      ):(
        <div className="space-y-3 rounded-xl border border-[#211815]/10 bg-white/80 p-3">
          <p className="font-semibold">Quanto è stato realmente trasferito?</p>
          {labels?<p className="text-sm text-[#5f524c]">Situazione attuale: {debtPhrase(current,viewer)}.</p>
            :<p className="text-sm text-[#7a5212]">Conguaglio non ancora calcolabile: puoi comunque registrare un importo.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Da">
              <select className={inputClass} value={fromParty}
                onChange={e=>{setFromParty(e.target.value as Party);setAsking(false);}}>
                <option value="redsabbath">{PARTY_LABELS.redsabbath}</option>
                <option value="peony">{PARTY_LABELS.peony}</option>
              </select>
            </Field>
            <Field label="A"><p className="flex h-10 items-center text-sm font-semibold">{PARTY_LABELS[toParty]}</p></Field>
            <Field label="Importo (€)">
              <input inputMode="decimal" className={inputClass} value={amount}
                onChange={e=>{setAmount(e.target.value);setAsking(false);}}
                placeholder="es. 350" aria-label="Importo realmente trasferito o previsto"/>
            </Field>
            <Field label="Stato">
              <select className={inputClass} value={status}
                onChange={e=>{setStatus(e.target.value as "eseguito"|"da_eseguire");setAsking(false);}}>
                <option value="eseguito">Già versato</option>
                <option value="da_eseguire">Da versare</option>
              </select>
            </Field>
            {status==="eseguito"?(
              <Field label="Data versamento">
                <input type="date" className={inputClass} value={date}
                  onChange={e=>{setDate(e.target.value);setAsking(false);}}/>
              </Field>
            ):null}
          </div>
          <Field label="Note (facoltative)">
            <input className={inputClass} value={notes}
              onChange={e=>setNotes(e.target.value)}
              placeholder="es. saldo parziale, anticipo, accordo"/>
          </Field>
          {preview?(
            <p className="text-sm">
              {status==="eseguito"?"Dopo questo pagamento":"Il saldo non cambia finché non viene versato"}:
              {" "}<strong>{debtPhrase(preview.residuo,viewer)??"Da ripartire"}</strong>
            </p>
          ):null}
          {involvedCarryovers?<p className="text-xs text-[#7a5212]">
            Ci sono riporti collegati a questo workshop: non verranno modificati automaticamente.
            Controllali prima di registrare un ulteriore pagamento.
          </p>:null}
          {asking?(
            <InlineConfirm
              question={`Confermi ${formatCents(typed??0)} da ${PARTY_LABELS[fromParty]} a ${PARTY_LABELS[toParty]} (${status==="eseguito"?"già versati":"da versare"})?`}
              note="Il consuntivo sarà ricalcolato in base ai versamenti eseguiti. Le somme non versate resteranno in sospeso; eventuali riporti già registrati non saranno modificati."
              confirmLabel="Conferma importo"
              pending={pending}
              onConfirm={()=>save(
                ()=>addTransferAction({workshopId:data.workshop.id,expectedResidual:current,
                  fields:{fromParty,amount,status,executedOn:status==="eseguito"?date:"",notes}}),
                "Movimento registrato.",
                ()=>{setOpen(false);setAsking(false);setNotes("");}
              )}
              onCancel={()=>setAsking(false)}
            />
          ):(
            <div className="flex gap-2">
              <button type="button" className={buttonClass.primary}
                disabled={pending||!typed||typed<=0||(status==="eseguito"&&!date)}
                onClick={()=>setAsking(true)}>Continua</button>
              <button type="button" className={buttonClass.ghost} onClick={()=>setOpen(false)}>Chiudi</button>
            </div>
          )}
        </div>
      )}
      {message?<Notice tone={message.tone}>{message.text}</Notice>:null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entrate dai partecipanti
// ---------------------------------------------------------------------------

/**
 * Movimenti di una prenotazione: agli admin in sola lettura (solo "Elimina" di
 * D22 nel menu "…"); ad Ale il link al tab Iscrizioni, dove li gestisce.
 */
function IncomeDetails({ row, workshopId, isAdmin }: { row: IncomeRow; workshopId: string; isAdmin: boolean }) {
  const [deleting, setDeleting] = useState<Parameters<typeof DeletePaymentConfirm>[0]["entry"] | null>(null);
  return (
    <div className="space-y-2 px-3 pb-3">
      <CurrentPaymentList
        payments={row.payments}
        showCorrections={isAdmin}
        actions={
          isAdmin
            ? (entry) => <RowMenu label="Altre azioni sul movimento" items={[{ label: "Elimina", danger: true, onClick: () => setDeleting(entry) }]} />
            : undefined
        }
      />
      {deleting ? <DeletePaymentConfirm key={deleting.payment.id} entry={deleting} name={row.title} onClose={() => setDeleting(null)} /> : null}
      {/* 4e (#22): gli admin vedono i pagamenti in sola lettura. */}
      {isAdmin ? <p className="text-xs text-[#5f524c]">Per correggere un importo: {PARTY_LABELS.redsabbath} → Modifica.</p> : null}
      {isAdmin ? null : (
        <Link prefetch={false} href={`/gestione/w/${workshopId}?tab=iscrizioni`} className="inline-flex min-h-10 items-center text-sm font-semibold text-[#a8583e] underline">
          Gestisci in Iscrizioni
        </Link>
      )}
    </div>
  );
}

function IncomeBlock({ data, isAdmin }: { data: AccountsData; isAdmin: boolean }) {
  const { income, incomeByMethod, settlement } = data;
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {income.length === 0 ? <p className="text-sm text-[#5f524c]">Nessun pagamento registrato.</p> : null}
      {income.length > 0 ? (
        <ul className="divide-y divide-[#211815]/5 rounded-xl border border-[#211815]/10 bg-white">
          {income.map((row) => {
            const open = openId === row.bookingId;
            return (
              <li key={row.bookingId}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : row.bookingId)}
                  className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                >
                  <span>
                    {row.title}
                    {row.cancelled ? <span className="text-[#5f524c]"> · cancellata</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <strong>{formatCents(row.paidCents)}</strong>
                    <ChevronDown className={`h-4 w-4 text-[#5f524c] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </span>
                </button>
                {open ? <IncomeDetails row={row} workshopId={data.workshop.id} isAdmin={isAdmin} /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <dl className="grid grid-cols-2 gap-2 rounded-2xl border border-[#211815]/10 bg-white/70 p-3 text-sm sm:grid-cols-4">
        {PARTIES.map((party) => (
          <div key={party}>
            <dt className="text-[#5f524c]">Incassato da {PARTY_LABELS[party]}</dt>
            <dd className="text-base font-semibold">{formatCents(settlement.incassato[party])}</dd>
          </div>
        ))}
        {incomeByMethod.map(({ method, cents }) => (
          <div key={method ?? "nessuno"}>
            <dt className="text-[#5f524c]">{method ? PAYMENT_METHOD_LABELS[method] : "Metodo non indicato"}</dt>
            <dd className="font-semibold">{formatCents(cents)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocco 4: Ripartizione
// ---------------------------------------------------------------------------

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-[#5f524c]">{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}

function PercentEditor({ data }: { data: AccountsData }) {
  const [value, setValue] = useState(String(data.workshop.peonyPct).replace(".", ","));
  const { message, pending, save } = useSave();
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <Field label={`${PARTY_LABELS.peony} %`}>
          <input inputMode="decimal" className={`${inputClass} w-28`} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <p className="pb-3 text-sm text-[#5f524c]">
          {PARTY_LABELS.redsabbath}: {secondPartyPct(value)}%
        </p>
        <button
          type="button"
          className={`${buttonClass.secondary} mb-0.5`}
          disabled={pending}
          onClick={() =>
            save(() => setPeonyPctAction({ workshopId: data.workshop.id, version: data.workshop.version, peonyPct: value }), "Percentuali salvate.")
          }
        >
          Salva
        </button>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}

/** D6: "Perdita da ripartire" con anteprima (stessa funzione computeSettlement, nessun calcolo a parte). */
function LossBox({ data }: { data: AccountsData }) {
  const { settlement, workshop } = data;
  const perdita = Math.max(0, -settlement.utile);
  const [value, setValue] = useState(centsToInput(workshop.lossPeonyCents));
  const { message, pending, save } = useSave();

  const typed = value.trim() ? parseEuroToCents(value) : null;
  const preview: Settlement | null =
    typed !== null ? computeSettlement({ ...data.input, lossPeonyCents: typed }) : null;

  return (
    <div className="space-y-3 rounded-xl border border-[#b7791f]/30 bg-[#fdf3e1] p-3">
      <p className="font-semibold text-[#7a5212]">Perdita da ripartire: {formatCents(perdita)}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={`Perdita sostenuta da ${PARTY_LABELS.peony}`} hint={`Da 0 a ${formatCents(perdita)}`}>
          <input inputMode="decimal" className={`${inputClass} w-40`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="es. 100" />
        </Field>
        <p className="pb-8 text-sm">
          {PARTY_LABELS.redsabbath}: <strong>{typed !== null && typed <= perdita ? formatCents(perdita - typed) : "—"}</strong>
        </p>
      </div>
      {preview ? (
        <p className="text-sm">
          Anteprima: <strong>{preview.frase}</strong>
          {preview.avviso ? <span className="block text-[#7a5212]">{preview.avviso}</span> : null}
        </p>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass.primary}
          disabled={pending}
          onClick={() =>
            save(() => setLossPeonyAction({ workshopId: workshop.id, version: workshop.version, loss: value }), value.trim() ? "Ripartizione salvata." : "Ripartizione tolta.")
          }
        >
          Salva
        </button>
        {workshop.lossPeonyCents !== null ? (
          <button
            type="button"
            className={buttonClass.ghost}
            disabled={pending}
            onClick={() => save(() => setLossPeonyAction({ workshopId: workshop.id, version: workshop.version, loss: "" }), "Ripartizione tolta.", () => setValue(""))}
          >
            Togli
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SplitBlock({ data, isAdmin }: { data: AccountsData; isAdmin: boolean }) {
  const { settlement, workshop } = data;
  const showLoss = settlement.utile < 0 || workshop.lossPeonyCents !== null;
  return (
    <div className="space-y-3">
      {showLoss && !isAdmin ? (
        // 4g (#34): la perdita la divide Laura; ad Ale nessun controllo.
        <p className="text-sm font-medium text-[#7a5212]">{LOSS_FOR_ALE}</p>
      ) : showLoss ? (
        <LossBox key={`${workshop.version}`} data={data} />
      ) : isAdmin ? (
        <PercentEditor key={`${workshop.version}`} data={data} />
      ) : (
        <p className="text-sm">
          {PARTY_LABELS.peony}: <strong>{pctText(settlement.peonyPctBasis)}</strong> · {PARTY_LABELS.redsabbath}:{" "}
          <strong>{pctText(10000 - settlement.peonyPctBasis)}</strong>
          <span className="block text-[#5f524c]">Le percentuali le modificano gli admin.</span>
        </p>
      )}
      <dl className={`${cardClass} divide-y divide-[#211815]/5 p-3 text-sm`}>
        <Row label="Entrate" value={formatCents(settlement.ricavi)} />
        <Row label="Spese" value={formatCents(settlement.spese)} />
        <Row label="Guadagno" value={formatCents(settlement.utile)} strong />
        {PARTIES.map((party) => (
          <Row key={party} label={`Quota ${PARTY_LABELS[party]}`} value={settlement.quota ? formatCents(settlement.quota[party]) : "—"} strong />
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocco 5: Posizione per parte
// ---------------------------------------------------------------------------

function PositionsBlock({ settlement }: { settlement: Settlement }) {
  const value = (amount: number | undefined) => (amount === undefined ? "—" : formatCents(amount));
  return (
    <div className="grid grid-cols-2 gap-3">
      {PARTIES.map((party) => (
        <dl key={party} className={`${cardClass} p-3 text-sm`}>
          <p className="text-base font-semibold">{PARTY_LABELS[party]}</p>
          <Row label="Incassato" value={formatCents(settlement.incassato[party])} />
          <Row label="Quota" value={value(settlement.quota?.[party])} />
          <Row label="Rimborso spese pagate" value={formatCents(settlement.anticipato[party])} />
          <Row label="Spettanza" value={value(settlement.spettanza?.[party])} strong />
          <Row label="Posizione" value={value(settlement.posizione?.[party])} strong />
        </dl>
      ))}
      <p className="col-span-2 text-xs text-[#5f524c]">
        Spettanza = quota del guadagno + rimborso spese. Posizione = spettanza − incassato (positiva: le spettano soldi).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocco 8: note fiscali personali di Ale (solo organizzatrice)
// ---------------------------------------------------------------------------

function TaxNotes({ data, notes }: { data: AccountsData; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const { message, pending, save } = useSave();
  return (
    <div className="space-y-2">
      <Field label="Note fiscali personali" hint="Non incluse nei calcoli. Le vedi solo tu.">
        <textarea className={`${inputClass} min-h-28 py-2`} value={value} onChange={(e) => setValue(e.target.value)} maxLength={5000} />
      </Field>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <button
        type="button"
        className={buttonClass.secondary}
        disabled={pending}
        onClick={() => save(() => setTaxNotesAction({ workshopId: data.workshop.id, version: data.workshop.version, notes: value }), "Note salvate.")}
      >
        Salva
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stato ed export
// ---------------------------------------------------------------------------

/**
 * D24: stati manuali solo Provvisorio / Verificato (con snapshot e avviso di
 * modifica). Saldato si deduce dal residuo (SettleResidual). D25: chiunque
 * può verificare; si mostra chi l'ha fatto.
 */
function StatusButtons({ data, changed }: { data: AccountsData; changed: boolean }) {
  const { workshop } = data;
  const { message, pending, save } = useSave();
  const set = (status: SettlementStatus) =>
    save(() => setSettlementStatusAction({ workshopId: workshop.id, version: workshop.version, status }), `Stato: ${SETTLEMENT_STATUS_LABELS[status]}.`);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[#5f524c]">Stato della verifica</p>
      <div className="flex flex-wrap gap-2">
        {workshop.status === "provvisorio" ? (
          <button type="button" className={buttonClass.primary} disabled={pending} onClick={() => set("verificato")}>
            Segna come verificato
          </button>
        ) : null}
        {changed && workshop.status === "verificato" ? (
          <button type="button" className={buttonClass.secondary} disabled={pending} onClick={() => set("verificato")}>
            Aggiorna la verifica
          </button>
        ) : null}
        {workshop.status !== "provvisorio" ? (
          <button type="button" className={buttonClass.ghost} disabled={pending} onClick={() => set("provvisorio")}>
            Torna a Provvisorio
          </button>
        ) : null}
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}

function ExportLinks({ workshopId }: { workshopId: string }) {
  return (
    <div className="mt-4 border-t border-[#211815]/10 pt-3">
      <div className="flex flex-wrap gap-2">
        {/* <a> semplici: niente prefetch, ogni apertura è un export registrato nello storico. */}
        <a href={`/gestione/w/${workshopId}/excel`} className={buttonClass.secondary}>
          <Download className="h-5 w-5" aria-hidden="true" /> Excel
        </a>
        <a href={`/gestione/w/${workshopId}/stampa`} target="_blank" rel="noopener" className={buttonClass.secondary}>
          <Printer className="h-5 w-5" aria-hidden="true" /> Stampa / PDF
        </a>
        {/* D27: storico del workshop, per tutti e due i ruoli (per Ale filtrato lato server). */}
        <Link prefetch={false} href={`/gestione/altro/storico?workshop=${workshopId}`} className={buttonClass.secondary}>
          <History className="h-5 w-5" aria-hidden="true" /> Storico
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Conti
// ---------------------------------------------------------------------------

type Destinations = readonly { id: string; name: string; startsOn: string }[];

/** Divisione Peony / Ale: risultato, ripartizione, posizioni, trasferimenti, riporti, verifica. */
function DivisionContent({
  data,
  viewer,
  withSettle,
  changed,
  destinations,
  today,
}: {
  data: AccountsData;
  viewer: OperatorRole;
  withSettle: boolean;
  changed: boolean;
  destinations: Destinations;
  today: string;
}) {
  const { settlement, workshop } = data;
  const executed = data.transfers.filter((t) => t.status === "eseguito").reduce((sum, t) => sum + t.amountCents, 0);
  return (
    <div className="space-y-3">
      {viewer === "admin" ? <ResultBlock data={data} viewer={viewer} today={today} withSettle={withSettle} /> : null}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#5f524c]">Ripartizione</p>
          <SplitBlock data={data} isAdmin={viewer === "admin"} />
        </div>
        <div className="mt-3 space-y-2 lg:mt-0">
          <p className="text-sm font-semibold text-[#5f524c]">Posizione per parte</p>
          <PositionsBlock settlement={settlement} />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#5f524c]">
          Trasferimenti · {data.transfers.length} · eseguiti {formatCents(executed)}
        </p>
        <TransfersBlock workshopId={workshop.id} transfers={data.transfers} residuo={settlement.residuo} today={today} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#5f524c]">Riporti · {data.carryoversIn.length + data.carryoversOut.length}</p>
        <CarryoversBlock
          workshopId={workshop.id}
          carryoversIn={data.carryoversIn}
          carryoversOut={data.carryoversOut}
          residuo={settlement.residuo}
          destinations={destinations}
        />
      </div>
      <StatusButtons data={data} changed={changed} />
    </div>
  );
}

/**
 * 4g (ipotesi 6): tab Conti di Ale. In cima, sempre visibili, la frase "Devi
 * dare X € a Peony / Peony ti deve X € / Siete pari" con "Ho dato X € a
 * Peony", Guadagno, Spese con "+ Spesa" e "Da incassare ancora X €" con il
 * link a chi deve pagare. Tutto il resto (gli stessi numeri di Laura, D25) in
 * "Dettagli", chiuso: entrate (solo il totale, i pagamenti sono in
 * Iscrizioni), spese per categoria, divisione, Excel e Stampa. Niente banner
 * della verifica (#37) né controlli della perdita (#34). Le note fiscali
 * restano (sono solo sue, D7).
 */
function OrganizerAccounts({
  data,
  taxNotes,
  destinations,
  today,
}: {
  data: AccountsData;
  taxNotes?: string | null;
  destinations: Destinations;
  today: string;
}) {
  const { settlement, workshop } = data;
  const phrase = debtPhrase(settlement.residuo, "organizzatrice");
  const changed =
    workshop.status !== "provvisorio" &&
    snapshotChanges(workshop.verifiedSnapshot, settlementSnapshot(settlement, workshop.lossPeonyCents)).length > 0;
  return (
    <div className="space-y-3">
      <div className={`${cardClass} space-y-2 p-3`}>
        {phrase ? (
          <p className={`font-serif text-2xl font-medium leading-tight ${settlement.residuo === 0 ? "text-[#2f5d3b]" : "text-[#a8583e]"}`}>{phrase}</p>
        ) : (
          <p className="text-[15px] font-semibold text-[#7a5212]">{settlement.utile < 0 ? LOSS_FOR_ALE : settlement.frase}</p>
        )}
        <SettleResidual data={data} viewer="organizzatrice" today={today} />
      </div>

      <FinanceDashboard data={data} />

      {/* "+ Spesa" sempre accessibile senza aprire i dettagli. */}
      <AddExpense workshopId={workshop.id} today={today} defaultPaidBy="redsabbath" />
      {data.recap.daIncassare > 0 ? (
        <Link prefetch={false}
          href={`/gestione/w/${workshop.id}?tab=iscrizioni&filtro=da-pagare`}
          className="inline-flex min-h-10 items-center text-sm font-semibold text-[#a8583e] underline">
          Vedi chi deve pagare
        </Link>
      ) : null}

      <Section title="Dettagli">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#5f524c]">Entrate dai partecipanti</p>
            <p className="text-sm">
              
              <Link prefetch={false} href={`/gestione/w/${workshop.id}?tab=iscrizioni`} className="inline-flex min-h-10 items-center font-semibold text-[#a8583e] underline">
                vedi in Iscrizioni
              </Link>
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#5f524c]">
              Spese per categoria
            </p>
            <ExpensesBlock workshopId={workshop.id} expenses={data.expenses} today={today} showAdd={false} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#5f524c]">
              Divisione {PARTY_LABELS.peony} / {PARTY_LABELS.redsabbath}
            </p>
            <DivisionContent data={data} viewer="organizzatrice" withSettle={false} changed={changed} destinations={destinations} today={today} />
          </div>
          <ExportLinks workshopId={workshop.id} />
        </div>
      </Section>

      {taxNotes !== undefined ? (
        <Section title="Note fiscali" summary={taxNotes ? "scritte" : "vuote"}>
          <TaxNotes data={data} notes={taxNotes} />
        </Section>
      ) : null}
    </div>
  );
}

/**
 * Tab Conti (D23) degli admin: in cima Entrate · Spese · Guadagno e "Da
 * incassare" (più l'avviso "modificato dopo la verifica"); sotto, chiuse e col
 * totale visibile: Entrate dai partecipanti, Spese, Divisione Peony / Ale. In
 * fondo l'export. Ale ha la sua vista (OrganizerAccounts, 4g): stessi numeri.
 */
export function AccountsTab({
  data,
  isAdmin,
  taxNotes,
  destinations,
  today,
}: {
  data: AccountsData;
  isAdmin: boolean;
  taxNotes?: string | null;
  destinations: Destinations;
  today: string;
}) {
  if (!isAdmin) return <OrganizerAccounts data={data} taxNotes={taxNotes} destinations={destinations} today={today} />;

  const { settlement, workshop } = data;
  const changes =
    workshop.status !== "provvisorio"
      ? snapshotChanges(workshop.verifiedSnapshot, settlementSnapshot(settlement, workshop.lossPeonyCents))
      : [];

  return (
    <div>
      <Summary data={data} changes={changes} />

      <Section
        title="Pagamenti ricevuti"
        summary={`${data.income.length} ${data.income.length === 1 ? "iscrizione" : "iscrizioni"}`}
      >
        <IncomeBlock data={data} isAdmin />
      </Section>

      <Section title="Spese registrate" summary={`${data.expenses.length} movimenti`}>
        <ExpensesBlock workshopId={workshop.id} expenses={data.expenses} today={today} />
      </Section>

      <Section title="Conguaglio e ripartizione" summary={residuoShort(settlement.residuo, "admin")}>
        <DivisionContent data={data} viewer="admin" withSettle changed={changes.length > 0} destinations={destinations} today={today} />
      </Section>

      <ExportLinks workshopId={workshop.id} />
    </div>
  );
}
