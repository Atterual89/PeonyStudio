"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { addExpenseAction, deleteExpenseAction, updateExpenseAction } from "@/app/gestione/(app)/w/accounts-actions";
import { expensesByCategory, type Expense } from "@/lib/gestionale/accounts";
import { DELETE_HINTS } from "@/lib/gestionale/deletions";
import { centsToInput, formatCents, formatDate } from "@/lib/gestionale/format";
import { EXPENSE_CATEGORY_LABELS, PARTY_LABELS, partyOfRole } from "@/lib/gestionale/labels";
import type { ExpenseCategory, Party } from "@/lib/gestionale/types";

import { DeleteConfirm } from "./Deletion";
import { ChoiceSelect, Field, Notice, RowMenu, buttonClass, inputClass } from "./ui";

const CATEGORY_OPTIONS = (Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((value) => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}));
export const PARTY_OPTIONS = (Object.keys(PARTY_LABELS) as Party[]).map((value) => ({ value, label: PARTY_LABELS[value] }));

/** "+ Spesa" e "Modifica": importo · categoria · descrizione · pagata da · data (4e, #20: oggi per una spesa nuova). */
function ExpenseForm({
  workshopId,
  expense,
  today,
  onDone,
  defaultPaidBy = "peony",
}: {
  workshopId: string;
  expense: Expense | null;
  today: string;
  onDone: (message: string) => void;
  /** 4g (#36): chi ha pagato, per una spesa nuova (Ale: sé stessa). */
  defaultPaidBy?: Party;
}) {
  const [amount, setAmount] = useState(expense ? centsToInput(expense.amountCents) : "");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "altro");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [advancedBy, setAdvancedBy] = useState<Party>(expense?.advancedBy ?? defaultPaidBy);
  const [spentOn, setSpentOn] = useState(expense ? (expense.spentOn ?? "") : today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const fields = { amount, category, description, advancedBy, spentOn };
    startTransition(async () => {
      const result = expense
        ? await updateExpenseAction({ id: expense.id, version: expense.version, fields })
        : await addExpenseAction({ workshopId, fields });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(expense ? "Spesa aggiornata." : "Spesa registrata.");
    });
  }

  return (
    <div className="space-y-3 rounded-xl bg-[#f2ede3] p-3">
      <p className="font-semibold">{expense ? "Modifica spesa" : "Nuova spesa"}</p>
      <Field label="Importo">
        <input
          inputMode="decimal"
          className={inputClass}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="es. 120 o 120,50"
          autoFocus
        />
      </Field>
      <ChoiceSelect label="Categoria (facoltativa)" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
      <Field label="Descrizione">
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="es. volo andata" maxLength={200} />
      </Field>
      <ChoiceSelect label="Pagata da" options={PARTY_OPTIONS} value={advancedBy} onChange={setAdvancedBy} />
      <Field label="Data">
        <input type="date" className={inputClass} value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
      </Field>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass.primary} onClick={submit} disabled={pending}>
          {pending ? "Salvataggio…" : expense ? "Registra modifica" : "Registra spesa"}
        </button>
        <button type="button" className={buttonClass.ghost} onClick={() => onDone("")} disabled={pending}>
          Chiudi
        </button>
      </div>
    </div>
  );
}

/** 4e (#20, D25): data · categoria · pagata da (4g) · inserita da. */
export function expenseDetail(expense: Expense): string {
  return [
    expense.spentOn ? formatDate(expense.spentOn) : "senza data",
    EXPENSE_CATEGORY_LABELS[expense.category],
    `pagata da ${PARTY_LABELS[expense.advancedBy]}`,
    `inserita da ${partyOfRole(expense.createdByRole)}`,
  ].join(" · ");
}

/**
 * 4g (#36): solo "+ Spesa" e il suo modulo, per la cima del tab Conti di Ale.
 */
export function AddExpense({ workshopId, today, defaultPaidBy }: { workshopId: string; today: string; defaultPaidBy: Party }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {message ? <Notice tone="success">{message}</Notice> : null}
      {open ? (
        <ExpenseForm
          workshopId={workshopId}
          expense={null}
          today={today}
          defaultPaidBy={defaultPaidBy}
          onDone={(text) => {
            setOpen(false);
            setMessage(text || null);
          }}
        />
      ) : (
        <button
          type="button"
          className={buttonClass.secondary}
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
        >
          <Plus className="h-5 w-5" aria-hidden="true" /> Spesa
        </button>
      )}
    </div>
  );
}

/**
 * Spese per categoria col totale; tocco → singole spese con menu "…"
 * (Modifica, Elimina); "+ Spesa" (`showAdd`: falso dove "+ Spesa" è già in
 * cima). D25: modificabili da tutti, con "inserita da".
 */
export function ExpensesBlock({
  workshopId,
  expenses,
  today,
  showAdd = true,
}: {
  workshopId: string;
  expenses: readonly Expense[];
  today: string;
  showAdd?: boolean;
}) {
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [openCategory, setOpenCategory] = useState<ExpenseCategory | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const groups = expensesByCategory(expenses);

  function done(text: string) {
    setEditing(null);
    setMessage(text ? { tone: "success", text } : null);
  }

  const menu = (expense: Expense) => (
    <RowMenu
      label="Altre azioni sulla spesa"
      items={[
        { label: "Modifica", onClick: () => setEditing(expense) },
        {
          label: "Elimina",
          danger: true,
          onClick: () => {
            setMessage(null);
            setDeleting(expense);
          },
        },
      ]}
    />
  );

  return (
    <div className="space-y-3">
      {groups.length === 0 ? <p className="text-sm text-[#5f524c]">Nessuna spesa registrata.</p> : null}

      {/* Una riga per categoria col totale; tocco → le singole spese (D23). */}
      {groups.length > 0 ? (
        <ul className="divide-y divide-[#211815]/5 rounded-xl border border-[#211815]/10 bg-white">
          {groups.map((group) => {
            const open = openCategory === group.category;
            return (
              <li key={group.category}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenCategory(open ? null : group.category)}
                  className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold"
                >
                  <span>
                    {group.label} <span className="font-normal text-[#5f524c]">· {group.expenses.length}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {formatCents(group.totalCents)}
                    <ChevronDown className={`h-4 w-4 text-[#5f524c] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </span>
                </button>
                {open ? (
                  <ul className="divide-y divide-[#211815]/5 border-t border-[#211815]/5 bg-[#f2ede3]/40">
                    {group.expenses.map((expense) => (
                      <li key={expense.id} className="flex items-center justify-between gap-2 py-2 pl-5 pr-2 text-sm">
                        <span>
                          {expense.description}
                          <span className="block text-[#5f524c]">{expenseDetail(expense)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <strong>{formatCents(expense.amountCents)}</strong>
                          {menu(expense)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {deleting ? (
        <DeleteConfirm
          key={deleting.id}
          question={`Eliminare la spesa "${deleting.description}" di ${formatCents(deleting.amountCents)}?`}
          hint={DELETE_HINTS.generic}
          entity="expense"
          id={deleting.id}
          remove={() => deleteExpenseAction({ id: deleting.id, version: deleting.version })}
          onClose={() => setDeleting(null)}
        />
      ) : null}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {editing ? (
        <ExpenseForm
          key={editing === "new" ? "new" : editing.id}
          workshopId={workshopId}
          expense={editing === "new" ? null : editing}
          today={today}
          onDone={done}
        />
      ) : showAdd ? (
        <button type="button" className={buttonClass.secondary} onClick={() => setEditing("new")}>
          <Plus className="h-5 w-5" aria-hidden="true" /> Spesa
        </button>
      ) : null}
    </div>
  );
}
