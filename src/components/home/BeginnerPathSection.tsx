import Link from "next/link";

import { HomeSectionHeading } from "@/components/home/HomeSectionHeading";
import type { homeContent } from "@/content/home";

type BeginnerPathSectionProps = {
  content: typeof homeContent.beginnerPath;
};

export function BeginnerPathSection({ content }: BeginnerPathSectionProps) {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1fr_1.1fr] md:items-center">
      <HomeSectionHeading
        eyebrow={content.eyebrow}
        title={content.title}
        intro={content.intro}
      />

      <div className="rounded-[8px] border border-[#211815]/10 bg-white/55 p-6">
        <div className="grid gap-3">
          {content.steps.map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-4 rounded-[8px] bg-[#f9f5ef] p-4"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#211815] text-sm font-medium text-white">
                {index + 1}
              </span>
              <span className="text-lg font-medium">{step}</span>
            </div>
          ))}
        </div>

        <Link
          href={content.cta.href}
          className="mt-6 inline-flex rounded-full border border-[#211815]/20 px-5 py-3 text-sm font-medium"
        >
          {content.cta.label}
        </Link>
      </div>
    </section>
  );
}
