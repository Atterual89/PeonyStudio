"use client";

import { LogOut } from "lucide-react";

import { draftStorage } from "@/lib/gestionale/draft";

/** "Esci": prima di chiudere la sessione cancella le bozze del box di testo (4g, #23). */
export function LogoutButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action} onSubmit={() => draftStorage.clearAll()} className="mt-3">
      <button
        type="submit"
        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8583e] px-5 font-semibold text-[#a8583e] transition-colors hover:bg-[#a8583e] hover:text-white sm:w-auto"
      >
        <LogOut className="h-5 w-5" aria-hidden="true" />
        Esci (poi servirà il PIN)
      </button>
    </form>
  );
}
