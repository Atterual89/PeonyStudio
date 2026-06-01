import { SiteHeader } from "@/components/site/SiteHeader";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto flex min-h-[70vh] max-w-6xl items-center px-5 py-16 sm:px-6">
        <div className="max-w-3xl rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/75 to-[#efe4d7]/65 p-6 shadow-[0_12px_36px_rgba(33,24,21,0.08)] md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
            Area personale
          </p>
          <h1 className="mt-4 font-serif text-[clamp(42px,10vw,76px)] font-medium leading-[0.98] tracking-normal text-[#211815]">
            Area personale in arrivo
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
            Qui potrai ritrovare iscrizioni, percorsi, eventi e materiali
            collegati alla tua pratica.
          </p>
        </div>
      </section>
    </main>
  );
}
