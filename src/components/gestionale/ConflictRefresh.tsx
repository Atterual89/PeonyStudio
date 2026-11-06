"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** 4g (#19): "Aggiorna" accanto al messaggio di conflitto: ricarica i dati della pagina. */
export function ConflictRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="ml-2 min-h-10 font-semibold underline disabled:opacity-60"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Aggiorno…" : "Aggiorna"}
    </button>
  );
}
