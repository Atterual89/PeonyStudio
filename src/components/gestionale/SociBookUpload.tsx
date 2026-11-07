"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadSociBookAction } from "@/app/gestione/(app)/soci/sync/actions";

export function SociBookUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await uploadSociBookAction(formData);
        if (result.ok) {
          setMessage({ ok: true, text: `Importate ${result.rows} righe. ${result.created} nuovi, ${result.updated} aggiornati. Backup: ${result.backup}.` });
          if (input.current) input.current.value = "";
          router.refresh();
        } else setMessage({ ok: false, text: result.message });
      } catch {
        setMessage({ ok: false, text: "Caricamento non completato. Verifica prima di riprovare." });
      }
    });
  }

  return (
    <details className="mt-3 rounded-xl border border-[#211815]/10 bg-white/65 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Carica libro soci Team Artist (.xlsx)</summary>
      <p className="mt-2 text-xs text-[#5f524c]">Aggiorna il tab Libro Soci nel Google Sheet e il gestionale. Prima dell'import viene creato un backup; non vengono eliminati soci dal database.</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required
          aria-label="Export libro soci Team Artist" disabled={busy}
          className="min-w-0 max-w-full flex-1 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-[#f2ede3] file:px-3 file:py-2" />
        <button type="submit" disabled={busy}
          className="min-h-10 rounded-xl bg-[#a8583e] px-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Importazione…" : "Carica e aggiorna"}
        </button>
      </form>
      {message ? <p role={message.ok ? "status" : "alert"}
        className={`mt-2 text-xs ${message.ok ? "text-[#326941]" : "text-[#9b2c2c]"}`}>{message.text}</p> : null}
    </details>
  );
}
