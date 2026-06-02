import Link from "next/link";

import { SiteHeader } from "@/components/site/SiteHeader";
import { LoginForm } from "@/app/area-personale/login/LoginForm";

export default function PersonalAreaLoginPage() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto flex min-h-[72vh] max-w-6xl items-center px-5 py-14 sm:px-6">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
              Area personale
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-[clamp(42px,9vw,76px)] font-medium leading-[0.98] text-[#211815]">
              Accedi alla tua area personale
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
              Inserisci la stessa email usata per prenotare gli eventi Peony
              Studio. Ti invieremo un link sicuro per entrare senza password.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#211815]/10 bg-white/60 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.07)] sm:p-7">
            <LoginForm />
            <p className="mt-5 text-sm leading-6 text-[#5f524c]">
              Se hai prenotato con un&apos;altra email, accedi usando quella. Per
              dubbi puoi tornare al{" "}
              <Link
                className="font-semibold text-[#8b5e4a] underline-offset-4 hover:underline"
                href="/calendario"
              >
                calendario
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
