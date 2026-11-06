"use server";

import { GENERIC_LOGIN_ERROR } from "@/lib/gestionale/auth-core";
import { loginWithPin } from "@/lib/gestionale/server/auth";

export type LoginActionResult = { ok: true; name: string } | { ok: false; error: string };

// Unica azione del gestionale senza requireOperator(): è quella che crea la sessione.
export async function loginAction(pin: unknown): Promise<LoginActionResult> {
  if (typeof pin !== "string") {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  try {
    const result = await loginWithPin(pin);
    return result.ok
      ? { ok: true, name: result.operator.displayName }
      : { ok: false, error: GENERIC_LOGIN_ERROR };
  } catch (error) {
    // Mai registrare il PIN: solo il messaggio dell'errore tecnico.
    console.error("Gestionale login:", error instanceof Error ? error.message : "errore");
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
}
