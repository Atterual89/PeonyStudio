import { SiteHeader } from "@/components/site/SiteHeader";
import type { homeContent } from "@/content/home";

type HeroSectionProps = {
  content: typeof homeContent.hero;
};

export function HeroSection({ content }: HeroSectionProps) {
  return (
    <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <SiteHeader />

      <div className="flex flex-1 items-center">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm uppercase tracking-[0.3em] text-[#8b5e4a]">
            {content.eyebrow}
          </p>

          <h1 className="mb-6 text-5xl font-semibold leading-tight md:text-7xl">
            {content.title}
          </h1>

          <p className="mb-10 max-w-2xl text-lg leading-8 text-[#5f524c]">
            {content.description}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={content.primaryCta.href}
              className="rounded-full bg-[#211815] px-6 py-3 text-center text-sm font-medium text-white"
            >
              {content.primaryCta.label}
            </a>

            <a
              href={content.secondaryCta.href}
              className="rounded-full border border-[#211815]/20 px-6 py-3 text-center text-sm font-medium"
            >
              {content.secondaryCta.label}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
