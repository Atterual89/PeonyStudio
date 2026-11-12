"use client";

// Fase C audit anagrafica: verifica soci nella pagina evento.
// Pallino verde / rosso / giallo per partecipante; i gialli si chiariscono sul
// posto scegliendo la persona. Visibile solo con GW_LINKED_MEMBERSHIP=1.

import { CircleCheck, CircleHelp, CircleX, Copy, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  linkEventSourceAction,
  newPersonForEventSourceAction,
  searchPeopleForLinkAction,
  type EventSourceTarget,
  type LinkSearchResult,
} from "@/app/gestione/(app)/soci/linked-actions";
import type { EventDotColor } from "@/lib/gestionale/linked-membership";

import { Chip, UI, buttonClass, inputClass } from "./ui";

export type EventMembershipRow = {
  key: string;
  /** Come la fonte nomina la persona (nome dell'iscrizione o del biglietto). */
  name: string;
  /** Ruolo, es. "partner di …" (facoltativo). */
  caption?: string | null;
  email: string | null;
  color: EventDotColor;
  reason: string;
  candidates: { id: string; name: string; nickname: string | null; email: string | null }[];
  target: EventSourceTarget;
};

const DOT: Record<EventDotColor, { label: string; className: string; Icon: typeof CircleCheck }> = {
  verde: { label: "In regola", className: "text-[#326941]", Icon: CircleCheck },
  rosso: { label: "Non in regola", className: "text-[#9b2c2c]", Icon: CircleX },
  giallo: { label: "Da chiarire", className: "text-[#7a5212]", Icon: CircleHelp },
};

export function EventMembershipCheck({ rows }: { rows: EventMembershipRow[] }) {
  const [filter, setFilter] = useState<"tutti" | "problemi">("tutti");
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<EventDotColor, number> = { verde: 0, rosso: 0, giallo: 0 };
    for (const row of rows) c[row.color] += 1;
    return c;
  }, [rows]);
  const reds = rows.filter((row) => row.color === "rosso");
  const redEmails = [...new Set(reds.map((row) => row.email?.trim()).filter((email): email is string => Boolean(email)))];
  const visible = filter === "tutti" ? rows : rows.filter((row) => row.color !== "verde");
  // Prima i gialli (da chiarire), poi i rossi, poi i verdi.
  const order: Record<EventDotColor, number> = { giallo: 0, rosso: 1, verde: 2 };
  const sorted = [...visible].sort((a, b) => order[a.color] - order[b.color] || a.name.localeCompare(b.name, "it"));

  async function copyRedEmails() {
    try {
      await navigator.clipboard.writeText(redEmails.join(", "));
      setCopied(`Copiate ${redEmails.length} email.`);
    } catch {
      setCopied("Non riesco a copiare: seleziona le email a mano.");
    }
  }

  if (!rows.length) return null;

  return (
    <section aria-labelledby="verifica-soci" className="space-y-3 rounded-2xl border border-[#211815]/10 bg-white/60 p-4">
      <h2 id="verifica-soci" className="font-serif text-xl font-semibold">Verifica soci</h2>

      <div className="grid grid-cols-3 gap-2">
        {(["verde", "rosso", "giallo"] as const).map((color) => (
          <div key={color} className={`rounded-xl p-3 ${color === "giallo" && counts.giallo > 0 ? "border border-[#e6cfa3] bg-[#fdf3e1]" : "bg-white"}`}>
            <p className={`text-2xl font-bold ${DOT[color].className}`}>{counts[color]}</p>
            <p className="text-xs text-[#5f524c]">{DOT[color].label}</p>
          </div>
        ))}
      </div>

      {counts.giallo > 0 ? (
        <p className="text-sm text-[#5f524c]">
          {counts.giallo === 1 ? "1 persona non è ancora chiara" : `${counts.giallo} persone non sono ancora chiare`}: tocca
          la riga per dire chi è. Poi diventa verde o rossa.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copyRedEmails} disabled={redEmails.length === 0} className={buttonClass.secondary}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copia email dei rossi ({redEmails.length})
        </button>
        {reds.length > redEmails.length ? (
          <span className="text-xs text-[#5f524c]">{reds.length - redEmails.length} senza email</span>
        ) : null}
        {copied ? <span role="status" className="text-xs text-[#326941]">{copied}</span> : null}
      </div>

      <div className="flex gap-2" role="group" aria-label="Filtra l'elenco">
        <Chip active={filter === "tutti"} onClick={() => setFilter("tutti")}>Tutti</Chip>
        <Chip active={filter === "problemi"} onClick={() => setFilter("problemi")}>Solo rossi e gialli</Chip>
      </div>

      <ul className="divide-y divide-[#211815]/10 overflow-hidden rounded-xl bg-white">
        {sorted.map((row) => (
          <li key={row.key}>
            {row.color === "giallo" ? (
              <>
                <button
                  type="button"
                  aria-expanded={open === row.key}
                  onClick={() => setOpen(open === row.key ? null : row.key)}
                  className={`${UI.row} flex w-full items-center gap-3 bg-[#fdf3e1] px-3 py-2 text-left`}
                >
                  <RowContent row={row} />
                  <span className="text-sm font-semibold text-[#7a5212]">{open === row.key ? "Chiudi" : "Chiarisci"}</span>
                </button>
                {open === row.key ? <Resolver row={row} onDone={() => setOpen(null)} /> : null}
              </>
            ) : (
              <div className={`${UI.row} flex items-center gap-3 px-3 py-2`}>
                <RowContent row={row} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RowContent({ row }: { row: EventMembershipRow }) {
  const { Icon, className, label } = DOT[row.color];
  return (
    <>
      <Icon className={`h-5 w-5 shrink-0 ${className}`} aria-label={label} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {row.name}
          {row.caption ? <span className="ml-1 text-sm font-normal text-[#5f524c]">{row.caption}</span> : null}
        </span>
        <span className={`block text-xs ${className}`}>{row.reason}</span>
      </span>
    </>
  );
}

export function Resolver({ row, onDone }: { row: EventMembershipRow; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkSearchResult[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [fields, setFields] = useState({ firstName: "", lastName: "", email: row.email ?? "" });

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchPeopleForLinkAction(text);
      if (!cancelled) setResults(found.ok ? found.data : []);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) { setError(result.error ?? "Operazione non riuscita."); return; }
      onDone();
      router.refresh();
    });
  }
  const pick = (personId: string) => run(() => linkEventSourceAction({ target: row.target, personId }));

  return (
    <div className="space-y-3 border-t border-[#e6cfa3] bg-white px-3 py-3">
      <p className="font-serif text-lg font-semibold">Chi è {row.name}?</p>

      {row.candidates.map((candidate, index) => (
        <div key={candidate.id} className={`flex items-center gap-3 rounded-xl p-3 ${index === 0 ? "border-2 border-[#326941]" : "border border-[#211815]/15"}`}>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{candidate.name}</span>
            <span className="block truncate text-xs text-[#5f524c]">
              {[candidate.nickname ? `nickname "${candidate.nickname}"` : null, candidate.email].filter(Boolean).join(" · ") || "Nessun recapito"}
            </span>
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => pick(candidate.id)}
            className={index === 0 ? buttonClass.primary : buttonClass.secondary}
          >
            È lei
          </button>
        </div>
      ))}

      <label className="block text-sm font-semibold" htmlFor={`cerca-${row.key}`}>
        {row.candidates.length ? "Non è lei? Cerca per nome o email" : "Cerca per nome, nickname o email"}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f524c]" aria-hidden="true" />
        <input
          id={`cerca-${row.key}`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${inputClass} pl-9`}
          placeholder="Almeno due lettere"
        />
      </div>
      {query.trim().length >= 2 ? (
        <ul className="space-y-1">
          {results.length === 0 ? <li className="text-sm text-[#5f524c]">Nessuna persona trovata.</li> : null}
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => pick(person.id)}
                className={`${UI.row} flex w-full items-center justify-between gap-2 rounded-lg px-2 text-left hover:bg-[#f2ede3] disabled:opacity-50`}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{person.name}</span>
                  {person.detail ? <span className="block truncate text-xs text-[#5f524c]">{person.detail}</span> : null}
                </span>
                <span className="text-sm font-semibold text-[#326941]">È lei</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2 border-t border-[#211815]/10 pt-3">
        {!showNew ? (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className={`${buttonClass.secondary} w-full`}
          >
            È una persona nuova: aggiungi i dati
          </button>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => newPersonForEventSourceAction({ target: row.target, ...fields }));
            }}
          >
            <p className="text-sm text-[#5f524c]">Serve l'email oppure nome e cognome, così si può verificare l'iscrizione all'associazione.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-semibold">Nome
                <input value={fields.firstName} onChange={(e) => setFields({ ...fields, firstName: e.target.value })} className={`mt-1 ${inputClass} font-normal`} autoComplete="off" />
              </label>
              <label className="text-sm font-semibold">Cognome
                <input value={fields.lastName} onChange={(e) => setFields({ ...fields, lastName: e.target.value })} className={`mt-1 ${inputClass} font-normal`} autoComplete="off" />
              </label>
            </div>
            <label className="block text-sm font-semibold">Email
              <input type="email" value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} className={`mt-1 ${inputClass} font-normal`} autoComplete="off" />
            </label>
            <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full`}>
              Salva come persona nuova
            </button>
          </form>
        )}
      </div>

      {error ? <p role="alert" className="text-sm text-[#9b2c2c]">{error}</p> : null}
      {pending ? <p role="status" className="text-sm text-[#5f524c]">Salvo…</p> : null}
      <p className="text-center text-xs text-[#5f524c]">La scelta si salva subito e vale anche per gli eventi futuri.</p>
    </div>
  );
}
