"use client";

// D27 (Fase 5): spunta "Presente", una per iscrizione (una coppia = 1), sulla
// riga chiusa del tab Iscrizioni di Ale e del tab Partecipanti. Solo sulle
// iscrizioni confermate e dal giorno di inizio del workshop (lo decide chi la
// mostra, con showPresence). Il tocco si vede subito; se il salvataggio non
// riesce torna com'era, con il messaggio. Non cambia lo stato dell'iscrizione.

import { useState } from "react";

import { setPresentAction } from "@/app/gestione/(app)/w/presence-actions";

type Local = { present: boolean; version: number; pending: boolean };

export function PresentToggle({
  booking,
  name,
  compact = false,
}: {
  booking: { bookingId: string; version: number; present: boolean };
  /** Per il lettore di schermo: "Presente: Corvo + Tasso". */
  name: string;
  /** Desktop: solo la casella, nella colonna della tabella. */
  compact?: boolean;
}) {
  const [local, setLocal] = useState<Local | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Il dato locale vale finché il server non ne manda uno più recente.
  const state = local && local.version >= booking.version ? local : { present: booking.present, version: booking.version, pending: false };

  async function toggle(present: boolean) {
    if (state.pending) return;
    setError(null);
    setLocal({ present, version: state.version, pending: true });
    const result = await setPresentAction({ bookingId: booking.bookingId, version: state.version, present });
    if (result.ok) setLocal({ present, version: result.data.version, pending: false });
    else {
      setLocal(null);
      setError(result.error);
    }
  }

  return (
    <span className="block">
      <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 ${compact ? "" : "text-sm font-semibold"}`}>
        <input
          type="checkbox"
          className="h-5 w-5 accent-[#3f7a4f]"
          checked={state.present}
          disabled={state.pending}
          aria-label={compact ? `Presente: ${name}` : undefined}
          onChange={(e) => toggle(e.target.checked)}
        />
        {compact ? null : <span className={state.present ? "text-[#2f5d3b]" : "text-[#5f524c]"}>Presente</span>}
      </label>
      {error ? (
        <span role="alert" className="block text-sm text-[#9b2c2c]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
