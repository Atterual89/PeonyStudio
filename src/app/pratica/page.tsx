import { SiteHeader } from "@/components/site/SiteHeader";
import { practiceContent } from "@/content/practice";

export default function PraticaPage() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-12 sm:px-6 md:pb-12 md:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
          {practiceContent.hero.eyebrow}
        </p>
        <h1 className="mt-4 max-w-4xl font-serif text-[clamp(42px,11vw,82px)] font-medium leading-[0.98] tracking-normal text-[#211815]">
          {practiceContent.title}
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
          {practiceContent.hero.intro}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 md:py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {practiceContent.formats.map((format) => (
            <article
              key={format.title}
              className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/70 to-[#efe4d7]/65 p-5 shadow-[0_2px_0_rgba(33,24,21,0.03)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                {format.cadence}
              </p>
              <h2 className="mt-3 font-serif text-3xl font-medium leading-[1.08] tracking-normal text-[#211815]">
                {format.title}
              </h2>
              <p className="mt-4 text-sm leading-[1.65] text-[#5f524c]">
                {format.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
