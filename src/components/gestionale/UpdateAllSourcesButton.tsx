"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { syncTicketTailorPageFromGestionale } from "@/app/gestione/(app)/peony/sync/actions";
import { syncAssociationMailAction } from "@/app/gestione/(app)/quote-email/actions";
import { importClearGoogleFormsAction } from "@/app/gestione/(app)/soci/sync/actions";
import { buttonClass } from "@/components/gestionale/ui";

type Line = { label: string; ok: boolean; text: string };

/**
 * Passo 1 di Verifiche: moduli Google, email delle quote e Ticket Tailor in
 * sequenza. Ogni fonte va avanti anche se un'altra fallisce; il risultato di
 * ognuna resta scritto sotto il pulsante.
 */
export function UpdateAllSourcesButton({ gmailConnected }: { gmailConnected: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  function run() {
    if (busy) return;
    setLines([]);
    start(async () => {
      const out: Line[] = [];
      const push = (line: Line) => { out.push(line); setLines([...out]); };

      setProgress("Moduli Google…");
      try {
        const forms = await importClearGoogleFormsAction();
        push(forms.ok
          ? { label: "Moduli Google", ok: true, text: [
              forms.consolidated ? `${forms.consolidated} copie doppie archiviate` : null,
              forms.created || forms.updated ? `${forms.created} nuovi e ${forms.updated} aggiornati, collegati da soli` : null,
            ].filter(Boolean).join(" · ") || "Nessun modulo nuovo." }
          : { label: "Moduli Google", ok: false, text: forms.message });
      } catch {
        push({ label: "Moduli Google", ok: false, text: "Richiesta interrotta. Nessun dato modificato: riprova." });
      }

      if (gmailConnected) {
        setProgress("Email delle quote…");
        try {
          let imported = 0, more = false, failed: string | null = null;
          for (let page = 0; page < 30; page++) {
            const response = await syncAssociationMailAction();
            if (!response.ok) { failed = response.error; break; }
            imported += response.data.imported;
            more = response.data.hasMore;
            if (!more) break;
          }
          push(failed
            ? { label: "Email quote", ok: false, text: failed }
            : { label: "Email quote", ok: true, text: `${imported} pagamenti nuovi.${more ? " Altre email da leggere: premi di nuovo." : ""}` });
        } catch {
          push({ label: "Email quote", ok: false, text: "Lettura Gmail interrotta. Ripremi per riprendere dall'ultimo punto salvato." });
        }
      } else {
        push({ label: "Email quote", ok: false, text: "Gmail non è collegato: usa «Collega Gmail» qui sotto." });
      }

      setProgress("Ticket Tailor…");
      try {
        let tickets = 0, events = 0, cursor: string | null = null, failed: string | null = null;
        const seen = new Set<string>();
        for (let page = 1; page <= 100; page++) {
          const response = await syncTicketTailorPageFromGestionale(null, cursor, page === 1, false);
          if (!response.ok) { failed = response.message; break; }
          tickets += response.tickets; events += response.events;
          if (!response.nextCursor) break;
          if (seen.has(response.nextCursor)) { failed = "Paginazione ripetuta: fermata per sicurezza."; break; }
          seen.add(response.nextCursor);
          cursor = response.nextCursor;
          setProgress(`Ticket Tailor · pagina ${page + 1}…`);
        }
        push(failed
          ? { label: "Ticket Tailor", ok: false, text: failed }
          : { label: "Ticket Tailor", ok: true, text: `${events} eventi e ${tickets} biglietti aggiornati.` });
      } catch {
        push({ label: "Ticket Tailor", ok: false, text: "Richiesta interrotta. I dati già salvati restano: riprova." });
      }

      setProgress(null);
      router.refresh();
    });
  }

  return (
    <div className="min-w-0 space-y-2">
      <button type="button" onClick={run} disabled={busy} className={buttonClass.primary}>
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Aggiornamento…" : "Aggiorna tutto"}
      </button>
      {busy && progress ? <p role="status" className="text-xs text-[#5f524c]">{progress}</p> : null}
      {lines.length ? (
        <ul className="space-y-1 text-sm">
          {lines.map((line) => (
            <li key={line.label} className={line.ok ? "text-[#326941]" : "text-[#9b2c2c]"}>
              <strong>{line.label}:</strong> {line.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
