"use client";

// Altri nomi della persona (4d, B2, solo admin): chip eliminabili e
// "+ Aggiungi". Dopo un nuovo nome (o nickname) con iscrizioni "da abbinare"
// che lo usano: "Abbina anche N iscrizioni con «X»", con conferma.

import { X } from "lucide-react";
import { useState, useTransition } from "react";

import { addAliasAction, deleteAliasAction, linkPendingEntriesAction } from "@/app/gestione/(app)/p/alias-actions";
import type { PersonAlias } from "@/lib/gestionale/aliases";
import { DELETE_HINTS } from "@/lib/gestionale/deletions";

import { DeleteConfirm } from "./Deletion";
import { Notice, buttonClass, compactInputClass } from "./ui";

/** "Abbina anche N iscrizioni con «X»" → conferma sul posto. */
export function LinkPendingPrompt({ personId, text, count, onDone }: { personId: string; text: string; count: number; onDone: (message: string, ok: boolean) => void }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  if (count === 0) return null;
  const label = `Abbina anche ${count} ${count === 1 ? "iscrizione" : "iscrizioni"} con «${text}»`;
  return (
    <div className="space-y-2 rounded-xl bg-[#fdf3e1] p-3 text-sm">
      {asking ? (
        <>
          <p className="font-semibold">
            Abbinare a questa persona {count === 1 ? "l'iscrizione «da abbinare» scritta" : `le ${count} iscrizioni «da abbinare» scritte`} come «{text}»?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass.primary}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await linkPendingEntriesAction({ personId, text });
                  onDone(
                    result.ok
                      ? `Abbinate ${result.data.linked} iscrizioni${result.data.failed ? ` (${result.data.failed} non riuscite: ricarica e riprova)` : ""}.`
                      : result.error,
                    result.ok,
                  );
                })
              }
            >
              {pending ? "Abbinamento…" : "Abbina"}
            </button>
            <button type="button" className={buttonClass.ghost} disabled={pending} onClick={() => onDone("", true)} autoFocus>
              Non ora
            </button>
          </div>
        </>
      ) : (
        <button type="button" className={buttonClass.secondary} onClick={() => setAsking(true)}>
          {label}
        </button>
      )}
    </div>
  );
}

export function PersonAliases({ personId, aliases }: { personId: string; aliases: PersonAlias[] }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState<{ text: string; count: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [removing, setRemoving] = useState<PersonAlias | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const alias = text.trim();
    if (!alias) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addAliasAction({ personId, alias });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setText("");
      setAdding(false);
      setPrompt(result.data.pending > 0 ? { text: alias, count: result.data.pending } : null);
      setMessage({ tone: "success", text: `Aggiunto «${alias}».` });
    });
  }


  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#5f524c]">Altri nomi</p>
      <div className="flex flex-wrap items-center gap-2">
        {aliases.map((alias) => (
          <span key={alias.id} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[#211815]/15 bg-white pl-3 text-sm">
            {alias.alias}
            <button
              type="button"
              aria-label={`Togli ${alias.alias}`}
              className="flex h-10 w-10 items-center justify-center text-[#5f524c]"
              disabled={pending}
              onClick={() => {
                setMessage(null);
                setRemoving(alias);
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        ))}
        {adding ? (
          <span className="flex flex-wrap items-center gap-2">
            <input
              className={`${compactInputClass} w-48`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="nome d'arte, @handle…"
              maxLength={100}
              autoFocus
            />
            <button type="button" className={buttonClass.secondary} disabled={pending || !text.trim()} onClick={add}>
              Aggiungi
            </button>
            <button type="button" className={buttonClass.ghost} onClick={() => setAdding(false)}>
              Chiudi
            </button>
          </span>
        ) : (
          <button type="button" className={buttonClass.ghost} onClick={() => setAdding(true)}>
            + Aggiungi
          </button>
        )}
      </div>
      {/* 4e (#23): come le altre eliminazioni, conferma sul posto e "Eliminato · Annulla". */}
      {removing ? (
        <DeleteConfirm
          key={removing.id}
          question={`Togliere «${removing.alias}» dagli altri nomi?`}
          hint={DELETE_HINTS.generic}
          entity="person_alias"
          id={removing.id}
          remove={() => deleteAliasAction({ id: removing.id })}
          onClose={() => setRemoving(null)}
        />
      ) : null}
      {prompt ? (
        <LinkPendingPrompt
          personId={personId}
          text={prompt.text}
          count={prompt.count}
          onDone={(done, ok) => {
            setPrompt(null);
            if (done) setMessage({ tone: ok ? "success" : "error", text: done });
          }}
        />
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}
