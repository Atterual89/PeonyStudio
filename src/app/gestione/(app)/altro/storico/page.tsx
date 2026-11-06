import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { buttonClass, cardClass, inputClass, UI } from "@/components/gestionale/ui";
import {
  AUDIT_PAGE_SIZE,
  auditActionLabel,
  auditChanges,
  auditOperator,
  auditKindsFor,
  auditWhat,
  isAuditKind,
  type AuditEntry,
} from "@/lib/gestionale/audit";
import { displayName, formatDateTime } from "@/lib/gestionale/format";
import { getAuditPage, listOperatorNames } from "@/lib/gestionale/server/audit";
import { requireOperator } from "@/lib/gestionale/server/auth";
import { getPerson, listWorkshopsForCopy } from "@/lib/gestionale/server/data";
import { isUuidLike } from "@/lib/gestionale/validation";

// Fase 5 (D27): storico modifiche, dal più recente, 50 righe per pagina.
// Tutti e due i ruoli: per l'organizzatrice il filtro lo fa il server
// (getAuditPage → gw_audit_list), qui si nascondono solo i filtri che non le
// servono (chi, persona). Filtri nell'URL, così i link "Storico" della scheda
// persona e del tab Conti arrivano già filtrati.

type Params = { chi?: string | string[]; workshop?: string | string[]; tipo?: string | string[]; persona?: string | string[]; pagina?: string | string[] };

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function StoricoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await requireOperator();
  const isAdmin = viewer.role === "admin";
  const params = await searchParams;
  const operatorId = isAdmin && isUuidLike(one(params.chi)) ? one(params.chi)! : null;
  const workshopId = isUuidLike(one(params.workshop)) ? one(params.workshop)! : null;
  const personId = isAdmin && isUuidLike(one(params.persona)) ? one(params.persona)! : null;
  const tipo = one(params.tipo);
  const kind = isAuditKind(tipo, viewer.role) ? tipo : null;
  const kinds = auditKindsFor(viewer.role);
  const page = Math.min(Math.max(Number.parseInt(one(params.pagina) ?? "1", 10) || 1, 1), 10_000);

  const [{ entries, total }, operators, workshops, person] = await Promise.all([
    getAuditPage({ operatorId, workshopId, kind, personId, page }),
    isAdmin ? listOperatorNames() : Promise.resolve([]),
    listWorkshopsForCopy(""),
    personId ? getPerson(personId) : Promise.resolve(null),
  ]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  const href = (changes: Partial<Record<keyof Params, string | null>>) => {
    const query = new URLSearchParams();
    const values: Record<keyof Params, string | null> = {
      chi: operatorId,
      workshop: workshopId,
      tipo: kind,
      persona: personId,
      pagina: page > 1 ? String(page) : null,
      ...changes,
    };
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
    const text = query.toString();
    return `/gestione/altro/storico${text ? `?${text}` : ""}`;
  };

  return (
    <section className="max-w-3xl">
      <Link prefetch={false} href="/gestione/altro" className="text-sm text-[#5f524c] underline">
        ← Altro
      </Link>
      <h1 className="mt-2 font-serif text-xl font-medium">Storico modifiche</h1>
      <p className="mt-1 text-sm text-[#5f524c]">
        {total === 1 ? "1 modifica" : `${total} modifiche`}
        {total > AUDIT_PAGE_SIZE ? ` · pagina ${page} di ${pages}` : ""}
      </p>

      {/* Filtri: un modulo GET, funziona anche senza JavaScript. */}
      <form action="/gestione/altro/storico" className={`${cardClass} mt-3 grid gap-2 p-3 ${isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {personId ? <input type="hidden" name="persona" value={personId} /> : null}
        {isAdmin ? (
          <label className="block min-w-0">
            <span className={UI.label}>Chi</span>
            <select name="chi" defaultValue={operatorId ?? ""} className={inputClass}>
              <option value="">Tutti</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block min-w-0">
          <span className={UI.label}>Workshop</span>
          <select name="workshop" defaultValue={workshopId ?? ""} className={inputClass}>
            <option value="">Tutti</option>
            {workshops.map((workshop) => (
              <option key={workshop.id} value={workshop.id}>
                {workshop.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className={UI.label}>Tipo</span>
          <select name="tipo" defaultValue={kind ?? ""} className={inputClass}>
            <option value="">Tutti</option>
            {kinds.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className={`flex flex-wrap items-center gap-2 ${isAdmin ? "sm:col-span-3" : "sm:col-span-2"}`}>
          <button type="submit" className={buttonClass.primary}>
            Filtra
          </button>
          {operatorId || workshopId || kind || personId ? (
            <Link prefetch={false} href="/gestione/altro/storico" className={buttonClass.ghost}>
              Togli i filtri
            </Link>
          ) : null}
        </div>
      </form>

      {personId ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm">
          Solo: <strong>{person ? displayName(person) : "persona"}</strong>
          <Link prefetch={false} href={href({ persona: null, pagina: null })} className="inline-flex min-h-10 items-center underline">
            togli
          </Link>
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-[#5f524c]">Nessuna modifica con questi filtri.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagine dello storico" className="mt-4 flex items-center justify-between gap-2">
          {page > 1 ? (
            <Link prefetch={false} href={href({ pagina: page - 1 > 1 ? String(page - 1) : null })} className={buttonClass.secondary}>
              ← Più recenti
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-[#5f524c]">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link prefetch={false} href={href({ pagina: String(page + 1) })} className={buttonClass.secondary}>
              Meno recenti →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

/** Riga dello storico: tocco → prima / dopo dei soli campi cambiati. */
function AuditRow({ entry }: { entry: AuditEntry }) {
  const changes = auditChanges(entry.before, entry.after);
  return (
    <li className={cardClass}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block break-words font-semibold">{auditWhat(entry)}</span>
            <span className="block text-sm text-[#5f524c]">
              {formatDateTime(new Date(entry.createdAt))} · {auditOperator(entry)} · {auditActionLabel(entry)}
            </span>
          </span>
          <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-[#5f524c] transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-[#211815]/10 px-3 py-2 text-sm">
          {changes.length === 0 ? (
            <p className="text-[#5f524c]">Nessun campo da mostrare.</p>
          ) : (
            <dl className="space-y-2">
              {changes.map((change) => (
                <div key={change.key} className="min-w-0">
                  <dt className="text-xs font-medium text-[#5f524c]">{change.label}</dt>
                  <dd className="break-words">
                    {entry.before ? <span className="text-[#5f524c] line-through decoration-[#5f524c]/40">{change.before}</span> : null}
                    {entry.before && entry.after ? " → " : null}
                    {entry.after ? <span className="font-medium">{change.after}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {entry.workshopId ? (
            <Link prefetch={false} href={`/gestione/w/${entry.workshopId}`} className="mt-2 inline-flex min-h-10 items-center underline">
              Apri il workshop
            </Link>
          ) : null}
        </div>
      </details>
    </li>
  );
}
