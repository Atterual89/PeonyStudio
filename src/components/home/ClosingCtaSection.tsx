import Link from "next/link";

import type { homeContent } from "@/content/home";

type ClosingCtaSectionProps = {
  content: typeof homeContent.closingCta;
};

export function ClosingCtaSection({ content }: ClosingCtaSectionProps) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 md:py-28">
      <div className="rounded-[8px] bg-[#211815] px-6 py-12 text-[#f4efe8] md:px-10 md:py-16">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl md:text-6xl">
            {content.title}
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#f4efe8]/75">
            {content.intro}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={content.primaryCta.href}
              className="rounded-full bg-[#f4efe8] px-5 py-3 text-center text-sm font-medium text-[#211815]"
            >
              {content.primaryCta.label}
            </Link>
            <Link
              href={content.secondaryCta.href}
              className="rounded-full border border-[#f4efe8]/30 px-5 py-3 text-center text-sm font-medium text-[#f4efe8]"
            >
              {content.secondaryCta.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
