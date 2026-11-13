"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";

import { importClearGoogleFormsAction } from "@/app/gestione/(app)/soci/sync/actions";
import { buttonClass } from "@/components/gestionale/ui";

/** Revisione moduli: archivia le copie doppie e importa i moduli chiari in un clic. */
export function AutoFixFormsButton({ duplicates }: { duplicates: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    setResult(null);
    start(async () => {
      try {
        const r = await importClearGoogleFormsAction();
        setResult(r.ok
          ? { ok: true, text: `${r.consolidated} copie archiviate · ${r.created + r.updated} moduli collegati · ${r.toClarify} restano da chiarire.` }
          : { ok: false, text: r.message });
      } catch {
        setResult({ ok: false, text: "Richiesta interrotta. Nessun dato perso: riprova." });
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <button type="button" onClick={run} disabled={busy} className={buttonClass.primary}>
        <Wand2 aria-hidden="true" className="h-4 w-4" />
        {busy ? "Sistemo…" : `Sistema in automatico${duplicates ? ` le ${duplicates} copie doppie` : ""}`}
      </button>
      <p className="text-xs text-[#5f524c]">Tiene la versione attuale di ogni modulo e archivia le altre. Se i dati non coincidono, lascia il caso qui.</p>
      {result ? <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-[#326941]" : "text-[#9b2c2c]"}`}>{result.text}</p> : null}
    </div>
  );
}
