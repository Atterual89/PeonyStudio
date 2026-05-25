import Link from "next/link";

import { SiteHeader } from "@/components/site/SiteHeader";
import type { howToStartContent } from "@/content/how-to-start";

type HowToStartPageProps = {
  content: typeof howToStartContent;
};

export function HowToStartPage({ content }: HowToStartPageProps) {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <SiteHeader />

        <section className="flex min-h-[70vh] items-center py-20">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm uppercase tracking-[0.3em] text-[#8b5e4a]">
              {content.hero.eyebrow}
            </p>
            <h1 className="mb-6 text-5xl font-semibold leading-tight md:text-7xl">
              {content.hero.title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[#5f524c]">
              {content.hero.intro}
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="mb-10 max-w-2xl">
            <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
              {content.path.eyebrow}
            </p>
            <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
              {content.path.title}
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {content.path.cards.map((card, index) => (
              <article
                key={card.title}
                className="rounded-[8px] border border-[#211815]/10 bg-white/65 p-6 shadow-sm"
              >
                <p className="mb-4 text-sm uppercase tracking-[0.2em] text-[#8b5e4a]">
                  0{index + 1}
                </p>
                <h3 className="mb-5 text-2xl font-semibold">{card.title}</h3>

                <div className="grid gap-4 text-[#5f524c]">
                  <PathDetail label="Per chi" value={card.forWho} />
                  <PathDetail label="Cosa succede" value={card.whatHappens} />
                  <PathDetail label="Prossimo passo" value={card.nextStep} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 py-16 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div className="min-h-64 rounded-[8px] bg-[#d9cabb]" />

          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
              {content.unsure.eyebrow}
            </p>
            <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
              {content.unsure.title}
            </h2>
            <p className="mt-5 text-base leading-7 text-[#5f524c] md:text-lg">
              {content.unsure.intro}
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="rounded-[8px] bg-[#211815] px-6 py-12 text-[#f4efe8] md:px-10">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
                {content.finalCta.title}
              </h2>
              <p className="mt-5 text-base leading-7 text-[#f4efe8]/75 md:text-lg">
                {content.finalCta.intro}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={content.finalCta.primaryCta.href}
                  className="rounded-full bg-[#f4efe8] px-5 py-3 text-center text-sm font-medium text-[#211815]"
                >
                  {content.finalCta.primaryCta.label}
                </Link>
                <Link
                  href={content.finalCta.secondaryCta.href}
                  className="rounded-full border border-[#f4efe8]/30 px-5 py-3 text-center text-sm font-medium text-[#f4efe8]"
                >
                  {content.finalCta.secondaryCta.label}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function PathDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
        {label}
      </p>
      <p className="leading-7">{value}</p>
    </div>
  );
}
