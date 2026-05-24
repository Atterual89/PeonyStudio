import Link from "next/link";

import { HomeSectionHeading } from "@/components/home/HomeSectionHeading";
import type { homeContent } from "@/content/home";

type SpacePreviewSectionProps = {
  content: typeof homeContent.spacePreview;
};

export function SpacePreviewSection({ content }: SpacePreviewSectionProps) {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[0.9fr_1.1fr] md:items-center">
      <div className="min-h-72 rounded-[8px] bg-[#d9cabb]" />

      <div>
        <HomeSectionHeading
          eyebrow={content.eyebrow}
          title={content.title}
          intro={content.intro}
        />

        <Link
          href={content.cta.href}
          className="mt-8 inline-flex rounded-full border border-[#211815]/20 px-5 py-3 text-sm font-medium"
        >
          {content.cta.label}
        </Link>
      </div>
    </section>
  );
}
