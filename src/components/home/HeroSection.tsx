"use client";

import Image from "next/image";
import Link from "next/link";

import type { homeContent } from "@/content/home";

type HeroSectionProps = {
  content: typeof homeContent.hero;
};

export function HeroSection({ content }: HeroSectionProps) {
  return (
    <section className="relative flex min-h-[65vh] items-center justify-center overflow-hidden md:min-h-[72vh]">

      {/* Background photo */}
      <Image
        src="/images/home/hero-studio.jpg"
        alt="Peony Studio a Torino"
        fill
        priority
        sizes="100vw"
        className="object-cover saturate-[0.90]"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#1a1510]/52" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-5 py-12 text-center text-[#f4efe8]">
        <Image
          src="/brand/peony-logo.png"
          alt=""
          width={44}
          height={44}
          className="mb-5 h-10 w-auto opacity-80"
        />

        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#f4efe8]/60">
          {content.eyebrow}
        </p>

        <h1 className="mt-3 font-serif text-[clamp(36px,9vw,72px)] font-medium leading-[1.0] tracking-normal text-[#f4efe8]">
          Peony Studio
        </h1>

        <p className="mt-2 font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f4efe8]/65 md:text-xs">
          Kinbaku Venue · Torino
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={content.primaryCta.href}
            className="inline-flex rounded-full bg-[#f4efe8] px-6 py-2.5 text-sm font-medium text-[#211815] shadow-[0_4px_18px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_26px_rgba(0,0,0,0.28)]"
          >
            {content.primaryCta.label}
          </Link>
          <Link
            href={content.secondaryCta.href}
            className="inline-flex rounded-full border border-[#f4efe8]/30 bg-[#f4efe8]/10 px-6 py-2.5 text-sm font-medium text-[#f4efe8] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-[#f4efe8]/20"
          >
            {content.secondaryCta.label}
          </Link>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40">
        <span className="text-[8px] uppercase tracking-[0.25em] text-[#f4efe8]">Scorri</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 6l4.5 4.5L12.5 6" stroke="#f4efe8" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    </section>
  );
}
