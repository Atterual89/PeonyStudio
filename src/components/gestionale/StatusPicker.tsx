"use client";

import { BOOKING_STATUS_LABELS } from "@/lib/gestionale/labels";
import type { BookingStatus } from "@/lib/gestionale/types";

import { UI, compactInputClass } from "./ui";

const ALL_STATUSES = Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[];

/** Colore del pallino di ogni stato (D16). */
const STATUS_DOT: Record<BookingStatus, string> = {
  interessato: "bg-[#8a9bb0]",
  prenotato: "bg-[#c99a2e]",
  acconto: "bg-[#d9772b]",
  saldato: "bg-[#3f7a4f]",
  lista_attesa: "bg-[#7a5ea8]",
  cancellato: "bg-[#9b2c2c]",
};

/** Pallino colorato + nome dello stato (anche in sola lettura). */
export function StatusDot({ status, withLabel = false }: { status: BookingStatus; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
      {withLabel ? <span>{BOOKING_STATUS_LABELS[status]}</span> : <span className="sr-only">{BOOKING_STATUS_LABELS[status]}</span>}
    </span>
  );
}

/**
 * Stato dell'iscrizione: menu a tendina nativo (40 px, UI.control) con il
 * pallino dello stato attuale accanto, largo quanto lo stato più lungo
 * ("Prenotato a parola"). `options` limita gli stati (es. admin: solo quelli
 * non economici). `className`: larghezza nelle righe affiancate.
 */
export function StatusPicker({
  value,
  onChange,
  options = ALL_STATUSES,
  label = "Stato",
  className = "",
}: {
  value: BookingStatus;
  onChange: (status: BookingStatus) => void;
  options?: readonly BookingStatus[];
  label?: string;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={UI.label}>{label}</span>
      <span className="flex items-center gap-1.5">
        <StatusDot status={value} />
        <select
          className={`${compactInputClass} min-w-[10.5rem] sm:w-auto`}
          value={value}
          onChange={(e) => onChange(e.target.value as BookingStatus)}
        >
          {options.map((status) => (
            <option key={status} value={status}>
              {BOOKING_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
