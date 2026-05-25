import Link from "next/link";

import type { homeContent } from "@/content/home";

type SplitIntroSectionProps = {
  content: typeof homeContent.splitIntro;
};

export function SplitIntroSection({ content }: SplitIntroSectionProps) {
  return (
    <section className="mx-auto grid max-w-6xl gap-6 px-5 py-16 sm:px-6 sm:py-20 md:grid-cols-[1.45fr_0.85fr] md:items-stretch md:gap-8 md:py-28">
      <div
        aria-hidden="true"
        className="aspect-[4/3] rounded-[8px] bg-[#cdbba8] md:aspect-auto md:min-h-[560px]"
      />

      <div className="grid gap-5">
        <article className="flex min-h-64 flex-col justify-between rounded-[8px] bg-white/65 p-6 shadow-sm sm:min-h-72 sm:p-7 md:p-8">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
              Inizia
            </p>
            <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
              {content.primary.title}
            </h2>
          </div>
          <Link
            href={content.primary.cta.href}
            className="mt-8 inline-flex w-fit rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white"
          >
            {content.primary.cta.label}
          </Link>
        </article>

        <article className="rounded-[8px] border border-[#211815]/10 bg-[#f8f3ec] p-6 sm:p-7 md:p-8">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
            {content.secondary.eyebrow}
          </p>
          <h3 className="text-2xl font-semibold leading-tight md:text-3xl">
            {content.secondary.title}
          </h3>
          <Link
            href={content.secondary.cta.href}
            className="mt-8 inline-flex rounded-full border border-[#211815]/20 px-5 py-3 text-sm font-medium"
          >
            {content.secondary.cta.label}
          </Link>
        </article>
      </div>
    </section>
  );
}
