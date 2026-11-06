"use client";

import { useState, useTransition } from "react";

import { copyWorkshopSettingsAction, updateWorkshopSettingsAction } from "@/app/gestione/(app)/w/actions";
import { updateWorkshopFeeAction } from "@/app/gestione/(app)/w/registration-actions";
import { centsToInput, formatCents, formatDate } from "@/lib/gestionale/format";
import { PARTY_LABELS } from "@/lib/gestionale/labels";
import { unsettledWarning, type FeeRow } from "@/lib/gestionale/payments";
import { secondPartyPct, validateWorkshopSettings, type WorkshopSettingsValues } from "@/lib/gestionale/workshops";

import { useFeeChangeConfirm } from "./FeeChangeConfirm";
import { Field, InlineConfirm, Notice, buttonClass, cardClass, inputClass } from "./ui";

type Settings = {
  id: string;
  version: number;
  description: string | null;
  capacity: number | null;
  default_fee_cents: number | null;
  peony_pct: number;
};

export type CopySource = {
  id: string;
  name: string;
  startsOn: string;
  capacity: number | null;
  default_fee_cents: number | null;
  peony_pct: number;
};

function toValues(settings: Settings): WorkshopSettingsValues {
  return {
    description: settings.description ?? "",
    capacity: settings.capacity ? String(settings.capacity) : "",
    default_fee: centsToInput(settings.default_fee_cents),
    peony_pct: String(settings.peony_pct),
  };
}

/** Tab Info (D14): solo capienza, prezzo, percentuali e descrizione. 4g (#40): conferma se il prezzo cambia. */
export function WorkshopSettingsForm({ workshop, feeRows = [] }: { workshop: Settings; feeRows?: readonly FeeRow[] }) {
  const [values, setValues] = useState(() => toValues(workshop));
  const [errors, setErrors] = useState<Partial<Record<keyof WorkshopSettingsValues, string>>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [synced, setSynced] = useState({ version: workshop.version, ownSave: false });
  const confirm = useFeeChangeConfirm(feeRows);

  // Nuova versione dal server: se non è il nostro salvataggio (es. "Copia
  // impostazioni"), il form riprende i valori salvati.
  if (workshop.version !== synced.version) {
    if (!synced.ownSave) setValues(toValues(workshop));
    setSynced({ version: workshop.version, ownSave: false });
  }

  function set(key: keyof WorkshopSettingsValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    save(false);
  }

  function save(confirmed: boolean) {
    setMessage(null);
    const validation = validateWorkshopSettings(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    if (!confirmed && !confirm.check(values.default_fee)) return;
    confirm.clear();
    setSynced((current) => ({ ...current, ownSave: true }));
    startTransition(async () => {
      const result = await updateWorkshopSettingsAction({ id: workshop.id, version: workshop.version, values });
      if (!result.ok) setSynced((current) => ({ ...current, ownSave: false }));
      setMessage(result.ok ? { tone: "success", text: "Impostazioni salvate." } : { tone: "error", text: result.error });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Capienza (iscrizioni)" error={errors.capacity} hint="Una coppia occupa un posto.">
          <input inputMode="numeric" className={inputClass} value={values.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="es. 12" />
        </Field>
        <Field label="Prezzo per iscrizione (€)" hint="Cambia per tutti, tranne i prezzi speciali." error={errors.default_fee}>
          <input inputMode="decimal" className={inputClass} value={values.default_fee} onChange={(e) => set("default_fee", e.target.value)} placeholder="es. 250" />
        </Field>
      </div>

      <Field
        label={`Percentuale ${PARTY_LABELS.peony} (%)`}
        error={errors.peony_pct}
        hint={`${PARTY_LABELS.redsabbath}: ${secondPartyPct(values.peony_pct)}%`}
      >
        <input inputMode="decimal" className={inputClass} value={values.peony_pct} onChange={(e) => set("peony_pct", e.target.value)} />
      </Field>

      <Field label="Descrizione e note">
        <textarea className={`${inputClass} min-h-24 py-2`} value={values.description} onChange={(e) => set("description", e.target.value)} />
      </Field>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {confirm.question ? (
        <InlineConfirm question={confirm.question} confirmLabel="Sì, cambia" pending={pending} onConfirm={() => save(true)} onCancel={confirm.clear} />
      ) : (
        <button type="submit" className={`${buttonClass.primary} w-full sm:w-auto`} disabled={pending}>
          {pending ? "Salvataggio…" : "Salva impostazioni"}
        </button>
      )}
    </form>
  );
}

/** Solo sui workshop senza iscrizioni: copia capienza, quota standard e percentuali. */
export function CopySettings({ workshop, sources }: { workshop: { id: string; version: number }; sources: CopySource[] }) {
  const [sourceId, setSourceId] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const source = sources.find((s) => s.id === sourceId);

  function copy() {
    if (!source) return;
    startTransition(async () => {
      const result = await copyWorkshopSettingsAction({ id: workshop.id, version: workshop.version, sourceId: source.id });
      setMessage(result.ok ? { tone: "success", text: `Impostazioni copiate da “${source.name}”.` } : { tone: "error", text: result.error });
    });
  }

  if (sources.length === 0) return null;

  return (
    <div className={`${cardClass} space-y-3 p-3`}>
      <p className="font-semibold">Copia impostazioni da un workshop precedente</p>
      <select className={inputClass} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
        <option value="">Scegli il workshop…</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {formatDate(s.startsOn)}
          </option>
        ))}
      </select>
      {source ? (
        <p className="text-sm text-[#5f524c]">
          Capienza {source.capacity ?? "—"} · prezzo {formatCents(source.default_fee_cents)} · {PARTY_LABELS.peony}{" "}
          {String(source.peony_pct).replace(".", ",")}% / {PARTY_LABELS.redsabbath} {secondPartyPct(String(source.peony_pct))}%
        </p>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <button type="button" onClick={copy} disabled={!source || pending} className={buttonClass.secondary}>
        {pending ? "Copia in corso…" : "Copia impostazioni"}
      </button>
    </div>
  );
}

/**
 * Tab Info dell'organizzatrice (D18): solo quota standard e note.
 * Percentuali in sola lettura; capienza e copia impostazioni solo per gli admin.
 */
export function OrganizerSettingsForm({ workshop, feeRows = [] }: { workshop: Settings; feeRows?: readonly FeeRow[] }) {
  const [fee, setFee] = useState(centsToInput(workshop.default_fee_cents));
  const [description, setDescription] = useState(workshop.description ?? "");
  const [message, setMessage] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useFeeChangeConfirm(feeRows);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    save(false);
  }

  function save(confirmed: boolean) {
    setMessage(null);
    if (!confirmed && !confirm.check(fee)) return;
    confirm.clear();
    startTransition(async () => {
      const result = await updateWorkshopFeeAction({ workshopId: workshop.id, version: workshop.version, fee, description });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const warning = unsettledWarning(result.data.unsettled);
      setMessage(warning ? { tone: "warning", text: `Impostazioni salvate. ${warning}` } : { tone: "success", text: "Impostazioni salvate." });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label="Prezzo per iscrizione (€)" hint="Cambia per tutti, tranne i prezzi speciali.">
        <input inputMode="decimal" className={inputClass} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="es. 450" />
      </Field>
      <p className="text-sm text-[#5f524c]">
        Divisione: {PARTY_LABELS.peony} {String(workshop.peony_pct).replace(".", ",")}% · {PARTY_LABELS.redsabbath}{" "}
        {secondPartyPct(String(workshop.peony_pct))}%
      </p>
      <Field label="Note">
        <textarea className={`${inputClass} min-h-24 py-2`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {confirm.question ? (
        <InlineConfirm question={confirm.question} confirmLabel="Sì, cambia" pending={pending} onConfirm={() => save(true)} onCancel={confirm.clear} />
      ) : (
        <button type="submit" className={`${buttonClass.primary} w-full sm:w-auto`} disabled={pending}>
          {pending ? "Salvataggio…" : "Salva"}
        </button>
      )}
    </form>
  );
}
