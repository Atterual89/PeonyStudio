"use client";

// Un solo messaggio di esito per blocco (4d): ogni azione sostituisce il
// messaggio precedente, che sparisce da solo dopo qualche secondo. Le azioni
// chiamano `useFlash(scope).show(...)`; il messaggio si mostra dove sta
// <FlashMessage scope>, così resta visibile anche se il componente che l'ha
// prodotto sparisce (es. "Cerca nel libro soci" dopo il collegamento).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { Notice } from "./ui";

export type FlashTone = "success" | "error" | "warning";
type Flash = { scope: string; tone: FlashTone; text: string; id: number };

const SUCCESS_MS = 4000;
const ERROR_MS = 8000;

const FlashContext = createContext<{ flash: Flash | null; show: (scope: string, tone: FlashTone, text: string) => void; clear: () => void } | null>(
  null,
);

let nextId = 0;

export function FlashProvider({ children }: { children: React.ReactNode }) {
  const [flash, setFlash] = useState<Flash | null>(null);
  const show = useCallback((scope: string, tone: FlashTone, text: string) => {
    nextId += 1;
    setFlash({ scope, tone, text, id: nextId });
  }, []);
  const clear = useCallback(() => setFlash(null), []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash((current) => (current?.id === flash.id ? null : current)), flash.tone === "error" ? ERROR_MS : SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const value = useMemo(() => ({ flash, show, clear }), [flash, show, clear]);
  return <FlashContext.Provider value={value}>{children}</FlashContext.Provider>;
}

/** show(tone, text): sostituisce il messaggio del blocco; clear(): lo toglie (es. all'inizio di una nuova azione). */
export function useFlash(scope: string) {
  const context = useContext(FlashContext);
  const show = context?.show;
  const clear = context?.clear;
  return useMemo(
    () => ({
      show: (tone: FlashTone, text: string) => show?.(scope, tone, text),
      result: (result: { ok: true } | { ok: false; error: string }, success: string) =>
        result.ok ? show?.(scope, "success", success) : show?.(scope, "error", result.error),
      clear: () => clear?.(),
    }),
    [scope, show, clear],
  );
}

export function FlashMessage({ scope }: { scope: string }) {
  const flash = useContext(FlashContext)?.flash;
  if (!flash || flash.scope !== scope) return null;
  return <Notice tone={flash.tone}>{flash.text}</Notice>;
}
