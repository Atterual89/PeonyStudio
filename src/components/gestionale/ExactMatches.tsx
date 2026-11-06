"use client";

// 4e (#10): in cima al tab Partecipanti, "Collega le corrispondenze esatte
// (N)" → elenco di controllo (persona → socio proposto, spunte tutte attive)
// → Conferma. Solo corrispondenze esatte e uniche (exact-matches.ts); il
// server le ricalcola alla conferma.

import { useEffect, useState, useTransition } from "react";

import { exactMatchesAction, linkExactMatchesAction } from "@/app/gestione/(app)/w/actions";
import type { ExactMatch } from "@/lib/gestionale/exact-matches";

import { Notice, buttonClass } from "./ui";

export function ExactMatches({ workshopId, notLinked }: { workshopId: string; notLinked: number }) {
  const [matches, setMatches] = useState<ExactMatch[] | null>(null);
  const [open, setOpen] = useState(false);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Si ricalcola quando cambia il numero di persone non collegate.
  useEffect(() => {
    if (notLinked === 0) return;
    let active = true;
    exactMatchesAction({ workshopId }).then((result) => {
      if (active && result.ok) setMatches(result.data);
    });
    return () => {
      active = false;
    };
  }, [workshopId, notLinked]);

  if (notLinked === 0 || !matches || (matches.length === 0 && !message)) return null;
  const picks = matches.filter((match) => !unchecked.has(match.personId));

  function confirm() {
    startTransition(async () => {
      const result = await linkExactMatchesAction({ workshopId, picks: picks.map(({ personId, memberId }) => ({ personId, memberId })) });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setOpen(false);
      setUnchecked(new Set());
      const { linked, failed } = result.data;
      setMessage({
        tone: failed ? "warning" : "success",
        text: `${linked === 1 ? "1 persona collegata" : `${linked} persone collegate`}.${failed ? ` ${failed} non riuscite: ricarica e riprova.` : ""}`,
      });
    });
  }

  return (
    <div className="mt-3 space-y-2">
      {matches.length > 0 && !open ? (
        <button
          type="button"
          className={buttonClass.secondary}
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
        >
          Collega le corrispondenze esatte ({matches.length})
        </button>
      ) : null}
      {open ? (
        <div className="space-y-2 rounded-xl bg-[#f2ede3] p-3 text-sm">
          <p className="font-semibold">Collegare al libro soci queste persone? Togli la spunta a quelle da non collegare.</p>
          <ul className="space-y-1">
            {matches.map((match) => (
              <li key={match.personId}>
                <label className="flex min-h-10 items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-[#a8583e]"
                    checked={!unchecked.has(match.personId)}
                    onChange={(e) =>
                      setUnchecked((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.delete(match.personId);
                        else next.add(match.personId);
                        return next;
                      })
                    }
                  />
                  <span>
                    <strong>{match.personName}</strong> → {match.memberName}
                    {match.memberEmail ? <span className="text-[#5f524c]"> · {match.memberEmail}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass.primary} disabled={pending || picks.length === 0} onClick={confirm}>
              {pending ? "Collegamento…" : `Conferma (${picks.length})`}
            </button>
            <button type="button" className={buttonClass.ghost} disabled={pending} onClick={() => setOpen(false)} autoFocus>
              Chiudi
            </button>
          </div>
        </div>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}
