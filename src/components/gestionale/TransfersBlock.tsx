"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import {
  addTransferAction,
  carryResidualAction,
  deleteCarryoverAction,
  deleteTransferAction,
  markTransferExecutedAction,
} from "@/app/gestione/(app)/w/accounts-actions";
import type { Carryover, Transfer } from "@/lib/gestionale/accounts";
import { DELETE_HINTS } from "@/lib/gestionale/deletions";
import { centsToInput, formatCents, formatDate, formatDateRange } from "@/lib/gestionale/format";
import { PARTY_LABELS, TRANSFER_STATUS_LABELS } from "@/lib/gestionale/labels";
import type { ActionResult, Party, TransferStatus } from "@/lib/gestionale/types";

import { DeleteConfirm } from "./Deletion";
import { PARTY_OPTIONS } from "./ExpensesBlock";
import { ChoiceSelect, Field, Notice, RowMenu, buttonClass, inputClass } from "./ui";

type Message = { tone: "success" | "error"; text: string } | null;

const STATUS_OPTIONS = (Object.keys(TRANSFER_STATUS_LABELS) as TransferStatus[]).map((value) => ({
  value,
  label: TRANSFER_STATUS_LABELS[value],
}));

function other(party: Party): Party {
  return party === "peony" ? "redsabbath" : "peony";
}

function useRowAction() {
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? { tone: "success", text: success } : { tone: "error", text: result.error });
    });
  }
  return { message, setMessage, pending, run };
}

/** "+ Trasferimento": da (l'altra parte è il destinatario), importo, stato, data. */
function TransferForm({
  workshopId,
  suggestion,
  today,
  onDone,
}: {
  workshopId: string;
  suggestion: { fromParty: Party; amountCents: number } | null;
  today: string;
  onDone: (message: string) => void;
}) {
  const [fromParty, setFromParty] = useState<Party>(suggestion?.fromParty ?? "redsabbath");
  const [amount, setAmount] = useState(suggestion ? centsToInput(suggestion.amountCents) : "");
  const [status, setStatus] = useState<TransferStatus>("eseguito");
  const [executedOn, setExecutedOn] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addTransferAction({ workshopId, fields: { fromParty, amount, status, executedOn, notes } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone("Trasferimento registrato.");
    });
  }

  return (
    <div className="space-y-3 rounded-xl bg-[#f2ede3] p-3">
      <p className="font-semibold">Nuovo trasferimento</p>
      <ChoiceSelect label="Da" options={PARTY_OPTIONS} value={fromParty} onChange={setFromParty} />
      <p className="text-sm text-[#5f524c]">A: {PARTY_LABELS[other(fromParty)]}</p>
      <Field label="Importo">
        <input inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="es. 950 o 950,50" />
      </Field>
      <ChoiceSelect label="Stato" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      {status === "eseguito" ? (
        <Field label="Data">
          <input type="date" className={inputClass} value={executedOn} onChange={(e) => setExecutedOn(e.target.value)} />
        </Field>
      ) : null}
      <Field label="Note">
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="facoltative" />
      </Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass.primary} onClick={submit} disabled={pending}>
          {pending ? "Salvataggio…" : "Registra trasferimento"}
        </button>
        <button type="button" className={buttonClass.ghost} onClick={() => onDone("")} disabled={pending}>
          Chiudi
        </button>
      </div>
    </div>
  );
}

function transferTitle(transfer: Transfer): string {
  return `${PARTY_LABELS[transfer.fromParty]} → ${PARTY_LABELS[transfer.toParty]}`;
}

/** Blocco 6: trasferimenti, "+ Trasferimento", "Segna come eseguito". */
export function TransfersBlock({
  workshopId,
  transfers,
  residuo,
  today,
}: {
  workshopId: string;
  transfers: readonly Transfer[];
  /** Residuo attuale, per precompilare il modulo. */
  residuo: number | null;
  today: string;
}) {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Transfer | null>(null);
  const { message, setMessage, pending, run } = useRowAction();
  const suggestion = residuo ? { fromParty: (residuo > 0 ? "redsabbath" : "peony") as Party, amountCents: Math.abs(residuo) } : null;

  const markExecuted = (transfer: Transfer) =>
    run(() => markTransferExecutedAction({ id: transfer.id, version: transfer.version, executedOn: today }), "Trasferimento registrato come eseguito.");
  const actions = (transfer: Transfer) => (
    <span className="flex items-center gap-1">
      {transfer.status === "da_eseguire" ? (
        <button type="button" className={buttonClass.ghost} onClick={() => markExecuted(transfer)} disabled={pending}>
          Registra come eseguito
        </button>
      ) : null}
      <RowMenu
        label="Altre azioni sul trasferimento"
        items={[
          {
            label: "Elimina",
            danger: true,
            onClick: () => {
              setMessage(null);
              setDeleting(transfer);
            },
          },
        ]}
      />
    </span>
  );
  const statusText = (transfer: Transfer) =>
    transfer.status === "eseguito"
      ? `Eseguito${transfer.executedOn ? ` il ${formatDate(transfer.executedOn)}` : ""}`
      : TRANSFER_STATUS_LABELS.da_eseguire;

  return (
    <div className="space-y-3">
      {transfers.length === 0 ? <p className="text-sm text-[#5f524c]">Nessun trasferimento.</p> : null}

      <ul className="divide-y divide-[#211815]/5 rounded-xl border border-[#211815]/10 bg-white lg:hidden">
        {transfers.map((transfer) => (
          <li key={transfer.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              {transferTitle(transfer)} · <strong>{formatCents(transfer.amountCents)}</strong>
              <span className="block text-[#5f524c]">
                {statusText(transfer)}
                {transfer.notes ? ` · ${transfer.notes}` : ""}
              </span>
            </span>
            {actions(transfer)}
          </li>
        ))}
      </ul>

      {transfers.length > 0 ? (
        <table className="hidden w-full rounded-xl border border-[#211815]/10 bg-white text-sm lg:table">
          <thead className="bg-[#211815]/5 text-left text-[#5f524c]">
            <tr>
              <th className="px-3 py-2 font-medium">Da → a</th>
              <th className="px-3 py-2 text-right font-medium">Importo</th>
              <th className="px-3 py-2 font-medium">Stato</th>
              <th className="px-3 py-2 font-medium">Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-t border-[#211815]/5">
                <td className="px-3 py-1.5">{transferTitle(transfer)}</td>
                <td className="px-3 py-1.5 text-right">{formatCents(transfer.amountCents)}</td>
                <td className="px-3 py-1.5">{statusText(transfer)}</td>
                <td className="px-3 py-1.5 text-[#5f524c]">{transfer.notes ?? ""}</td>
                <td className="px-1">{actions(transfer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {deleting ? (
        <DeleteConfirm
          key={deleting.id}
          question={`Eliminare il trasferimento ${transferTitle(deleting)} di ${formatCents(deleting.amountCents)}?`}
          hint={DELETE_HINTS.generic}
          entity="transfer"
          id={deleting.id}
          remove={() => deleteTransferAction({ id: deleting.id, version: deleting.version })}
          onClose={() => setDeleting(null)}
        />
      ) : null}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {adding ? (
        <TransferForm
          workshopId={workshopId}
          suggestion={suggestion}
          today={today}
          onDone={(text) => {
            setAdding(false);
            setMessage(text ? { tone: "success", text } : null);
          }}
        />
      ) : (
        <button type="button" className={buttonClass.secondary} onClick={() => setAdding(true)}>
          <Plus className="h-5 w-5" aria-hidden="true" /> Trasferimento
        </button>
      )}
    </div>
  );
}

function carryoverText(carryover: Carryover): string {
  return `${PARTY_LABELS[carryover.debtor]} deve ${formatCents(carryover.amountCents)} a ${PARTY_LABELS[carryover.creditor]}`;
}

function CarryoverList({
  title,
  carryovers,
  direction,
  onDelete,
}: {
  title: string;
  carryovers: readonly Carryover[];
  direction: "da" | "verso";
  onDelete: (carryover: Carryover) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#5f524c]">{title}</p>
      {carryovers.length === 0 ? (
        <p className="mt-1 text-sm text-[#5f524c]">Nessuno.</p>
      ) : (
        <>
          <ul className="mt-1 divide-y divide-[#211815]/5 rounded-xl border border-[#211815]/10 bg-white lg:hidden">
            {carryovers.map((carryover) => (
              <li key={carryover.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {carryoverText(carryover)}
                  <span className="block text-[#5f524c]">
                    {direction} {carryover.otherWorkshop.name}
                    {carryover.notes ? ` · ${carryover.notes}` : ""}
                  </span>
                </span>
                <RowMenu label="Altre azioni sul riporto" items={[{ label: "Elimina", danger: true, onClick: () => onDelete(carryover) }]} />
              </li>
            ))}
          </ul>
          <table className="mt-1 hidden w-full rounded-xl border border-[#211815]/10 bg-white text-sm lg:table">
            <thead className="bg-[#211815]/5 text-left text-[#5f524c]">
              <tr>
                <th className="px-3 py-2 font-medium">{direction === "da" ? "Da workshop" : "Verso workshop"}</th>
                <th className="px-3 py-2 font-medium">Chi deve a chi</th>
                <th className="px-3 py-2 text-right font-medium">Importo</th>
                <th className="px-3 py-2 font-medium">Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {carryovers.map((carryover) => (
                <tr key={carryover.id} className="border-t border-[#211815]/5">
                  <td className="px-3 py-1.5">{carryover.otherWorkshop.name}</td>
                  <td className="px-3 py-1.5">
                    {PARTY_LABELS[carryover.debtor]} → {PARTY_LABELS[carryover.creditor]}
                  </td>
                  <td className="px-3 py-1.5 text-right">{formatCents(carryover.amountCents)}</td>
                  <td className="px-3 py-1.5 text-[#5f524c]">{carryover.notes ?? ""}</td>
                  <td className="px-1">
                    <RowMenu label="Altre azioni sul riporto" items={[{ label: "Elimina", danger: true, onClick: () => onDelete(carryover) }]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Blocco 7: riporti in entrata e in uscita, "+ Riporta l'importo da trasferire su un altro workshop". */
export function CarryoversBlock({
  workshopId,
  carryoversIn,
  carryoversOut,
  residuo,
  destinations,
}: {
  workshopId: string;
  carryoversIn: readonly Carryover[];
  carryoversOut: readonly Carryover[];
  residuo: number | null;
  destinations: readonly { id: string; name: string; startsOn: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [destinationId, setDestinationId] = useState("");
  const [notes, setNotes] = useState("");
  const [deleting, setDeleting] = useState<Carryover | null>(null);
  const { message, setMessage, pending, run } = useRowAction();

  const remove = (carryover: Carryover) => {
    setMessage(null);
    setDeleting(carryover);
  };

  function carry() {
    if (!destinationId) {
      setMessage({ tone: "error", text: "Scegli il workshop di destinazione." });
      return;
    }
    run(async () => {
      const result = await carryResidualAction({ workshopId, destinationId, notes });
      if (result.ok) {
        setOpen(false);
        setDestinationId("");
        setNotes("");
      }
      return result;
    }, "Importo riportato.");
  }

  return (
    <div className="space-y-3">
      <CarryoverList title="In entrata (da altri workshop)" carryovers={carryoversIn} direction="da" onDelete={remove} />
      <CarryoverList title="In uscita (verso altri workshop)" carryovers={carryoversOut} direction="verso" onDelete={remove} />

      {deleting ? (
        <DeleteConfirm
          key={deleting.id}
          question={`Eliminare il riporto "${carryoverText(deleting)}" (${deleting.otherWorkshop.name})?`}
          hint={DELETE_HINTS.generic}
          entity="carryover"
          id={deleting.id}
          remove={() => deleteCarryoverAction({ id: deleting.id, version: deleting.version })}
          onClose={() => setDeleting(null)}
        />
      ) : null}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {residuo ? (
        open ? (
          <div className="space-y-3 rounded-xl bg-[#f2ede3] p-3">
            <p className="font-semibold">Riporta su un altro workshop</p>
            <p className="text-sm">
              {residuo > 0
                ? `${PARTY_LABELS.redsabbath} deve ${formatCents(residuo)} a ${PARTY_LABELS.peony}`
                : `${PARTY_LABELS.peony} deve ${formatCents(-residuo)} a ${PARTY_LABELS.redsabbath}`}
              : l&apos;importo si sposta sul workshop scelto e qui non resta niente da trasferire.
            </p>
            <Field label="Workshop di destinazione">
              <select className={inputClass} value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
                <option value="">Scegli…</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {formatDateRange(d.startsOn, null)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note">
              <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="facoltative" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass.primary} onClick={carry} disabled={pending}>
                {pending ? "Salvataggio…" : "Riporta"}
              </button>
              <button type="button" className={buttonClass.ghost} onClick={() => setOpen(false)} disabled={pending}>
                Chiudi
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={buttonClass.secondary} onClick={() => setOpen(true)} disabled={destinations.length === 0}>
            <Plus className="h-5 w-5" aria-hidden="true" /> Riporta l&apos;importo da trasferire su un altro workshop
          </button>
        )
      ) : null}
    </div>
  );
}
