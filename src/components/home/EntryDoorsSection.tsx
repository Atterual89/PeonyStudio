"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";

const S = "rgba(245,240,235,0.65)"; // stroke colore SVG

function IconCompass() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <circle cx="15" cy="15" r="11" stroke={S} strokeWidth="1.3" />
      <circle cx="15" cy="15" r="2" stroke={S} strokeWidth="1.3" />
      <path d="M19.5 10.5l-5 4-4 5 5-4 4-5z" stroke={S} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconCircles() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="3" stroke={S} strokeWidth="1.3" />
      <circle cx="14" cy="14" r="6.5" stroke={S} strokeWidth="1.3" />
      <circle cx="14" cy="14" r="11" stroke={S} strokeWidth="1.3" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M14 2l2.8 8.5H25l-6.8 5 2.6 8.5L14 19.5l-6.8 4.5 2.6-8.5L3 10.5h8.2L14 2z"
        stroke={S}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="4" stroke={S} strokeWidth="1.3" />
      <circle cx="19" cy="9" r="4" stroke={S} strokeWidth="1.3" />
      <path d="M1 26c0-4.5 3.5-8 8-8s8 3.5 8 8" stroke={S} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M19 18c4.5 0 8 3.5 8 8" stroke={S} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function EntryDoorsSection() {
  const reduceMotion = useReducedMotion();
  const { dictionary } = useLanguage();
  const { doors } = dictionary.home;
  const d = doors.items;

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // panelIndex NON si azzera al close: mantiene il contenuto visibile durante la transizione di chiusura
  const [panelIndex, setPanelIndex] = useState(0);
  const panelItem = d[panelIndex] ?? d[0];

  function tap(index: number) {
    if (openIndex === index) {
      setOpenIndex(null); // chiude — panelIndex rimane invariato
    } else {
      setPanelIndex(index);
      setOpenIndex(index);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-24">

      {/* intestazione sezione */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
          {doors.eyebrow}
        </p>
        <h2 className="mt-2 max-w-2xl font-serif text-[32px] font-medium leading-[1.1] tracking-normal text-[#211815] md:text-5xl">
          {doors.title}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-[1.7] text-[#5f524c] md:text-base">
          {doors.description}
        </p>
      </motion.div>

      {/* ── MOBILE: collage card scure ── */}
      <div className="mt-8 md:hidden">

        {/* Card 1 — full width, 180px */}
        <button
          type="button"
          onClick={() => tap(0)}
          className="relative mb-3 flex h-[180px] w-full flex-col justify-between overflow-hidden rounded-[12px] p-4 text-left"
          style={{ background: "#3a2e24" }}
        >
          <div className="relative flex justify-center">
            <span className="absolute left-0 font-sans text-[9px] tracking-wide text-white/35">
              01
            </span>
            <IconCompass />
          </div>
          <div>
            <p className="font-sans text-[9px] uppercase tracking-widest text-white/45">
              {d[0]?.content}
            </p>
            <p className="mt-1 font-serif text-lg font-medium leading-tight text-[#f5efea]">
              {d[0]?.title}
            </p>
            <p className="mt-1.5 font-sans text-xs text-[#8b5e4a]">
              {d[0]?.cta} →
            </p>
          </div>
        </button>

        {/* Riga 2 — Card 2 + Card 3, grid 2 col, 110px */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => tap(1)}
            className="flex h-[110px] flex-col justify-between overflow-hidden rounded-[12px] p-3.5 text-left"
            style={{ background: "#2e3828" }}
          >
            <div className="flex items-start justify-between">
              <span className="font-sans text-[9px] tracking-wide text-white/35">02</span>
              <IconCircles />
            </div>
            <div>
              <p className="font-serif text-sm font-medium leading-tight text-[#f5efea] line-clamp-1">
                {d[1]?.title}
              </p>
              <p className="mt-0.5 font-sans text-[9px] uppercase tracking-widest text-white/45">
                {d[1]?.content}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => tap(2)}
            className="flex h-[110px] flex-col justify-between overflow-hidden rounded-[12px] p-3.5 text-left"
            style={{ background: "#2a2838" }}
          >
            <div className="flex items-start justify-between">
              <span className="font-sans text-[9px] tracking-wide text-white/35">03</span>
              <IconStar />
            </div>
            <div>
              <p className="font-serif text-sm font-medium leading-tight text-[#f5efea] line-clamp-1">
                {d[2]?.title}
              </p>
              <p className="mt-0.5 font-sans text-[9px] uppercase tracking-widest text-white/45">
                {d[2]?.content}
              </p>
            </div>
          </button>
        </div>

        {/* Card 4 — orizzontale full width, 72px */}
        <button
          type="button"
          onClick={() => tap(3)}
          className="flex h-[72px] w-full items-center gap-3 overflow-hidden rounded-[12px] px-4 text-left"
          style={{ background: "#382030" }}
        >
          <IconPeople />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[#8b5e4a]" />
              <span className="font-sans text-[9px] uppercase tracking-widest text-[#8b5e4a]">
                {d[3]?.content}
              </span>
            </div>
            <p className="mt-0.5 truncate font-serif text-sm font-medium leading-tight text-[#f5efea]">
              {d[3]?.title}
            </p>
          </div>
          <span className="font-sans text-[9px] tracking-wide text-white/35">04</span>
        </button>

        {/* Pannello inline espandibile — sempre renderizzato per la close transition */}
        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
            openIndex !== null ? "max-h-[400px]" : "max-h-0"
          }`}
        >
          <div className="pt-3">
            <div className="rounded-[12px] bg-[#2e2418] p-4">
              <p className="font-sans text-[9px] uppercase tracking-widest text-white/45">
                {panelItem.content}
              </p>
              <p className="mt-2 font-serif text-xl font-medium leading-tight text-[#f5efea]">
                {panelItem.title}
              </p>
              <p className="mt-2 text-sm leading-[1.65] text-white/60">
                {panelItem.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={panelItem.href}
                  className="inline-flex rounded-full bg-[#8b5e4a] px-4 py-2 font-sans text-sm font-medium text-[#f5efea] transition hover:bg-[#7a5241]"
                >
                  {panelItem.cta}
                </Link>
                <button
                  type="button"
                  onClick={() => setOpenIndex(null)}
                  className="inline-flex rounded-full border border-white/20 px-4 py-2 font-sans text-sm font-medium text-white/60 transition hover:bg-white/10"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: grid originale invariata ── */}
      <div className="mt-8 hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        {doors.items.map((door, index) => (
          <motion.div
            key={door.title}
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.75,
              delay: index * 0.12,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            <Link
              href={door.href}
              className={`group relative flex h-full flex-col overflow-hidden rounded-[8px] border border-[#211815]/10 bg-gradient-to-br ${door.gradient} p-[18px] shadow-[0_2px_0_rgba(33,24,21,0.03)] transition duration-500 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(33,24,21,0.10)]`}
            >
              <span
                aria-hidden="true"
                className="absolute -right-10 top-12 h-[140px] w-[140px] rounded-full border border-[#211815]/10 bg-[#f4efe8]/30 transition duration-500 group-hover:scale-110"
              />
              <span className="relative mb-5 overflow-hidden rounded-[6px] border border-[#211815]/10">
                <Image
                  src={door.image}
                  alt={door.title}
                  width={640}
                  height={480}
                  className="aspect-[4/3] w-full object-cover saturate-[0.92] transition duration-700 ease-[cubic-bezier(.23,1,.32,1)] group-hover:scale-[1.06]"
                />
              </span>
              <span className="relative mb-5 flex items-center justify-between">
                <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/55 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-[#8b5e4a]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#211815] text-sm font-medium text-[#f4efe8] shadow-[0_4px_14px_rgba(33,24,21,0.18)]">
                  {door.mark}
                </span>
              </span>
              <h3 className="relative font-serif text-[28px] font-medium leading-[1.1] tracking-normal text-[#211815]">
                {door.title}
              </h3>
              <p className="relative mt-3 text-[11px] font-semibold uppercase leading-5 tracking-[0.12em] text-[#8b5e4a]">
                {door.content}
              </p>
              <p className="relative mt-3 text-sm leading-[1.65] text-[#5f524c]">
                {door.description}
              </p>
              <span className="relative mt-5 w-fit border-b border-[#8b5e4a]/35 pb-1 text-sm font-medium text-[#8b5e4a] transition group-hover:border-[#8b5e4a]">
                {door.cta} →
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
