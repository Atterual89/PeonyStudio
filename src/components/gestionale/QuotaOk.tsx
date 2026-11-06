"use client";

// D11 (rivista): "Segna quota ok" e "Annulla validazione manuale" (solo
// admin), con conferma sul posto; "Aggiorna stato soci". La validazione è la
// stessa della pagina admin (manual_override), per il periodo associativo del
// workshop (o di oggi nella scheda persona). 4d: "Segna quota ok" solo per le
// persone collegate e non in regola; "Annulla" sta nel menu "…" se la
// validazione è manuale. Gli esiti vanno nel messaggio unico del blocco (Flash).

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { markQuotaOkAction, refreshMembershipAction, revokeQuotaOkAction } from "@/app/gestione/(app)/p/membership-actions";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { UI_LABELS } from "@/lib/gestionale/labels";
import { formatPeriod } from "@/lib/gestionale/membership-rule";
import type { MembershipBadge } from "@/lib/gestionale/types";

import { useFlash } from "./Flash";
import { RowMenu, buttonClass } from "./ui";

type Target = {
  personId: string;
  /** "Nome Cognome" (o il nome visualizzato) per la conferma. */
  name: string;
  /** Inizio del workshop (o oggi): sceglie il periodo associativo. */
  referenceDate: string;
  workshopId?: string;
};

/** Collegata (badge diverso da "Non collegata") e non in regola. */
export function canMarkQuotaOk(badge: MembershipBadge): boolean {
  return badge.kind === "quota_mancante" || badge.kind === "modulo_mancante";
}

export function canRevokeQuotaOk(badge: MembershipBadge): boolean {
  return badge.kind === "in_regola" && badge.match === "manual";
}

function ConfirmBox({
  question,
  confirmLabel,
  danger,
  pending,
  onConfirm,
  onCancel,
}: {
  question: string;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-[#211815]/10 bg-[#f2ede3] p-3 text-sm">
      <p className="font-semibold">{question}</p>
      <p className="text-[#5f524c]">Vale anche nella pagina admin del sito.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={danger ? buttonClass.danger : buttonClass.primary} disabled={pending} onClick={onConfirm}>
          {pending ? "Salvataggio…" : confirmLabel}
        </button>
        <button type="button" className={buttonClass.ghost} onClick={onCancel} disabled={pending} autoFocus>
          Chiudi
        </button>
      </div>
    </div>
  );
}

/** "Segna quota ok" con conferma sul posto (azione principale delle persone collegate e non in regola). */
export function MarkQuotaOk({ personId, name, referenceDate, workshopId, badge, canMark }: Target & { badge: MembershipBadge; canMark: boolean }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const flash = useFlash(personId);
  const period = membershipPeriodFor(referenceDate);
  if (!period || !canMarkQuotaOk(badge)) return null;

  if (!asking) {
    return (
      <button
        type="button"
        className={buttonClass.primary}
        onClick={() => {
          if (canMark) {
            flash.clear();
            setAsking(true);
          } else flash.show("warning", "Completa prima nome e cognome oppure l'email della persona (Modifica dati).");
        }}
      >
        {UI_LABELS.markMembershipPaid}
      </button>
    );
  }
  return (
    <ConfirmBox
      question={`Segnare la quota associativa di ${name} come pagata per il periodo ${formatPeriod(period)}?`}
      confirmLabel={UI_LABELS.markMembershipPaid}
      pending={pending}
      onCancel={() => setAsking(false)}
      onConfirm={() =>
        startTransition(async () => {
          const result = await markQuotaOkAction({ personId, workshopId: workshopId ?? null, periodFrom: workshopId ? null : period.paymentsFrom });
          setAsking(false);
          flash.result(result, "Quota associativa segnata come pagata.");
        })
      }
    />
  );
}

/** Conferma di "Annulla validazione manuale" (aperta dal menu "…"). */
export function RevokeQuotaOk({ personId, name, referenceDate, workshopId, onClose }: Target & { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const flash = useFlash(personId);
  const period = membershipPeriodFor(referenceDate);
  if (!period) return null;
  return (
    <ConfirmBox
      question={`Revocare la validazione manuale di ${name} per il periodo ${formatPeriod(period)}?`}
      confirmLabel={UI_LABELS.revokeValidation}
      danger
      pending={pending}
      onCancel={onClose}
      onConfirm={() =>
        startTransition(async () => {
          const result = await revokeQuotaOkAction({ personId, workshopId: workshopId ?? null, periodFrom: workshopId ? null : period.paymentsFrom });
          onClose();
          flash.result(result, "Validazione revocata.");
        })
      }
    />
  );
}

/** Scheda persona: "Segna quota ok", oppure il menu "…" con "Annulla validazione manuale". */
export function QuotaOkControls(props: Target & { badge: MembershipBadge; canMark: boolean }) {
  const [revoking, setRevoking] = useState(false);
  if (canRevokeQuotaOk(props.badge)) {
    return revoking ? (
      <RevokeQuotaOk {...props} onClose={() => setRevoking(false)} />
    ) : (
      <RowMenu label="Altre azioni sulla tessera" items={[{ label: UI_LABELS.revokeValidation, danger: true, onClick: () => setRevoking(true) }]} />
    );
  }
  return <MarkQuotaOk {...props} />;
}

/** Pulsante piccolo: svuota la cache dei soci (Google Sheet e validazioni manuali). */
export function RefreshMembershipButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[#211815]/15 px-3 text-xs font-semibold text-[#5f524c] transition disabled:opacity-50"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshMembershipAction();
            setError(result.ok ? null : result.error);
          })
        }
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
        Aggiorna stato soci
      </button>
      {error ? <span className="text-xs text-[#9b2c2c]">{error}</span> : null}
    </span>
  );
}
