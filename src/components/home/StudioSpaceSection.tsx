import Link from "next/link";

import type { homeContent } from "@/content/home";

type StudioSpaceSectionProps = {
  content: typeof homeContent.studioSpace;
};

export function StudioSpaceSection({ content }: StudioSpaceSectionProps) {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-6 sm:py-20 md:grid-cols-[1fr_1fr] md:items-center md:py-28">
      <div
        aria-hidden="true"
        className="aspect-[4/3] rounded-[8px] bg-[#cdbba8] md:aspect-auto md:min-h-[520px]"
      />

      <div>
        <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
          Lo spazio
        </p>
        <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
          {content.title}
        </h2>

        <ul className="mt-8 divide-y divide-[#211815]/10 border-y border-[#211815]/10">
          {content.features.map((feature) => (
            <li key={feature} className="py-4 text-lg text-[#5f524c]">
              {feature}
            </li>
          ))}
        </ul>

        <Link
          href={content.cta.href}
          className="mt-8 inline-flex rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white"
        >
          {content.cta.label}
        </Link>
      </div>
    </section>
  );
}
