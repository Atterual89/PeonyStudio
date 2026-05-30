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
    <section className="relative overflow-hidden bg-[#f4efe8] px-5 pb-14 pt-6 text-center sm:px-6 md:pb-20">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(33,24,21,0.025)_1px,transparent_1px),linear-gradient(rgba(33,24,21,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_50%_30%,black_30%,transparent_80%)]"
      />

      <motion.div
        className="relative z-10 mx-auto mb-7 flex justify-center"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
      >
        <Image
          src="/brand/peony-logo.png"
          alt="Peony Studio"
          width={150}
          height={150}
          priority
          className="h-auto w-[140px]"
        />
      </motion.div>

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[0.9fr_1.1fr] md:text-left">
        <div>
          <motion.p
            className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            {content.eyebrow}
          </motion.p>

          <h1 className="mt-5 font-serif text-[clamp(34px,7.5vw,52px)] font-medium leading-[1.05] tracking-normal text-[#211815]">
            <WordReveal text={content.title} />
          </h1>

          <motion.p
            className="mx-auto mt-5 max-w-[360px] text-[15px] leading-[1.65] text-[#5f524c] md:mx-0"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.9, delay: 1.5 }}
          >
            {content.description}
          </motion.p>

          <div className="mt-8 flex flex-col items-center gap-2.5 sm:flex-row md:items-start">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.8 }}
            >
              <Link
                href={content.primaryCta.href}
                className="inline-flex w-[280px] justify-center rounded-full bg-[#211815] px-6 py-3.5 text-sm font-medium text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(33,24,21,0.22)] sm:w-auto"
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
                className="inline-flex w-[280px] justify-center rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-6 py-3.5 text-sm font-medium text-[#211815] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/65 sm:w-auto"
              >
                {content.secondaryCta.label}
              </Link>
            </motion.div>
          </div>
        </div>

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
              className="h-[300px] w-full object-cover saturate-[0.92] sm:h-[420px] md:h-[520px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#211815]/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between p-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f4efe8]/85">
              <span>Studio</span>
              <span>Torino</span>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        className="relative z-10 mt-8 flex flex-col items-center gap-1.5 opacity-45"
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
