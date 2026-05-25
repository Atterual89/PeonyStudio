import Link from "next/link";

import type { homeContent } from "@/content/home";

type PhilosophySectionProps = {
  content: typeof homeContent.philosophy;
};

export function PhilosophySection({ content }: PhilosophySectionProps) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 md:py-28">
      <div className="rounded-[8px] border border-[#211815]/10 bg-white/50 px-6 py-12 md:px-10 md:py-16">
        <p className="mb-6 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
          Filosofia
        </p>
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-4xl text-3xl font-semibold leading-tight sm:text-4xl md:text-6xl lg:text-7xl">
            {content.title}
          </h2>
          <Link
            href={content.cta.href}
            className="inline-flex w-fit shrink-0 rounded-full border border-[#211815]/20 px-5 py-3 text-sm font-medium"
          >
            {content.cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
