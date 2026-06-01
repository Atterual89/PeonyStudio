"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const doors = [
  {
    mark: "?",
    href: "/come-iniziare",
    title: "Non so da dove iniziare",
    content: "Guida + quiz",
    description:
      "Per chi è curioso/a, ma non sa ancora quale attività scegliere.",
    cta: "Trova il punto di partenza",
    image: "/images/home/entry-beginner.jpg",
    gradient: "from-white/75 to-[#efe4d7]/70",
  },
  {
    mark: "P",
    href: "/percorsi",
    title: "Voglio seguire un percorso",
    content: "Workshop + Classi tematiche + Classe 1 / 1+",
    description:
      "Per lavorare con continuità dentro un ciclo strutturato di incontri.",
    cta: "Guarda i percorsi",
    image: "/images/home/entry-practice.jpg",
    gradient: "from-[#f4efe8]/80 to-[#d6b89f]/40",
  },
  {
    mark: "W",
    href: "/workshop",
    title: "Voglio approfondire con workshop",
    content: "Ospiti + temi + ricerca",
    description:
      "Per appuntamenti intensivi, ospiti, temi specifici e momenti di ricerca.",
    cta: "Scopri i workshop",
    image: "/images/home/entry-workshop.jpg",
    gradient: "from-white/70 to-[#d9c6b5]/55",
  },
  {
    mark: "C",
    href: "/pratica",
    title: "Voglio conoscere la community",
    content: "Rope Jam + Open Day + Aperibottom",
    description:
      "Per incontrare persone, praticare in modo più informale e vivere lo spazio.",
    cta: "Entra nella community",
    image: "/images/home/entry-practice.jpg",
    gradient: "from-[#f4efe8]/80 to-[#d6b89f]/40",
  },
];

export function EntryDoorsSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-24">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
          Orientamento
        </p>
        <h2 className="mt-2 max-w-2xl font-serif text-[32px] font-medium leading-[1.1] tracking-normal text-[#211815] md:text-5xl">
          Scegli come entrare a Peony Studio.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-[1.7] text-[#5f524c] md:text-base">
          Ogni persona arriva alle corde da un punto diverso: curiosità,
          studio, pratica, ricerca, desiderio di incontrare una community.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {doors.map((door, index) => (
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
