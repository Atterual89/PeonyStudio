"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { completeAllFromMemberAction } from "@/app/gestione/(app)/p/actions";

import { InlineConfirm, Notice, buttonClass } from "./ui";

/** Pagina Persone: "Completa i dati dal libro soci (N persone)", con conferma. Solo campi vuoti, con storico. */
export function CompleteAllFromMembers({ count }: { count: number }) {
  const router=useRouter();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = count === 1 ? "1 persona" : `${count} persone`;

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await completeAllFromMemberAction();
      setAsking(false);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const { updated, failed } = result.data;
      router.refresh();
      setMessage({
        tone: failed > 0 ? "error" : "success",
        text: `${updated === 1 ? "1 scheda completata" : `${updated} schede completate`}${failed > 0 ? `, ${failed} non riuscite: riprova` : ""}.`,
      });
    });
  }

  if (count === 0 && !message) return null;
  return (
    <div className="space-y-2">
      {count > 0 && asking ? (
        <InlineConfirm
          question={`Completare nome, cognome ed email vuoti di ${label} con i dati del libro soci?`}
          note="I campi già pieni non cambiano."
          pending={pending}
          onConfirm={run}
          onCancel={() => setAsking(false)}
        />
      ) : count > 0 ? (
        <button type="button" className={buttonClass.secondary} onClick={() => setAsking(true)} disabled={pending}>
          {`Completa i dati dal libro soci (${label})`}
        </button>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}
