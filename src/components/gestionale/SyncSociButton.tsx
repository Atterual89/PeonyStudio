"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import {
  applySociSyncAction,
  previewSociSyncAction,
} from "@/app/gestione/(app)/soci/sync/actions";

type Preview = Extract<Awaited<ReturnType<typeof previewSociSyncAction>>, { ok: true }>;

export function SyncSociButton() {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function checkSources() {
    setPreview(null);
    setResult(null);
    startTransition(async () => {
      try {
        const response = await previewSociSyncAction();
        if (!response.ok) {
          setResult({ ok: false, message: response.message });
          return;
        }
        const totalChanges = response.forms.creates + response.forms.updates +
          response.book.creates + response.book.updates;
        if (totalChanges === 0) {
          setResult({ ok: true, message: "Soci già aggiornati rispetto ai due fogli disponibili. TeamArtist non è interrogato direttamente." });
          return;
        }
        setPreview(response);
      } catch {
        setResult({ ok: false, message: "Impossibile leggere le fonti associative. Riprova più tardi." });
      }
    });
  }

  function apply() {
    if (!preview || busy) return;
    const token = preview.token;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await applySociSyncAction(token);
        setPreview(null);
        if (response.ok) {
          setResult({
            ok: true,
            message: `Soci aggiornati: ${response.forms.created} domande nuove, ${response.forms.updated} modificate; ${response.book.created} soci nuovi, ${response.book.updated} modificati.${response.warnings ? ` ${response.warnings} righe da controllare.` : ""}`,
          });
          router.refresh();
        } else {
          setResult({ ok: false, message: response.message });
          router.refresh();
        }
      } catch {
        setResult({ ok: false, message: "Operazione non completata. Non ripetere subito: verifica i dati prima di un nuovo tentativo." });
      }
    });
  }

  const stat = (label: string, row: Preview["forms"]) => (
    <p className="text-sm">
      <strong>{label}:</strong> {row.creates} nuove · {row.updates} aggiornamenti
      {row.invalid > 0 ? <span className="text-[#9b4b1e]"> · {row.invalid} da verificare</span> : null}
    </p>
  );

  return (
    <div className="min-w-0 space-y-2">
      <button type="button" disabled={busy} onClick={checkSources}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8583e] bg-white/85 px-4 text-sm font-semibold text-[#a8583e] disabled:opacity-60 sm:w-auto">
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Controllo soci…" : "Sincronizza soci"}
      </button>

      {preview ? (
        <div className="rounded-xl border border-[#211815]/15 bg-white/90 p-3 text-sm">
          <p className="font-semibold">Modifiche da confermare</p>
          <div className="mt-1 space-y-1">
            {stat("Domande Google", preview.forms)}
            {stat("Libro soci", preview.book)}
          </div>
          <p className="mt-2 text-xs text-[#5f524c]">
            Nessuna riga sarà eliminata. La quota risulta confermata solo nel libro soci;
            il controllo diretto su TeamArtist non è attivo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={apply} disabled={busy}
              className="h-10 rounded-xl bg-[#a8583e] px-3 text-sm font-semibold text-white disabled:opacity-60">
              Conferma aggiornamento
            </button>
            <button type="button" onClick={() => setPreview(null)} disabled={busy}
              className="h-10 rounded-xl border border-[#211815]/20 px-3 text-sm">
              Annulla
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <p role={result.ok ? "status" : "alert"}
          className={`rounded-xl border p-3 text-sm ${result.ok
            ? "border-[#326941]/30 bg-white/75 text-[#326941]"
            : "border-[#9b4b1e]/30 bg-[#f3e8d4] text-[#733a18]"}`}>
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
