"use client";

import Link from "next/link";

import { useLanguage } from "@/components/site/LanguageProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { ProgramStep } from "@/content/programs";

export function ProgramDetailPage({ step }: { step: ProgramStep }) {
  const { dictionary } = useLanguage();
  const copy = dictionary.programs;
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-16">
        <Link
          href="/percorsi"
          className="text-sm font-medium text-[#8b5e4a] transition hover:text-[#211815]"
        >
          {copy.backToPrograms}
        </Link>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
          {step.subtitle}
        </p>
        <h1 className="mt-4 max-w-4xl font-serif text-[clamp(42px,11vw,82px)] font-medium leading-[0.98] tracking-normal text-[#211815]">
          {step.title}
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
          {step.description}
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-[1fr_0.8fr]">
          <article className="rounded-[8px] border border-[#211815]/10 bg-white/62 p-5 md:p-6">
            <h2 className="font-serif text-3xl font-medium leading-[1.08] tracking-normal">
              {copy.whatWeWork}
            </h2>
            <ul className="mt-5 grid gap-2">
              {step.work.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-[1.55] text-[#5f524c]">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8b5e4a]/55"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/75 to-[#efe4d7]/65 p-5 md:p-6">
            <h2 className="font-serif text-3xl font-medium leading-[1.08] tracking-normal">
              {copy.forWhom}
            </h2>
            <p className="mt-4 text-sm leading-[1.7] text-[#5f524c]">
              {step.audience}
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
