"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";
import type { homeContent } from "@/content/home";

type PhilosophySectionProps = {
  content: typeof homeContent.philosophy;
};

export function PhilosophySection({ content }: PhilosophySectionProps) {
  const [open, setOpen] = useState(0);
  const reduceMotion = useReducedMotion();
  const { dictionary } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [42, -42]);
  const rotate = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-6, 6]);

  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-20">
      <div
        ref={ref}
        className="relative overflow-hidden rounded-[8px] bg-[#e0d0c0] px-6 py-10 text-[#2a1a10] shadow-[0_4px_24px_rgba(33,24,21,0.07)] md:px-10 md:py-14"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(214,184,159,0.28),transparent_30%),linear-gradient(90deg,rgba(244,239,232,0.05)_1px,transparent_1px)] bg-[size:auto,70px_70px]"
        />
        <motion.div
          aria-hidden="true"
          className="absolute -bottom-20 -right-16 h-[340px] w-[340px] opacity-[0.07]"
          style={{ y, rotate }}
        >
          <Image
            src="/brand/peony-logo.png"
            alt=""
            width={340}
            height={340}
            className="h-full w-full object-contain"
          />
        </motion.div>

        <div className="relative">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8a5a3a]">
              {dictionary.home.philosophy.eyebrow}
            </p>
            <h2 className="mt-3 max-w-3xl font-serif text-[clamp(36px,8vw,56px)] font-medium leading-[1.05] tracking-normal text-[#2a1a10]">
              {content.title}
            </h2>
          </motion.div>

          <div className="mt-8">
            {content.concepts.map((concept, index) => {
              const active = open === index;

              return (
                <motion.div
                  key={concept.word}
                  initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.75,
                    delay: index * 0.1,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  className="border-t border-[#c4a888] last:border-b"
                >
                  <button
                    type="button"
                    onClick={() => setOpen(index)}
                    className="flex w-full items-center justify-between gap-3 py-4 text-left"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="text-[11px] font-semibold tracking-[0.2em] text-[#8a5a3a]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`font-serif text-3xl font-medium transition duration-500 ${
                          active
                            ? "italic text-[#8a5a3a]"
                            : "text-[#2a1a10]"
                        }`}
                      >
                        {concept.word}
                      </span>
                    </span>
                    <span
                      className={`relative h-6 w-6 shrink-0 transition duration-500 ${
                        active ? "rotate-45" : ""
                      }`}
                    >
                      <span className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8a5a3a]" />
                      <span className="absolute left-1/2 top-1/2 h-px w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8a5a3a]" />
                    </span>
                  </button>
                  <motion.div
                    initial={false}
                    animate={{
                      height: active ? "auto" : 0,
                      opacity: active ? 1 : 0,
                    }}
                    transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="mb-5 ml-8 max-w-xl text-sm leading-[1.7] text-[#5a4030]">
                      {concept.desc}
                    </p>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.75, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <Link
              href={content.cta.href}
              className="mt-7 inline-flex rounded-full border border-[#2a1a10] px-6 py-3 text-sm font-medium text-[#2a1a10] transition hover:-translate-y-0.5 hover:bg-[#2a1a10]/5"
            >
              {content.cta.label} →
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
