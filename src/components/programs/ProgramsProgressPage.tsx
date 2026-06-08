"use client";

import { BookOpen, Eye, Ribbon, Sprout, User, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const LEGEND_ORDER: IconName[] = ["User", "Users", "Sprout", "BookOpen", "Ribbon", "Eye"];

import { ProgramsLevelQuiz } from "@/components/programs/ProgramsLevelQuiz";
import { TabsWrapper } from "@/components/layout/TabsWrapper";
import { useLanguage } from "@/components/site/LanguageProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { programsBilingual } from "@/content/programs";
import type {
  ParallelPracticeItem,
  ProgramStep,
  programsContent,
} from "@/content/programs";
import type { PeonyEvent } from "@/lib/events";

const ICON_MAP = { User, Users, Sprout, BookOpen, Ribbon, Eye } as const;
type IconName = keyof typeof ICON_MAP;

const NODE_ICONS: Record<number, IconName[]> = {
  0: ["User", "Sprout"],
  1: ["User", "BookOpen"],
  2: ["Users", "BookOpen"],
  3: ["Users", "BookOpen"],
};


const ICON_LABEL_KEY: Record<IconName, "iconLegendUser" | "iconLegendUsers" | "iconLegendSprout" | "iconLegendBookOpen" | "iconLegendRibbon" | "iconLegendEye"> = {
  User:     "iconLegendUser",
  Users:    "iconLegendUsers",
  Sprout:   "iconLegendSprout",
  BookOpen: "iconLegendBookOpen",
  Ribbon:   "iconLegendRibbon",
  Eye:      "iconLegendEye",
};

type ProgramsProgressPageProps = {
  content: typeof programsContent;
  percorsoEvents?: PeonyEvent[];
};

const NODE_LABELS_SHORT = ["F1", "F2", "C1", "C1+"];

const PERCORSO_PATTERNS: Record<number, string[]> = {
  0: ["foundation lv.1", "foundation lv 1", "foundation lev.1", "foundation 1"],
  1: ["foundation lv.2", "foundation lv 2", "foundation lev.2", "foundation 2"],
  2: ["classe 1", "class 1", "classe #1"],
  3: ["classe 1+", "classe 1 +", "class 1+", "classe1+"],
};

function matchPercorso(events: PeonyEvent[], percorsoIndex: number): PeonyEvent[] {
  const keywords = PERCORSO_PATTERNS[percorsoIndex] ?? [];
  return events.filter((e) => {
    const title = e.title.toLowerCase();
    if (percorsoIndex === 2 && (title.includes("1+") || title.includes("1 +"))) return false;
    return keywords.some((k) => title.includes(k));
  });
}

const PARALLELO_PATTERNS: Record<"pratica" | "tematica", string[]> = {
  pratica: ["pratica assistita"],
  tematica: ["classe tematica", "classi tematiche"],
};

function matchParallelo(events: PeonyEvent[], key: "pratica" | "tematica"): PeonyEvent[] {
  const keywords = PARALLELO_PATTERNS[key];
  return events.filter((e) => {
    const title = e.title.toLowerCase();
    return keywords.some((k) => title.includes(k));
  });
}

export function ProgramsProgressPage({ content, percorsoEvents = [] }: ProgramsProgressPageProps) {
  const { dictionary, locale } = useLanguage();
  const prog = dictionary.programs;
  const prac = dictionary.practice;
  const localizedContent = programsBilingual[locale] ?? programsBilingual.it;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeParallelIndex, setActiveParallelIndex] = useState<number | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactProgram, setContactProgram] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  const closeModal = () => {
    setContactModalOpen(false);
    setContactName("");
    setContactProgram("");
    setContactMessage("");
  };

  const activeStep = activeIndex === null ? null : localizedContent.progression[activeIndex];
  const progressScale =
    activeIndex !== null && content.progression.length > 1
      ? activeIndex / (content.progression.length - 1)
      : 0;

  function toggleActiveIndex(index: number) {
    const next = activeIndex === index ? null : index;
    setActiveIndex(next);
    setActiveParallelIndex(null);
    if (next !== null) {
      setTimeout(() => {
        document.getElementById("program-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <TabsWrapper />

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pb-6 pt-12 sm:px-6 md:pb-8 md:pt-16">
        <div aria-hidden="true" className="pointer-events-none absolute right-[-120px] top-0 hidden h-72 w-[520px] opacity-45 md:block">
          <svg viewBox="0 0 520 280" className="h-full w-full">
            <path d="M40 84 C128 8 244 176 334 70 C396 -3 494 38 458 118 C420 206 248 108 238 212 C232 272 360 254 434 208" fill="none" stroke="#8b5e4a" strokeLinecap="round" strokeWidth="10" opacity="0.12" />
            <path d="M42 84 C130 8 246 176 336 70 C398 -3 496 38 460 118 C422 206 250 108 240 212 C234 272 362 254 436 208" fill="none" stroke="#211815" strokeDasharray="2 16" strokeLinecap="round" strokeWidth="2" opacity="0.10" />
          </svg>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b5e4a]">{prog.heroEyebrow}</p>
        <h1 className="mt-4 max-w-3xl font-serif text-[clamp(48px,11vw,86px)] font-medium leading-[0.95] tracking-normal text-[#211815]">
          {prog.heroTitle}
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-[1.75] text-[#211815]/85 md:text-lg">
          {prog.heroIntro}
        </p>
      </section>

      {/* Icon legend banner */}
      <div className="mx-auto max-w-6xl pb-3">
        <div className="overflow-x-auto bg-[#211815]/[0.04] px-5 py-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-4 md:gap-5">
            {LEGEND_ORDER.map((name) => {
              const Icon = ICON_MAP[name];
              return (
                <div key={name} className="flex shrink-0 items-center gap-1.5">
                  <Icon size={12} className="shrink-0 text-[#8b5e4a]/55" aria-hidden="true" />
                  <span className="text-[10px] leading-none text-[#5f524c]/62">{prac[ICON_LABEL_KEY[name]]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quiz banner */}
      <div className="mx-auto max-w-6xl px-5 pb-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/[0.06] px-4 py-2.5">
          <p className="text-sm text-[#5f524c]">{prog.quizBannerText}</p>
          <a
            href="#quiz"
            className="shrink-0 text-sm font-semibold text-[#8b5e4a] transition hover:text-[#211815]"
          >
            {prog.quizBannerBtn}
          </a>
        </div>
      </div>

      {/* Rope + nodes + parallel + detail */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-0 sm:px-6 md:pb-12">

        {/* Inline hint — shown before the rope when nothing is selected */}
        {activeStep === null && activeParallelIndex === null ? (
          <p className="pb-2 pt-4 text-center text-[11px] text-[#5f524c]/50 md:text-xs">
            {prog.clickNodeInstruction.split("◎").map((part, i) =>
              i === 0 ? (
                <span key={i}>{part}<span aria-hidden="true" className="inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#8b5e4a]/45 align-middle"><span className="h-[5px] w-[5px] rounded-full border border-[#8b5e4a]/35" /></span></span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        ) : null}

        {/* ── Rope timeline ── */}
        <div className="relative px-1 pb-2 pt-8 md:px-2 md:pt-10">
          <div className="relative grid grid-cols-4">
            {/* Background rope — thin, muted */}
            <div
              aria-hidden="true"
              className="absolute left-[12.5%] right-[12.5%] top-[19px] h-[2px] rounded-full bg-[#211815]/14 md:top-[23px]"
            />
            {/* Active rope — thicker, colored, scales left to selected node */}
            <div
              aria-hidden="true"
              className="absolute left-[12.5%] right-[12.5%] top-[17px] h-[5px] origin-left rounded-full bg-gradient-to-r from-[#8b5e4a]/55 to-[#8b5e4a] transition-transform duration-500 ease-out md:top-[21px]"
              style={{ transform: `scaleX(${progressScale})` }}
            />

            {localizedContent.progression.map((step, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={step.title}
                  type="button"
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  onClick={() => toggleActiveIndex(index)}
                  className="group relative flex min-w-0 flex-col items-center gap-0 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
                >
                  {/* Node — double-ring knot style */}
                  <span
                    className={`programs-knot relative z-10 grid h-9 w-9 place-items-center rounded-full border-2 bg-[#f4efe8] transition duration-300 md:h-11 md:w-11 ${
                      active
                        ? "border-[#8b5e4a] shadow-[0_0_0_7px_rgba(139,94,74,0.12)]"
                        : "border-[#8b5e4a]/30 shadow-[0_0_0_6px_rgba(244,239,232,0.8)] group-hover:border-[#8b5e4a]/55"
                    }`}
                  >
                    {active && (
                      <span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-[#8b5e4a]/55 animate-ping" />
                    )}
                    <span
                      aria-hidden="true"
                      className={`h-4 w-4 rounded-full border-2 transition duration-300 md:h-5 md:w-5 ${
                        active
                          ? "border-[#8b5e4a] bg-[#8b5e4a]"
                          : "border-[#8b5e4a]/30 bg-transparent group-hover:border-[#8b5e4a]/55"
                      }`}
                    />
                  </span>
                  {/* Short dotted connector */}
                  <span aria-hidden="true" className="h-3 border-l border-dotted border-[#8b5e4a]/40 md:h-4" />
                  {/* Label below — full on md+, abbreviated on mobile */}
                  <span
                    className={`text-center transition duration-200 ${
                      active ? "text-[#8b5e4a]" : "text-[#5f524c]/60 group-hover:text-[#5f524c]"
                    }`}
                  >
                    <span className="block font-semibold leading-tight md:hidden" style={{ fontSize: "10px" }}>
                      {NODE_LABELS_SHORT[index]}
                    </span>
                    <span className="hidden text-xs font-semibold leading-tight md:block">
                      {step.title}
                    </span>
                  </span>
                  {/* Icons */}
                  {active ? (
                    <span className="mt-1 flex justify-center gap-1">
                      {(NODE_ICONS[index] ?? []).map(n => {
                        const Icon = ICON_MAP[n];
                        return <Icon key={n} size={12} className="text-[#8b5e4a]/70" aria-hidden="true" />;
                      })}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Parallel activities ── */}
        <div className="mx-auto flex justify-center pt-5 md:pt-6">
          <span aria-hidden="true" className="h-5 border-l border-dashed border-[#8b5e4a]/35 md:h-6" />
        </div>
        <ParallelBar
          items={localizedContent.parallelPractice.items}
          activeIndex={activeParallelIndex}
          prog={prog}
          percorsoEvents={percorsoEvents}
          onToggle={(index) => {
            setActiveParallelIndex((current) => (current === index ? null : index));
            setActiveIndex(null);
          }}
        />

        {/* ── Program detail ── */}
        {activeStep ? (
          <div id="program-detail" className="mt-4 md:mt-5">
            <ProgramDetail step={activeStep} prog={prog} matchedEvents={matchPercorso(percorsoEvents, activeIndex ?? 0)} />
          </div>
        ) : null}

        {/* ── Contatto ── */}
        <div className="mt-10 px-4 pb-4">
          <p className="mb-3 text-xs text-[#6b5a4e]">
            Hai domande sui percorsi? Scrivici direttamente.
          </p>
          <button
            type="button"
            onClick={() => setContactModalOpen(true)}
            className="w-full rounded-full border border-[#2a1f1a] py-3 text-sm text-[#2a1f1a]"
          >
            Chiedi informazioni
          </button>
        </div>
      </section>

      {/* Quiz */}
      <div id="quiz">
        <ProgramsLevelQuiz quiz={localizedContent.quiz} />
      </div>

      {/* Workshop CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-12 pt-2 sm:px-6 md:pb-16 md:pt-4">
        <div className="rounded-[8px] border border-[#211815]/10 bg-white/34 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] md:flex md:items-center md:justify-between md:gap-5 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b5e4a]">
              {prog.workshopCtaEyebrow}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-[1.7] text-[#5f524c] md:text-base">
              {prog.workshopCtaText}
            </p>
          </div>
          <Link
            href="/workshop"
            className="mt-4 inline-flex rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/70 md:mt-0 md:shrink-0"
          >
            {prog.workshopCtaBtn}
          </Link>
        </div>
      </section>

      {contactModalOpen ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-[#211815]/45 px-4 py-5 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="relative w-full max-w-md rounded-[8px] border border-[#211815]/10 bg-[#f4efe8] p-5 shadow-[0_24px_80px_rgba(33,24,21,0.28)] md:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            <button
              type="button"
              aria-label="Chiudi"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-[#211815]/10 bg-[#f4efe8]/85 text-xl leading-none text-[#211815] transition hover:bg-white"
              onClick={closeModal}
            >
              ×
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">Percorsi</p>
            <h2 id="contact-modal-title" className="mt-2 font-serif text-3xl font-medium leading-[1.06]">
              Chiedi informazioni
            </h2>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-[#b07a5a]">
                  Nome o nickname
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Come ti chiami?"
                  className="w-full rounded-xl border border-[#c4a888] bg-white px-4 py-3 text-sm text-[#2a1f1a] outline-none focus:border-[#8b5e4a]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-[#b07a5a]">
                  Percorso
                </label>
                <select
                  value={contactProgram}
                  onChange={(e) => setContactProgram(e.target.value)}
                  className="w-full rounded-xl border border-[#c4a888] bg-white px-4 py-3 text-sm text-[#2a1f1a] outline-none focus:border-[#8b5e4a]"
                >
                  <option value="">Seleziona un percorso...</option>
                  <option value="Foundation 1">Foundation 1</option>
                  <option value="Foundation 2">Foundation 2</option>
                  <option value="Classe 1">Classe 1</option>
                  <option value="Classe 1+">Classe 1+</option>
                  <option value="Pratica Assistita">Pratica Assistita</option>
                  <option value="Classi Tematiche">Classi Tematiche</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-[#b07a5a]">
                  Note o domande
                </label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Scrivi qui le tue domande o note..."
                  rows={4}
                  className="w-full rounded-xl border border-[#c4a888] bg-white px-4 py-3 text-sm text-[#2a1f1a] outline-none focus:border-[#8b5e4a]"
                />
              </div>
            </div>
            <a
              href={`mailto:peony.studio.turin@gmail.com?subject=${encodeURIComponent(`Informazioni percorso: ${contactProgram}`)}&body=${encodeURIComponent(`Ciao,\n\nMi chiamo ${contactName}.\n\nPercorso di interesse: ${contactProgram}\n\n${contactMessage}\n\nGrazie`)}`}
              onClick={closeModal}
              className="mt-5 inline-flex w-full justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5"
            >
              Invia email →
            </a>
          </div>
        </div>
      ) : null}
    </main>
  );
}

// ── Parallel detail panel ────────────────────────────────────────────────────

function ParallelDetailPanel({
  item,
  label,
  description,
  matchedEvents,
  prog,
}: {
  item: ParallelPracticeItem;
  label: string;
  description: string;
  matchedEvents: PeonyEvent[];
  prog: {
    inParallelToPath: string;
    whatWeWork: string;
    forWhom: string;
    detailsLink: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      id="parallel-detail"
      className="programs-panel-in mt-3 rounded-[8px] border border-[#211815]/10 bg-white/42 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:grid md:grid-cols-[0.7fr_1.3fr] md:items-start md:gap-5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b5e4a]">
        {prog.inParallelToPath}
      </p>
      <div>
        <h3 className="mt-2 font-serif text-2xl font-medium leading-[1.08] tracking-normal text-[#211815]">
          {label}
        </h3>
        <p className="mt-2 text-sm leading-[1.65] text-[#5f524c] md:mt-1">
          {description}
        </p>
        {matchedEvents.length > 0 ? (
          <div className="mt-4 rounded-[10px] border border-[#211815]/10 bg-[#f4efe8]/50 p-4">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-[#8b5e4a]">
              Prossime date
            </p>
            <div className="flex flex-col gap-2">
              {matchedEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="flex items-center justify-between">
                  <span className="text-sm text-[#211815]">
                    {event.dateLabel ?? event.date}
                    {event.timeLabel ? ` · ${event.timeLabel}` : ""}
                  </span>
                  {event.bookingUrl ? (
                    <a
                      href={event.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-[#211815] px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Prenota
                    </a>
                  ) : (
                    <span className="rounded-full border border-[#211815]/20 px-3 py-1.5 text-xs text-[#6b5c52]">
                      In programma
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#6b5c52]">
            Nessuna data in programma al momento.
          </p>
        )}
        <div className="mt-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 border-b border-[#8b5e4a]/35 pb-0.5 text-sm font-medium text-[#8b5e4a] transition hover:border-[#8b5e4a]"
            onClick={() => setExpanded((v) => !v)}
          >
            {prog.detailsLink} {expanded ? "↑" : "↓"}
          </button>
        </div>
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">
            <div className="grid gap-3 pt-3">
              <InfoBlock title={prog.whatWeWork} items={item.tags} />
              <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  {prog.forWhom}
                </h3>
                <p className="mt-3 text-sm leading-[1.65] text-[#5f524c]">{item.subtitle}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Parallel bar ──────────────────────────────────────────────────────────────

const PARALLELO_KEYS: ("pratica" | "tematica")[] = ["pratica", "tematica"];

function ParallelBar({
  items,
  activeIndex,
  prog,
  percorsoEvents,
  onToggle,
}: {
  items: ParallelPracticeItem[];
  activeIndex: number | null;
  prog: {
    inParallel: string;
    inParallelToPath: string;
    parallelPracticeLabel: string;
    parallelClassiLabel: string;
    parallelPracticeDesc: string;
    parallelClassiDesc: string;
    whatWeWork: string;
    forWhom: string;
    detailsLink: string;
  };
  percorsoEvents: PeonyEvent[];
  onToggle: (index: number) => void;
}) {
  const activeItem = activeIndex === null ? null : items[activeIndex];
  const descriptions = [prog.parallelPracticeDesc, prog.parallelClassiDesc];
  const labels = [prog.parallelPracticeLabel, prog.parallelClassiLabel];
  const parallelKey = activeIndex !== null ? (PARALLELO_KEYS[activeIndex] ?? "pratica") : "pratica";
  const matchedParallelEvents = activeIndex !== null ? matchParallelo(percorsoEvents, parallelKey) : [];

  return (
    <div className="mx-auto mb-2 max-w-5xl">
      <div className="relative rounded-[8px] border border-[#211815]/10 bg-white/30 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
        <div aria-hidden="true" className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-[#8b5e4a]/15" />
        <div className="relative flex items-center gap-1">
          <span className="shrink-0 px-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8b5e4a]/75 md:text-[11px] md:tracking-[0.16em]">
            {prog.inParallel}:
          </span>
          {items.map((item, index) => {
            const active = activeIndex === index;
            const label = labels[index] ?? item.title;
            return (
              <button
                key={item.title}
                type="button"
                aria-expanded={active}
                aria-controls="parallel-detail"
                onClick={() => onToggle(index)}
                className={`grid min-h-10 flex-1 place-items-center rounded-[7px] border px-2 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4efe8] md:min-h-11 md:text-[11px] md:tracking-[0.14em] ${
                  active
                    ? "border-[#8b5e4a]/55 bg-white/78 text-[#211815] shadow-[0_8px_20px_rgba(33,24,21,0.08)]"
                    : "border-transparent bg-[#f4efe8]/45 text-[#5f524c] active:bg-white/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${activeItem ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {activeItem ? (
            <ParallelDetailPanel
              key={activeIndex ?? -1}
              item={activeItem}
              label={labels[activeIndex ?? 0] ?? activeItem.title}
              description={descriptions[activeIndex ?? 0] ?? ""}
              matchedEvents={matchedParallelEvents}
              prog={prog}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Program detail (inline) ───────────────────────────────────────────────────

function ProgramDetail({
  step,
  prog,
  matchedEvents,
}: {
  step: ProgramStep;
  prog: {
    selectedProgram: string;
    whatWeWork: string;
    forWhom: string;
    detailsLink: string;
  };
  matchedEvents: PeonyEvent[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="programs-panel-in mx-auto max-w-5xl rounded-[14px] border border-[#211815]/10 bg-white/42 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:p-6">
      <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:gap-6">
        {/* Left: always-visible info */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {prog.selectedProgram}
          </p>
          <h2 className="mt-3 font-serif text-[38px] font-medium leading-[1.02] tracking-normal text-[#211815] md:text-6xl">
            {step.title}
          </h2>
          <p className="mt-3 text-sm font-semibold leading-5 text-[#8b5e4a] md:text-base">
            {step.subtitle}
          </p>
          <p className="mt-4 text-sm leading-[1.7] text-[#5f524c] md:text-base">
            {step.description}
          </p>
          {matchedEvents.length > 0 ? (
            <div className="mt-4 rounded-[10px] border border-[#211815]/10 bg-[#f4efe8]/50 p-4">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-[#8b5e4a]">
                Prossime date
              </p>
              <div className="flex flex-col gap-2">
                {matchedEvents.slice(0, 4).map((event) => (
                  <div key={event.id} className="flex items-center justify-between">
                    <span className="text-sm text-[#211815]">
                      {event.dateLabel ?? event.date}
                      {event.timeLabel ? ` · ${event.timeLabel}` : ""}
                    </span>
                    {event.bookingUrl ? (
                      <a
                        href={event.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-[#211815] px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Prenota
                      </a>
                    ) : (
                      <span className="rounded-full border border-[#211815]/20 px-3 py-1.5 text-xs text-[#6b5c52]">
                        In programma
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#6b5c52]">
              Nessuna data in programma al momento.
            </p>
          )}
          <div className="mt-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 border-b border-[#8b5e4a]/35 pb-0.5 text-sm font-medium text-[#8b5e4a] transition hover:border-[#8b5e4a]"
              onClick={() => setExpanded((v) => !v)}
            >
              {prog.detailsLink} {expanded ? "↑" : "↓"}
            </button>
          </div>
        </div>

        {/* Right: expandable details */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="grid gap-3 md:pt-0 pt-2">
              <InfoBlock title={prog.whatWeWork} items={step.work} />
              <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  {prog.forWhom}
                </h3>
                <p className="mt-3 text-sm leading-[1.65] text-[#5f524c]">{step.audience}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
        {title}
      </h3>
      <ul className="mt-4 grid gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-[1.55] text-[#5f524c]">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8b5e4a]/55" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

