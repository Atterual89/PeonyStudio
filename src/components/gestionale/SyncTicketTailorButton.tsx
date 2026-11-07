"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { syncTicketTailorFromGestionale } from "@/app/gestione/(app)/peony/sync/actions";

export function SyncTicketTailorButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function sync() {
    setResult(null);
    startTransition(async () => {
      try {
        const response = await syncTicketTailorFromGestionale();
        if (response.ok) {
          setResult({
            ok: true,
            text: `Sincronizzazione completata: ${response.events} eventi, ${response.orders} ordini e ${response.tickets} biglietti aggiornati.${response.warnings ? ` Avvisi: ${response.warnings}.` : ""}`,
          });
          router.refresh();
        } else {
          setResult({ ok: false, text: response.message });
        }
      } catch {
        setResult({ ok: false, text: "Impossibile completare la sincronizzazione. Verifica la connessione e riprova." });
      }
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={sync} disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#a8583e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#923e2b] disabled:cursor-wait disabled:opacity-65 sm:w-auto">
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
        {pending ? "Sincronizzazione in corso…" : "Sincronizza Ticket Tailor"}
      </button>
      {pending ? (
        <p role="status" className="text-xs text-[#5f524c]">
          Aggiorno eventi, ordini e biglietti. Non chiudere questa pagina durante l'operazione.
        </p>
      ) : null}
      {result ? (
        <div role={result.ok ? "status" : "alert"} className={`rounded-xl border p-3 text-sm ${result.ok
          ? "border-[#326941]/30 bg-white/75 text-[#326941]"
          : "border-[#9b4b1e]/30 bg-[#f3e8d4] text-[#733a18]"
        }`}>
          {result.text}
        </div>
      ) : null}
    </div>
  );
}
