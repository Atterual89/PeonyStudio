import Link from "next/link";

import type { homeContent } from "@/content/home";

type ZenHeroSectionProps = {
  content: typeof homeContent.hero;
};

export function ZenHeroSection({ content }: ZenHeroSectionProps) {
  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-5 py-20 text-center sm:px-6 sm:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#d8c8b8]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgba(244,239,232,0.25),rgba(244,239,232,0.82)),linear-gradient(90deg,rgba(33,24,21,0.08)_1px,transparent_1px),linear-gradient(rgba(33,24,21,0.06)_1px,transparent_1px)] bg-[size:auto,88px_88px,88px_88px]"
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        <p className="mb-6 text-sm uppercase tracking-[0.28em] text-[#8b5e4a] sm:tracking-[0.35em]">
          Peony Studio
        </p>
        <h1 className="text-4xl font-semibold leading-[0.98] sm:text-5xl md:text-7xl md:leading-[0.95] lg:text-8xl">
          {content.title}
        </h1>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={content.primaryCta.href}
            className="w-full max-w-xs rounded-full bg-[#211815] px-6 py-3 text-center text-sm font-medium text-white sm:w-auto"
          >
            {content.primaryCta.label}
          </Link>
          <Link
            href={content.secondaryCta.href}
            className="w-full max-w-xs rounded-full border border-[#211815]/25 bg-[#f4efe8]/55 px-6 py-3 text-center text-sm font-medium backdrop-blur sm:w-auto"
          >
            {content.secondaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
