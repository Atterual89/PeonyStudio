"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { centsToInput, formatCents } from "@/lib/gestionale/format";

import { UI, buttonClass, inputClass } from "./ui";

/**
 * D19, 4g (#15): "Prezzo: 500 €" con la matita. Confermare dalla matita =
 * prezzo speciale (tariffa dedicata); se speciale, "Prezzo speciale · torna al
 * prezzo normale". Usato nella riga aperta del tab Iscrizioni e in "Aggiungi".
 */
export function FeeEditor({
  feeCents,
  custom,
  disabled = false,
  onSave,
  onRestore,
}: {
  feeCents: number | null;
  custom: boolean;
  disabled?: boolean;
  /** Restituisce true se salvato (chiude la modifica). */
  onSave: (text: string) => boolean | Promise<boolean>;
  onRestore: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  if (editing) {
    return (
      <div className="space-y-2">
        <label className="block">
          <span className={UI.label}>Prezzo speciale</span>
          <input
            inputMode="decimal"
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="es. 450 o 450,50"
            autoFocus
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass.primary}
            disabled={disabled || !text.trim()}
            onClick={async () => {
              if (await onSave(text)) setEditing(false);
            }}
          >
            Salva
          </button>
          <button type="button" className={buttonClass.ghost} onClick={() => setEditing(false)}>
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  // 4f: compatto, per stare accanto allo Stato anche a 360 px.
  return (
    <div>
      <span className={UI.label}>Prezzo</span>
      <div className="flex flex-wrap items-center gap-x-1">
        <strong className="text-[15px]">{feeCents === null ? "mancante" : formatCents(feeCents)}</strong>
        <button
          type="button"
          aria-label="Cambia il prezzo (prezzo speciale)"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#a8583e] hover:bg-white/60 disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            setText(centsToInput(feeCents));
            setEditing(true);
          }}
        >
          <Pencil className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {custom ? (
        <span className="block text-xs text-[#5f524c]">
          <span className="font-semibold text-[#a8583e]">Prezzo speciale</span> ·{" "}
          <button type="button" className="min-h-10 underline disabled:opacity-50" disabled={disabled} onClick={onRestore}>
            torna al prezzo normale
          </button>
        </span>
      ) : null}
    </div>
  );
}
