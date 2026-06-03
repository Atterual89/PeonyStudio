"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import type { homeContent } from "@/content/home";

type HeroSectionProps = {
  content: typeof homeContent.hero;
};

function WordReveal({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");

  return (
    <>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block pr-[0.28em]"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.7 + index * 0.06,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

export function HeroSection({ content }: HeroSectionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative h-[70vh] overflow-hidden md:h-auto md:bg-[#f4efe8] md:px-5 md:pb-20 md:pt-10 md:text-center">

      {/* ── MOBILE: tre layer assoluti diretti in <section> ── */}

      {/* z-0 — immagine background */}
      <div className="absolute inset-0 z-0 md:hidden">
        <Image
          src="/images/home/hero-studio.jpg"
          alt="Peony Studio a Torino"
          width={960}
          height={640}
          priority
          className="h-full w-full object-cover saturate-[0.92]"
        />
      </div>

      {/* z-10 — gradiente */}
      <div className="absolute inset-0 z-10 bg-[linear-gradient(to_bottom,transparent_0%,rgba(245,239,234,0.75)_45%,#f5efea_85%)] md:hidden" />

      {/* z-20 — testo */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 backdrop-blur-sm bg-[rgba(245,239,234,0.5)] md:hidden">
        <Image
          src="/brand/peony-logo.png"
          alt=""
          width={32}
          height={32}
          className="mb-2 h-8 w-auto"
        />
        <p className="font-serif text-xl uppercase tracking-widest text-[#1a1510]">Peony Studio</p>
        <p className="mt-1 font-sans text-xs uppercase tracking-[0.2em] text-[#6b5c52]">Kinbaku Venue · Torino</p>
        <div className="mt-5 flex gap-3">
          <Link
            href={content.primaryCta.href}
            className="inline-flex rounded-full bg-[#211815] px-5 py-2.5 text-sm font-medium text-[#f4efe8] shadow-[0_4px_14px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(33,24,21,0.22)]"
          >
            {content.primaryCta.label}
          </Link>
          <Link
            href={content.secondaryCta.href}
            className="inline-flex rounded-full border border-[#211815]/20 bg-transparent px-5 py-2.5 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/65"
          >
            {content.secondaryCta.label}
          </Link>
        </div>
      </div>

      {/* ── DESKTOP: grid layout invariato ── */}

      {/* grid pattern */}
      <div
        aria-hidden="true"
        className="hidden md:absolute md:inset-0 md:block md:bg-[linear-gradient(90deg,rgba(33,24,21,0.025)_1px,transparent_1px),linear-gradient(rgba(33,24,21,0.025)_1px,transparent_1px)] md:bg-[size:72px_72px] md:[mask-image:radial-gradient(circle_at_50%_30%,black_30%,transparent_80%)]"
      />

      <div className="hidden md:relative md:z-10 md:mx-auto md:grid md:h-auto md:max-w-6xl md:items-center md:gap-10 md:grid-cols-[2fr_3fr] md:text-left">

        {/* testo — colonna sinistra */}
        <div>
          <motion.p
            className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            {content.eyebrow}
          </motion.p>

          <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-[#211815]">
            <WordReveal text={content.title} />
          </h1>

          <motion.p
            className="mt-2 line-clamp-2 max-w-[360px] text-sm leading-[1.65] text-[#5f524c]"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.9, delay: 1.5 }}
          >
            {content.description}
          </motion.p>

          <div className="mt-4 flex gap-3">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.8 }}
            >
              <Link
                href={content.primaryCta.href}
                className="inline-flex rounded-full bg-[#211815] px-5 py-2.5 text-sm font-medium text-[#f4efe8] shadow-[0_4px_14px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(33,24,21,0.22)]"
              >
                {content.primaryCta.label}
              </Link>
            </motion.div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 2 }}
            >
              <Link
                href={content.secondaryCta.href}
                className="inline-flex rounded-full border border-[#211815]/20 bg-transparent px-5 py-2.5 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/65"
              >
                {content.secondaryCta.label}
              </Link>
            </motion.div>
          </div>
        </div>

        {/* immagine — colonna destra */}
        <motion.div
          className="relative"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="relative overflow-hidden rounded-[8px] border border-[#211815]/10 shadow-[0_24px_60px_rgba(33,24,21,0.12)]">
            <Image
              src="/images/home/hero-studio.jpg"
              alt="Peony Studio a Torino"
              width={960}
              height={640}
              priority
              className="h-[520px] w-full object-cover saturate-[0.92]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#211815]/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between p-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f4efe8]/85">
              <span>Studio</span>
              <span>Torino</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* scroll indicator — solo desktop */}
      <motion.div
        className="relative z-10 mt-8 hidden flex-col items-center gap-1.5 opacity-45 md:flex"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? undefined : { opacity: 0.45 }}
        transition={{ duration: 1, delay: 2.4 }}
      >
        <span className="text-[9px] uppercase tracking-[0.25em] text-[#5f524c]">
          SCORRI
        </span>
        <span className={reduceMotion ? "" : "animate-[bounce_2.2s_ease-in-out_infinite]"}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M4 7l5 5 5-5"
              stroke="#5f524c"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </motion.div>
    </section>
  );
}
