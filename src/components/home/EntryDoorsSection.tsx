"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";

const S = "rgba(245,240,235,0.65)";

const CARD_COLORS = [
  { bg: "#e8ddd4", text: "#2a1f1a" },
  { bg: "#dde4d8", text: "#1e2a1e" },
  { bg: "#d8d4e8", text: "#1e1a2a" },
  { bg: "#e8d4de", text: "#2a1a20" },
] as const;

function renderMobileIcon(index: number, stroke: string) {
  if (index === 0) return <IconCompass stroke={stroke} />;
  if (index === 1) return <IconCircles stroke={stroke} />;
  if (index === 2) return <IconStar stroke={stroke} />;
  if (index === 3) return <IconPeople stroke={stroke} />;
  return null;
}

function IconCompass({ stroke = S }: { stroke?: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <circle cx="15" cy="15" r="11" stroke={stroke} strokeWidth="1.3" />
      <circle cx="15" cy="15" r="2" stroke={stroke} strokeWidth="1.3" />
      <path d="M19.5 10.5l-5 4-4 5 5-4 4-5z" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconCircles({ stroke = S }: { stroke?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="3" stroke={stroke} strokeWidth="1.3" />
      <circle cx="14" cy="14" r="6.5" stroke={stroke} strokeWidth="1.3" />
      <circle cx="14" cy="14" r="11" stroke={stroke} strokeWidth="1.3" />
    </svg>
  );
}

function IconStar({ stroke = S }: { stroke?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M14 2l2.8 8.5H25l-6.8 5 2.6 8.5L14 19.5l-6.8 4.5 2.6-8.5L3 10.5h8.2L14 2z"
        stroke={stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPeople({ stroke = S }: { stroke?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="4" stroke={stroke} strokeWidth="1.3" />
      <circle cx="19" cy="9" r="4" stroke={stroke} strokeWidth="1.3" />
      <path d="M1 26c0-4.5 3.5-8 8-8s8 3.5 8 8" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M19 18c4.5 0 8 3.5 8 8" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function EntryDoorsSection() {
  const reduceMotion = useReducedMotion();
  const { dictionary } = useLanguage();
  const { doors } = dictionary.home;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-6xl px-5 pb-14 pt-6 sm:px-6 md:pb-20 md:pt-8">
      <motion.div
        className="hidden md:grid md:grid-cols-[0.78fr_1fr] md:items-end md:gap-8"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {doors.eyebrow}
          </p>
          <h2 className="mt-2 max-w-2xl font-serif text-[32px] font-medium leading-[1.1] tracking-normal text-[#211815] md:text-5xl">
            {doors.title}
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-[1.7] text-[#5f524c] md:text-base">
          {doors.description}
        </p>
      </motion.div>

      <div className="mt-8 overflow-hidden rounded-[16px] bg-[#f0ebe4] px-4 py-6 md:hidden">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b07a5a]">
          {doors.eyebrow}
        </p>
        <h2 className="mt-1.5 font-serif text-[22px] font-medium leading-[1.2] text-[#2a1f1a]">
          {doors.title}
        </h2>
        <div className="mt-5 flex flex-col gap-[6px]">
          {doors.items.map((door, index) => {
            const isOpen = openIndex === index;
            const colors = CARD_COLORS[index];
            return (
              <div
                key={door.title}
                className="overflow-hidden rounded-[12px]"
                style={{ background: colors?.bg }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center gap-[14px] px-[14px] py-[16px] text-left"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${colors?.text}1a` }}
                  >
                    {renderMobileIcon(index, colors?.text ?? S)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[15px] font-normal leading-tight" style={{ color: colors?.text }}>
                      {door.title}
                    </p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-widest" style={{ color: `${colors?.text}99` }}>
                      {door.content}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className="font-mono text-[11px] tabular-nums"
                      style={{ color: colors?.text, opacity: 0.6 }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`text-[18px] leading-none transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
                      style={{ color: colors?.text }}
                    >
                      +
                    </span>
                  </div>
                </button>
                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
                    isOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="pb-[18px] pl-[66px] pr-[14px]">
                    <p className="text-[13px] leading-[1.6]" style={{ color: `${colors?.text}cc` }}>
                      {door.description}
                    </p>
                    <div className="mt-4">
                      <Link
                        href={door.href}
                        className="inline-flex rounded-[100px] px-[16px] py-[8px] text-[12px] transition hover:opacity-80"
                        style={{
                          border: `1px solid ${colors?.text}`,
                          color: colors?.text,
                          backgroundColor: `${colors?.text}14`,
                        }}
                      >
                        {door.cta}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 hidden gap-3 overflow-x-auto pb-3 [scroll-snap-type:x_mandatory] [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden">
        {doors.items.map((door, index) => (
          <motion.div
            key={door.title}
            className="min-w-[280px] flex-1 [scroll-snap-align:start] xl:min-w-0"
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.75,
              delay: index * 0.08,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            <Link
              href={door.href}
              className="group flex h-full min-h-[260px] flex-col overflow-hidden rounded-[16px] border border-[#211815]/10 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(33,24,21,0.10)]"
              style={{ background: CARD_COLORS[index]?.bg }}
            >
              <span className="mb-6 flex items-start justify-between gap-4">
                <span
                  className="grid h-11 w-11 place-items-center rounded-full"
                  style={{ backgroundColor: `${CARD_COLORS[index]?.text}18` }}
                >
                  {renderMobileIcon(index, CARD_COLORS[index]?.text ?? S)}
                </span>
                <span
                  className="font-mono text-[11px] tabular-nums"
                  style={{ color: CARD_COLORS[index]?.text, opacity: 0.55 }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>
              <h3
                className="font-serif text-[24px] font-medium leading-[1.08] tracking-normal"
                style={{ color: CARD_COLORS[index]?.text }}
              >
                {door.title}
              </h3>
              <p
                className="mt-3 text-[10px] font-semibold uppercase leading-5 tracking-[0.16em]"
                style={{ color: `${CARD_COLORS[index]?.text}99` }}
              >
                {door.content}
              </p>
              <p
                className="mt-3 text-sm leading-[1.62]"
                style={{ color: `${CARD_COLORS[index]?.text}cc` }}
              >
                {door.description}
              </p>
              <span
                className="mt-auto inline-flex w-fit rounded-full border px-4 py-2 text-sm font-medium transition group-hover:bg-white/30"
                style={{
                  borderColor: `${CARD_COLORS[index]?.text}55`,
                  color: CARD_COLORS[index]?.text,
                }}
              >
                {door.cta} →
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
