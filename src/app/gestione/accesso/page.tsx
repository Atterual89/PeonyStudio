import { redirect, unstable_rethrow } from "next/navigation";

import { PinPad } from "@/components/gestionale/PinPad";
import { getCurrentOperator } from "@/lib/gestionale/server/auth";

async function isLoggedIn(): Promise<boolean> {
  try {
    return (await getCurrentOperator()) !== null;
  } catch (error) {
    unstable_rethrow(error);
    // Database non raggiungibile: si mostra comunque il tastierino, il login
    // restituirà l'errore generico.
    console.error("Gestionale accesso:", error instanceof Error ? error.message : "errore");
    return false;
  }
}

export default async function AccessoPage() {
  if (await isLoggedIn()) {
    redirect("/gestione");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-sm md:min-h-dvh flex-col justify-center px-4 py-10">
      <h1 className="text-center font-serif text-2xl font-medium">
        Gestionale workshop
      </h1>
      <p className="mt-2 text-center text-sm text-[#5f524c]">Inserisci il tuo PIN</p>
      <PinPad />
    </main>
  );
}
