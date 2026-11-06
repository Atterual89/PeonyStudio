"use client";

import { Delete } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { loginAction } from "@/app/gestione/accesso/actions";
import { PIN_HELP } from "@/lib/gestionale/labels";

const PIN_LENGTH = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function PinPad() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = pending || greeting !== null;

  const submit = useCallback(
    (value: string) => {
      startTransition(async () => {
        const result = await loginAction(value);
        if (result.ok) {
          setGreeting(`Ciao, ${result.name}`);
          setTimeout(() => {
            router.replace("/gestione");
            router.refresh();
          }, 900);
        } else {
          setPin("");
          setError(result.error);
        }
      });
    },
    [router],
  );

  const press = useCallback(
    (digit: string) => {
      if (locked || pin.length >= PIN_LENGTH) return;
      const next = pin + digit;
      setError(null);
      setPin(next);
      // Invio automatico alla sesta cifra.
      if (next.length === PIN_LENGTH) submit(next);
    },
    [locked, pin, submit],
  );

  const backspace = useCallback(() => {
    if (locked) return;
    setPin(pin.slice(0, -1));
  }, [locked, pin]);

  // Tastiera fisica (desktop).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") backspace();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [press, backspace]);

  if (greeting) {
    return (
      <p role="status" className="mt-10 text-center font-serif text-3xl font-medium text-[#a8583e]">
        {greeting}
      </p>
    );
  }

  const keyClass =
    "flex h-16 items-center justify-center rounded-2xl bg-white/70 text-2xl font-semibold shadow-sm transition active:scale-95 active:bg-white disabled:opacity-50";

  return (
    <div className="mt-8">
      <div className="flex justify-center gap-3" aria-label={`${pin.length} cifre inserite su ${PIN_LENGTH}`}>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span
            key={index}
            className={`h-4 w-4 rounded-full border-2 border-[#a8583e] ${index < pin.length ? "bg-[#a8583e]" : ""}`}
          />
        ))}
      </div>

      <p role="alert" className="mt-5 min-h-12 text-center text-sm font-medium text-[#9b2c2c]">
        {pending ? <span className="text-[#5f524c]">Verifica in corso…</span> : error}
        {/* 4g (#1): il messaggio resta generico per sicurezza; sotto, cosa fare. */}
        {!pending && error ? <span className="mt-1 block font-normal text-[#5f524c]">{PIN_HELP}</span> : null}
      </p>

      <div className="mt-2 grid grid-cols-3 gap-3">
        {KEYS.map((digit) => (
          <button key={digit} type="button" className={keyClass} disabled={locked} onClick={() => press(digit)}>
            {digit}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" className={keyClass} disabled={locked} onClick={() => press("0")}>
          0
        </button>
        <button
          type="button"
          className={keyClass}
          disabled={locked || pin.length === 0}
          onClick={backspace}
          aria-label="Cancella ultima cifra"
        >
          <Delete className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
