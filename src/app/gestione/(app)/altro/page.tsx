import { ChevronRight, History, Mail, UserCheck } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/gestionale/LogoutButton";
import { cardClass } from "@/components/gestionale/ui";
import { ROLE_LABELS } from "@/lib/gestionale/labels";
import { requireOperator } from "@/lib/gestionale/server/auth";

import { logoutAction } from "./actions";

export default async function AltroPage() {
  const operator = await requireOperator();

  return (
    <section>
      <h1 className="font-serif text-xl font-medium">Altro</h1>

      <ul className={`${cardClass} mt-3 divide-y divide-[#211815]/5`}>
        {/* Fase 5: solo admin (D18: per Ale la pagina risponde 404). */}
        {operator.role === "admin" ? (
          <li>
            <Link prefetch={false} href="/gestione/altro/soci" className="flex min-h-12 items-center gap-3 px-3">
              <UserCheck className="h-5 w-5 text-[#a8583e]" aria-hidden="true" />
              <span className="flex-1 font-semibold">Collega al libro soci</span>
              <ChevronRight className="h-5 w-5 text-[#5f524c]" aria-hidden="true" />
            </Link>
          </li>
        ) : null}
        {operator.role === "admin" ? (
          <li>
            <Link prefetch={false} href="/gestione/altro/impostazioni-email" className="flex min-h-12 items-center gap-3 px-3">
              <Mail className="h-5 w-5 text-[#a8583e]" aria-hidden="true" />
              <span className="flex-1 font-semibold">Impostazioni email</span>
              <ChevronRight className="h-5 w-5 text-[#5f524c]" aria-hidden="true" />
            </Link>
          </li>
        ) : null}
        {/* D27: per tutti e due i ruoli, ultima voce (per Ale filtrato lato server). */}
        <li>
          <Link prefetch={false} href="/gestione/altro/storico" className="flex min-h-12 items-center gap-3 px-3">
            <History className="h-5 w-5 text-[#a8583e]" aria-hidden="true" />
            <span className="flex-1 font-semibold">Storico modifiche</span>
            <ChevronRight className="h-5 w-5 text-[#5f524c]" aria-hidden="true" />
          </Link>
        </li>
      </ul>

      <div className="mt-3 rounded-2xl border border-[#211815]/10 bg-white/60 p-3">
        {/* 4g (#41): niente "operatore" né nome del ruolo per Ale. */}
        <p className="text-base">
          {operator.role === "organizzatrice" ? "Sei entrata come" : "Hai fatto l'accesso come"}{" "}
          <strong className="font-semibold">{operator.displayName}</strong>
        </p>
        {operator.role === "admin" ? <p className="text-sm text-[#5f524c]">{ROLE_LABELS[operator.role]}</p> : null}

        <LogoutButton action={logoutAction} />
      </div>
    </section>
  );
}
