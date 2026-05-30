"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

import type { homeContent } from "@/content/home";

type StudioPreviewSectionProps = {
  content: typeof homeContent.studioPreview;
};

const summaries = [
  "Arrivare, parlare, respirare.",
  "Una zona conviviale.",
  "Punti di lavoro dedicati.",
  "Comfort per studio e pratica.",
];

export function StudioPreviewSection({ content }: StudioPreviewSectionProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-16, 24]);

  return (
    <section className="mx-auto grid max-w-6xl gap-5 px-5 py-12 sm:px-6 md:grid-cols-[0.9fr_1.1fr] md:py-20">
      <div className="grid gap-3">
        <motion.div
          ref={ref}
          className="overflow-hidden rounded-[8px] border border-[#211815]/10 shadow-[0_16px_40px_rgba(33,24,21,0.12)]"
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
        >
          <motion.div style={{ y }} className="h-[110%]">
            <Image
              src="/images/home/space-lounge.jpg"
              alt="Lounge Peony Studio"
              width={760}
              height={520}
              className="aspect-[16/11] h-full w-full object-cover saturate-[0.9]"
            />
          </motion.div>
        </motion.div>
        <motion.div
          className="overflow-hidden rounded-[8px] border border-[#211815]/10"
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
        >
          <Image
            src="/images/home/space-bamboo.jpg"
            alt="Bamboo e hashira Peony Studio"
            width={760}
            height={430}
            className="aspect-[16/9] w-full object-cover saturate-[0.9]"
          />
        </motion.div>
      </div>

      <motion.div
        className="rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 md:p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.75, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
          Lo spazio · Torino
        </p>
        <h2 className="mt-2 font-serif text-[28px] font-medium leading-[1.15] tracking-normal text-[#211815] md:text-4xl">
          {content.title}
        </h2>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          {content.features.map((feature, index) => (
            <div
              key={feature}
              className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3.5 transition hover:bg-white/85"
            >
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#211815]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8b5e4a]" />
                {feature}
              </h3>
              <p className="mt-1.5 text-xs leading-[1.55] text-[#5f524c]">
                {summaries[index]}
              </p>
            </div>
          ))}
        </div>

        <Link
          href={content.cta.href}
          className="mt-6 inline-flex rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_4px_14px_rgba(33,24,21,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(33,24,21,0.18)]"
        >
          {content.cta.label} →
        </Link>
      </motion.div>
    </section>
  );
}
