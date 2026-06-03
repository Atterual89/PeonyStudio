"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";

export type FeaturedEvent = {
  slug: string;
  category: string;
  title: string;
  date: string;
  detail?: string;
  image?: string;
  eventUrl: string;
  target?: string;
  bookingUrl?: string;
};

type FeaturedEventsSectionProps = {
  featured: FeaturedEvent | null;
  events: FeaturedEvent[];
  eyebrow?: string;
  title?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

function useCountdown(target?: string) {
  const getTime = useCallback(() => {
    const targetTime = target ? new Date(target).getTime() : Date.now();
    const diff = Math.max(0, targetTime - Date.now());

    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff / 3600000) % 24),
      m: Math.floor((diff / 60000) % 60),
      s: Math.floor((diff / 1000) % 60),
    };
  }, [target]);

  const [time, setTime] = useState(getTime);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(getTime()), 1000);
    return () => window.clearInterval(timer);
  }, [getTime]);

  return time;
}

function Countdown({ target }: { target?: string }) {
  const time = useCountdown(target);
  const items = [
    ["G", time.d],
    ["H", time.h],
    ["M", time.m],
    ["S", time.s],
  ];

  return (
    <div className="inline-flex gap-2 rounded-full border border-[#d6b89f]/30 bg-[#d6b89f]/15 px-3.5 py-2">
      {items.map(([label, value]) => (
        <span
          key={label}
          className="flex items-baseline gap-1 text-[11px] tracking-[0.05em] text-[#d6b89f]"
        >
          <span className="font-serif text-base font-medium text-[#f4efe8]">
            {String(value).padStart(2, "0")}
          </span>
          <span className="opacity-70">{label}</span>
        </span>
      ))}
    </div>
  );
}

export function FeaturedEventsSection({
  featured,
  events,
  eyebrow,
  title,
  ctaLabel,
  ctaHref = "/calendario",
}: FeaturedEventsSectionProps) {
  const reduceMotion = useReducedMotion();
  const { dictionary } = useLanguage();
  const eventsDict = dictionary.home.events;
  const resolvedEyebrow = eyebrow ?? eventsDict.eyebrow;
  const resolvedTitle = title ?? eventsDict.title;
  const resolvedCtaLabel = ctaLabel ?? eventsDict.ctaLabel;

  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto mb-6 flex max-w-6xl items-end justify-between gap-4 px-5 sm:px-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {resolvedEyebrow}
          </p>
          <h2 className="mt-2 font-serif text-[32px] font-medium leading-[1.1] tracking-normal md:text-5xl">
            {resolvedTitle}
          </h2>
        </motion.div>
        <Link
          href={ctaHref}
          className="shrink-0 text-sm font-medium text-[#8b5e4a] transition hover:translate-x-1"
        >
          {resolvedCtaLabel}
        </Link>
      </div>

      <motion.div
        className="mx-auto max-w-[1240px] overflow-x-auto px-5 pb-3 pt-1 [scroll-snap-type:x_mandatory] [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.75, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex gap-3">
          {featured ? (
            <Link
              href={featured.eventUrl}
              className="group relative flex min-h-[420px] w-[min(82vw,340px)] shrink-0 flex-col overflow-hidden rounded-[8px] border border-[#211815] bg-[#211815] p-5 text-[#f4efe8] [scroll-snap-align:start] shadow-[0_4px_16px_rgba(33,24,21,0.15)] transition duration-500 hover:-translate-y-[3px] hover:shadow-[0_14px_36px_rgba(33,24,21,0.30)]"
            >
              <span
                aria-hidden="true"
                className="absolute -right-8 -top-8 h-[120px] w-[120px] rounded-full bg-[#d6b89f]/15"
              />
              <div className="relative mb-4 overflow-hidden rounded-[6px] border border-[#f4efe8]/10">
                <Image
                  src={featured.image ?? "/images/home/event-rope-jam.jpg"}
                  alt={featured.title}
                  width={640}
                  height={400}
                  className="h-36 w-full object-cover saturate-[0.9] transition duration-700 group-hover:scale-105 md:h-40"
                />
              </div>
              <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d6b89f]">
                {featured.category}
              </p>
              <h3 className="relative mt-3 font-serif text-[38px] font-medium leading-[1.05] tracking-normal">
                {featured.title}
              </h3>
              <div className="mt-auto">
                <Countdown target={featured.target} />
                <div className="mt-3 border-t border-[#f4efe8]/15 pt-3">
                  <p className="text-sm font-semibold">{featured.date}</p>
                  {featured.detail ? (
                    <p className="mt-1 overflow-hidden text-sm text-[#f4efe8]/70 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
                      {featured.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ) : (
            <article className="relative flex min-h-[320px] w-[min(82vw,340px)] shrink-0 flex-col justify-between overflow-hidden rounded-[8px] border border-[#211815] bg-[#211815] p-5 text-[#f4efe8] [scroll-snap-align:start] shadow-[0_4px_16px_rgba(33,24,21,0.15)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d6b89f]">
                {eventsDict.fallback.eyebrow}
              </p>
              <h3 className="mt-3 font-serif text-[34px] font-medium leading-[1.06] tracking-normal">
                {eventsDict.fallback.title}
              </h3>
              <Link
                href={ctaHref}
                className="mt-8 inline-flex rounded-full border border-[#f4efe8]/20 px-4 py-2.5 text-sm font-medium text-[#f4efe8] transition hover:bg-[#f4efe8]/10"
              >
                {eventsDict.fallback.cta}
              </Link>
            </article>
          )}

          {events.map((event) => (
            <Link
              key={`${event.category}-${event.title}`}
              href={event.eventUrl}
              className="group relative flex w-[min(74vw,285px)] shrink-0 flex-col overflow-hidden rounded-[8px] border border-[#211815]/10 bg-white/65 p-[18px] [scroll-snap-align:start] shadow-[0_1px_0_rgba(33,24,21,0.04)] transition duration-500 hover:-translate-y-[3px] hover:shadow-[0_12px_30px_rgba(33,24,21,0.08)]"
            >
              <span
                aria-hidden="true"
                className="absolute -right-8 -top-8 h-[110px] w-[110px] rounded-full bg-[#d6b89f]/20"
              />
              <div className="relative mb-3.5 overflow-hidden rounded-[6px] border border-[#211815]/10">
                <Image
                  src={event.image ?? "/images/home/event-foundation.jpg"}
                  alt={event.title}
                  width={570}
                  height={360}
                  className="h-32 w-full object-cover saturate-[0.9] transition duration-700 group-hover:scale-105 md:h-36"
                />
              </div>
              <p className="relative text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
                {event.category}
              </p>
              <h3 className="relative mt-2.5 font-serif text-2xl font-medium leading-[1.15] tracking-normal text-[#211815]">
                {event.title}
              </h3>
              <div className="mt-auto border-t border-[#211815]/10 pt-3">
                <p className="text-sm font-semibold text-[#211815]">
                  {event.date}
                </p>
                {event.detail ? (
                  <p className="mt-1 overflow-hidden text-xs leading-[1.45] text-[#5f524c] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {event.detail}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
