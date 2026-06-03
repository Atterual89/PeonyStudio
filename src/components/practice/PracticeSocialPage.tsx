"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FeaturedEventsSection } from "@/components/home/FeaturedEventsSection";
import { useLanguage } from "@/components/site/LanguageProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { practiceBilingual } from "@/content/practice";
import type {
  PracticeBranch,
  PracticeBranchKey,
  practiceContent,
} from "@/content/practice";
import type { PeonyEventCard } from "@/lib/events";

type PracticeSocialPageProps = {
  content: typeof practiceContent;
  events: PeonyEventCard[];
};

export function PracticeSocialPage({
  content,
  events,
}: PracticeSocialPageProps) {
  const { dictionary, locale } = useLanguage();
  const localizedContent = practiceBilingual[locale] ?? practiceBilingual.it;
  const [openBranches, setOpenBranches] = useState<
    Record<PracticeBranchKey, boolean>
  >({
    practice: false,
    social: false,
  });
  const relatedDates = useMemo(() => events, [events]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-12 sm:px-6 md:pb-10 md:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
          {dictionary.practice.heroEyebrow}
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_0.42fr] md:items-end">
          <div>
            <h1 className="max-w-4xl font-serif text-[clamp(44px,10vw,82px)] font-medium leading-[0.96] tracking-normal text-[#211815]">
              {dictionary.practice.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
              {dictionary.practice.heroIntro}
            </p>
          </div>
          <Link
            href={content.hero.cta.href}
            className="inline-flex w-fit rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(33,24,21,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
          >
            {dictionary.practice.heroCtaLabel}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-6 sm:px-6 md:py-8">
        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {localizedContent.branches.map((branch) => {
            return (
              <BranchColumn
                key={branch.key}
                branch={branch}
                open={openBranches[branch.key]}
                onToggle={() =>
                  setOpenBranches((current) => ({
                    ...current,
                    [branch.key]: !current[branch.key],
                  }))
                }
              />
            );
          })}
        </div>
      </section>

      <section id="prossime-date">
        <FeaturedEventsSection
          featured={relatedDates[0] ?? null}
          events={relatedDates.slice(1)}
          eyebrow={dictionary.practice.eventsEyebrow}
          title={dictionary.practice.datesTitle}
          ctaLabel={dictionary.practice.datesCtaLabel}
          ctaHref={content.dates.cta.href}
        />
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-12 pt-4 sm:px-6 md:pb-16">
        <div className="rounded-[8px] border border-[#211815]/10 bg-white/34 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:flex md:items-center md:justify-between md:gap-6">
          <p className="max-w-2xl text-sm leading-[1.65] text-[#5f524c]">
            {dictionary.practice.dashboardText}
          </p>
          <Link
            href={content.dashboard.cta.href}
            className="mt-4 inline-flex rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/70 md:mt-0"
          >
            {dictionary.practice.dashboardCtaLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}

function BranchColumn({
  branch,
  open,
  onToggle,
}: {
  branch: PracticeBranch;
  open: boolean;
  onToggle: () => void;
}) {
  const { dictionary } = useLanguage();

  return (
    <section className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${branch.key}-branch-panel`}
        onClick={onToggle}
        className={`group block min-h-[96px] w-full rounded-[8px] border p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8] md:min-h-0 md:p-5 ${
          open
            ? "border-[#8b5e4a]/45 bg-white/58"
            : "border-[#211815]/10 bg-white/34"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a] md:block">
              {dictionary.practice.branchLabel}
            </p>
            <h2 className="font-serif text-[28px] font-medium leading-[1] tracking-normal text-[#211815] md:mt-3 md:text-5xl">
              {branch.title}
            </h2>
          </div>
          <span
            aria-hidden="true"
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#211815]/15 bg-[#f4efe8]/70 text-lg leading-none text-[#8b5e4a] transition md:mt-1 md:h-9 md:w-9 md:text-xl ${
              open ? "rotate-45" : ""
            }`}
          >
            +
          </span>
        </div>
        <p className="mt-4 hidden text-sm leading-[1.65] text-[#5f524c] md:block">
          {branch.description}
        </p>
      </button>

      <div
        id={`${branch.key}-branch-panel`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mx-auto h-5 w-px border-l border-dashed border-[#8b5e4a]/45 md:h-10" />
          <div className="grid gap-3">
            {branch.activities.map((activity) => (
              <article
                key={activity.title}
                className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/68 to-[#efe4d7]/50 p-3 shadow-[0_2px_0_rgba(33,24,21,0.03)] md:p-4"
              >
                <h3 className="font-serif text-[23px] font-medium leading-[1.05] tracking-normal text-[#211815] md:text-3xl">
                  {activity.title}
                </h3>
                <p className="mt-2 text-xs leading-[1.55] text-[#5f524c] md:mt-3 md:text-sm md:leading-[1.65]">
                  {activity.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5 md:mt-4 md:gap-2">
                  {activity.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/72 px-2 py-1 text-[11px] leading-none text-[#5f524c] md:px-3 md:py-1.5 md:text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
