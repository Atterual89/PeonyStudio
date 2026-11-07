"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFormQuotaPaidAction } from "@/app/gestione/(app)/p/membership-actions";

export function QuotaCheckbox({
  formMemberId, name, paid, paidSource, periodDate,
}: {
  formMemberId: string;
  name: string;
  paid: boolean;
  paidSource: "manual" | "book" | null;
  periodDate?: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const official = paid && paidSource === "book";
  const periodYear = periodDate ? Number(periodDate.slice(0, 4)) : null;
  return (
    <span className="inline-flex max-w-full flex-col items-end gap-1">
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs font-medium">
        <input type="checkbox" checked={paid} disabled={busy || official}
          aria-label={`Quota pagata: ${name}${periodYear ? ` (${periodYear})` : ""}`}
          onChange={(event) => {
            const next = event.target.checked;
            setError(null);
            startTransition(async () => {
              try {
                const result = await setFormQuotaPaidAction(formMemberId, next, periodDate);
                if (!result.ok) setError(result.error);
                else router.refresh();
              } catch {
                setError("Pagamento non aggiornato. Riprova.");
              }
            });
          }}
          className="h-5 w-5 shrink-0 accent-[#a8583e]" />
        <span className={official ? "text-[#326941]" : "text-[#5f524c]"}>
          {busy ? "Salvataggio…" : official ? "Pagata (Team Artist)" : periodYear ? `Quota ${periodYear}` : "Quota pagata"}
        </span>
      </label>
      {error ? <span role="alert" className="max-w-64 text-right text-xs text-[#9b2c2c]">{error}</span> : null}
    </span>
  );
}
