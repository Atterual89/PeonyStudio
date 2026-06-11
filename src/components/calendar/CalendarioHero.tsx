"use client";

import Link from "next/link";

import { useLanguage } from "@/components/site/LanguageProvider";

export function CalendarioHero({ ticketTailorUrl }: { ticketTailorUrl: string }) {
  const { dictionary } = useLanguage();
  const copy = dictionary.calendar;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-8 pt-12 sm:px-6 md:pb-10 md:pt-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
        {copy.heroEyebrow}
      </p>
      <div className="mt-4 grid gap-5 md:grid-cols-[1fr_0.36fr] md:items-end">
        <div>
          <h1 className="max-w-4xl font-serif text-[clamp(44px,10vw,82px)] font-medium leading-[0.96] tracking-normal text-[#211815]">
            {copy.heroTitle}
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
            {copy.heroSubtitle}
          </p>
        </div>
        <Link
          href={ticketTailorUrl}
          className="inline-flex w-fit rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(33,24,21,0.22)]"
        >
          {copy.openTicketTailor}
        </Link>
      </div>
    </section>
  );
}
