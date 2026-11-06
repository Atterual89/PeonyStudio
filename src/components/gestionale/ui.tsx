// Elementi di interfaccia comuni del gestionale: pulsanti, campi, sezioni
// richiudibili, messaggi. Palette Peony, font del sito (D12).

import { ChevronDown, MoreHorizontal, X } from "lucide-react";

import { isConflictMessage } from "@/lib/gestionale/errors";

import { ConflictRefresh } from "./ConflictRefresh";

/**
 * 4f (interfaccia compatta): le misure del gestionale, in un unico punto.
 * Campi e menu alti 40 px con testo 15 px; etichette 12 px a 4 px dal campo;
 * card con 12 px di padding; 8 px tra i campi, 12 px tra i blocchi; pulsanti
 * principali 40 px, secondari 36 px (piccoli 32 px) con area di tocco di
 * almeno 40 px; titoli delle sezioni 16 px.
 */
export const UI = {
  /** Altezza e testo di campi e menu a tendina. */
  control: "h-10 text-[15px]",
  /** Righe e intestazioni toccabili (righe richiudibili, voci di elenco). */
  row: "min-h-10",
  /** Etichetta sopra un campo. */
  label: "mb-1 block text-xs font-medium text-[#5f524c]",
  /** Testo piccolo sotto un campo (aiuto, "da completare"). */
  hint: "mt-1 block text-xs",
  /** Padding di card e riquadri. */
  pad: "p-3",
  /** Spazio tra i campi. */
  fields: "gap-2",
  /** Spazio tra i blocchi. */
  blocks: "space-y-3",
  /** Titolo di una sezione o di una card. */
  sectionTitle: "text-base font-semibold",
  /** Area di tocco di 40 px per i pulsanti più bassi (36 px + 2 px sopra e sotto; 32 px + 4 px). */
  touch36: "relative after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-['']",
  touch32: "relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
} as const;

export const buttonClass = {
  primary: `inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#a8583e] px-4 text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50`,
  secondary: `${UI.touch36} inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e] transition active:scale-[0.98] disabled:opacity-50`,
  ghost: `${UI.touch36} inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[#5f524c] transition hover:bg-white/60 disabled:opacity-50`,
  danger: `${UI.touch36} inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#9b2c2c]/40 px-3 text-sm font-medium text-[#9b2c2c] transition disabled:opacity-50`,
  /** Risposte a un tocco degli avvisi, affiancate. */
  small: `${UI.touch32} inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[#a8583e] bg-white px-2 text-xs font-semibold text-[#a8583e] transition active:scale-[0.98] disabled:opacity-50`,
} as const;

const controlBase = `${UI.control} w-full min-w-0 rounded-lg border bg-white px-2 text-[#211815] outline-none focus:border-[#a8583e] focus:ring-2 focus:ring-[#a8583e]/20`;

export const inputClass = `${controlBase} border-[#211815]/15`;

/** Campi dei moduli compatti: uguali a inputClass (tutti alti 40 px dalla 4f). */
export const compactInputClass = inputClass;

/** Note su una riga che si allarga scrivendo. */
export const textareaClass = `${UI.row} w-full min-w-0 rounded-lg border border-[#211815]/15 bg-white px-2.5 py-2 text-[15px] text-[#211815] outline-none field-sizing-content focus:border-[#a8583e] focus:ring-2 focus:ring-[#a8583e]/20`;

/** Campo obbligatorio vuoto (anteprima del box di testo): bordo e fondo evidenziati. */
export const missingInputClass = `${controlBase} border-2 border-[#c27a12] bg-[#fffaf0]`;

/** Testo sotto un campo obbligatorio vuoto. */
export function MissingHint() {
  return <span className={`${UI.hint} font-semibold text-[#7a5212]`}>da completare</span>;
}

/**
 * Scelta in un modulo: menu a tendina nativo, alto 40 px (UI.control).
 * I chip restano solo per i filtri degli elenchi. Con `value` null compare
 * la voce vuota `placeholder` (es. metodo non indicato). `missing`: campo
 * obbligatorio vuoto, evidenziato con "da completare". `className`: larghezza
 * nelle righe affiancate (es. una base flex): il menu non si tronca, se non
 * entra va a capo.
 */
export function ChoiceSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = "Scegli…",
  missing = false,
  className = "",
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  missing?: boolean;
  className?: string;
}) {
  const select = (
    <select
      className={`${missing ? missingInputClass : compactInputClass} ${label ? "" : className}`}
      data-missing={missing || undefined}
      aria-invalid={missing || undefined}
      value={value ?? ""}
      aria-label={label ? undefined : placeholder}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value as T);
      }}
    >
      {value === null ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
  if (!label) return select;
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={UI.label}>{label}</span>
      {select}
      {missing ? <MissingHint /> : null}
    </label>
  );
}

export const cardClass = "rounded-xl border border-[#211815]/10 bg-white/70";

export function Field({
  label,
  error,
  hint,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  /** Larghezza nelle righe affiancate (es. una base flex). */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={UI.label}>{label}</span>
      {children}
      {hint && !error ? <span className={`${UI.hint} text-[#5f524c]`}>{hint}</span> : null}
      {error ? <span className={`${UI.hint} font-medium text-[#9b2c2c]`}>{error}</span> : null}
    </label>
  );
}

const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const shortDateYear = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

/** "oggi", "28 ott" (con l'anno se diverso da quello di oggi), "nessuna" (senza data). */
export function shortDateLabel(value: string, today: string): string {
  if (!value) return "nessuna";
  if (value === today) return "oggi";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return value.slice(0, 4) === today.slice(0, 4) ? shortDate.format(date) : shortDateYear.format(date);
}

/**
 * 4f: data facoltativa, compatta (entra accanto a Importo e Metodo anche a
 * 360 px): mostra "oggi" / "28 ott" / "nessuna"; il tocco apre il
 * calendario del telefono; la × la toglie.
 */
export function DateField({
  label = "Data",
  value,
  today,
  onChange,
  className = "",
}: {
  label?: string;
  value: string;
  today: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className={UI.label}>{label}</span>
      <div
        className={`${UI.control} relative flex w-full items-center rounded-lg border border-[#211815]/15 bg-white focus-within:border-[#a8583e] focus-within:ring-2 focus-within:ring-[#a8583e]/20`}
      >
        <span className={`truncate px-2 ${value ? "text-[#211815]" : "text-[#5f524c]"}`}>{shortDateLabel(value, today)}</span>
        <input
          type="date"
          aria-label={label}
          className={`absolute inset-y-0 left-0 cursor-pointer opacity-0 ${value ? "right-8" : "right-0"}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              // Alcuni browser aprono il calendario da soli.
            }
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label="Togli la data"
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-[#5f524c]"
            onClick={() => onChange("")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Sezione richiudibile nativa (funziona anche senza JavaScript). */
export function Section({
  title,
  count,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  /** Mostrato a destra anche da chiusa (es. il totale del blocco). */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group mt-3">
      <summary
        className={`flex ${UI.row} cursor-pointer list-none items-center justify-between gap-3 border-b border-[#211815]/10 [&::-webkit-details-marker]:hidden`}
      >
        <h2 className={UI.sectionTitle}>
          {title}
          {count !== undefined ? <span className="ml-2 text-sm font-normal text-[#5f524c]">{count}</span> : null}
        </h2>
        <span className="flex items-center gap-2">
          {summary !== undefined ? <span className="text-[15px] font-semibold">{summary}</span> : null}
          <ChevronDown className="h-5 w-5 text-[#5f524c] transition group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

export function Notice({ tone, children }: { tone: "success" | "error" | "warning"; children: React.ReactNode }) {
  const tones = {
    success: "border-[#3f7a4f]/30 bg-[#eaf3ec] text-[#2f5d3b]",
    error: "border-[#9b2c2c]/30 bg-[#fbeaea] text-[#7a2222]",
    warning: "border-[#b7791f]/30 bg-[#fdf3e1] text-[#7a5212]",
  };
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm font-medium ${tones[tone]}`}>
      {children}
      {/* 4g (#19): sul conflitto, il pulsante per riprendere i dati aggiornati. */}
      {isConflictMessage(children) ? <ConflictRefresh /> : null}
    </p>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${UI.touch36} h-9 shrink-0 rounded-full border px-3 text-sm font-semibold transition ${
        active ? "border-[#a8583e] bg-[#a8583e] text-white" : "border-[#211815]/15 bg-white/70 text-[#5f524c]"
      }`}
    >
      {children}
    </button>
  );
}

/** Menu "…" di una riga (solo nei client component): ogni voce chiude il menu. 4e (#30): almeno 8 px di spazio dai controlli accanto. */
export function RowMenu({
  label,
  items,
}: {
  label: string;
  items: readonly { label: string; onClick: () => void; danger?: boolean }[];
}) {
  return (
    <details className="relative mx-2 shrink-0">
      <summary
        aria-label={label}
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-[#5f524c] hover:bg-[#211815]/5 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-10 mt-1 flex min-w-40 flex-col rounded-lg border border-[#211815]/10 bg-white p-1 shadow-lg">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`${buttonClass.ghost} h-10 justify-start ${item.danger ? "text-[#9b2c2c]" : ""}`}
            onClick={(e) => {
              e.currentTarget.closest("details")?.removeAttribute("open");
              item.onClick();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}

/**
 * 4e (#16): conferma sul posto (mai finestre del browser): domanda, "Conferma"
 * (o l'etichetta indicata) e "Chiudi", col fuoco su Chiudi.
 */
export function InlineConfirm({
  question,
  note,
  confirmLabel = "Conferma",
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  question: string;
  note?: string;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-[#211815]/10 bg-[#f2ede3] p-3 text-sm">
      <p className="font-semibold">{question}</p>
      {note ? <p className="text-[#5f524c]">{note}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={danger ? buttonClass.danger : buttonClass.primary} disabled={pending} onClick={onConfirm}>
          {pending ? "Salvataggio…" : confirmLabel}
        </button>
        <button type="button" className={buttonClass.ghost} disabled={pending} onClick={onCancel} autoFocus>
          Chiudi
        </button>
      </div>
    </div>
  );
}

/** Fase 5: stato di caricamento delle pagine lente (loading.tsx), subito visibile alla navigazione. */
export function PageLoading({ label }: { label: string }) {
  return (
    <p role="status" className="mt-6 flex items-center gap-2 text-sm text-[#5f524c]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#a8583e]/30 border-t-[#a8583e]" aria-hidden="true" />
      {label}
    </p>
  );
}
