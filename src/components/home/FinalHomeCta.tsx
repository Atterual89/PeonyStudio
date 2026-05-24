import Link from "next/link";

import type { homeContent } from "@/content/home";

type FinalHomeCtaProps = {
  content: typeof homeContent.finalCta;
};

export function FinalHomeCta({ content }: FinalHomeCtaProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="rounded-[8px] bg-[#211815] px-6 py-12 text-[#f4efe8] md:px-10">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
            {content.title}
          </h2>
          <p className="mt-5 text-base leading-7 text-[#f4efe8]/75 md:text-lg">
            {content.intro}
          </p>
          <Link
            href={content.cta.href}
            className="mt-8 inline-flex rounded-full bg-[#f4efe8] px-5 py-3 text-sm font-medium text-[#211815]"
          >
            {content.cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
