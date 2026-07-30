"use client";

import { BookOpen, ChevronDown, Eye, Ribbon, Sprout, User, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
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

  function scrollItemIntoView(index: number) {
    requestAnimationFrame(() => {
      itemRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function toggleActiveIndex(index: number) {
    const next = activeIndex === index ? null : index;
    setActiveIndex(next);
    setActiveParallelIndex(null);
    if (next !== null) scrollItemIntoView(next);
  }

  function closeActiveIndex() {
    setActiveIndex(null);
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

      {/* Intro map — overview of the structured path + parallel activities */}
      <IntroMap
        prog={prog}
        progression={localizedContent.progression}
        parallelLabels={[prog.parallelPracticeLabel, prog.parallelClassiLabel]}
      />

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

      {/* Levels — vertical expandable list */}
      <section id="percorso-livelli" className="scroll-mt-24 mx-auto max-w-6xl px-5 pb-8 pt-0 sm:px-6 md:pb-12">
        {activeIndex === null && activeParallelIndex === null ? (
          <p className="pb-3 text-center text-[11px] text-[#5f524c]/50 md:text-xs">
            {prog.clickNodeInstruction.split("◎").map((part, i) =>
              i === 0 ? (
                <span key={i}>{part}<span aria-hidden="true" className="inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#8b5e4a]/45 align-middle"><span className="h-[5px] w-[5px] rounded-full border border-[#8b5e4a]/35" /></span></span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        ) : null}

        <div className="relative mx-auto max-w-3xl">
          {/* Rope connecting the numbered nodes */}
          <div
            aria-hidden="true"
            className="absolute left-[22px] top-6 bottom-6 w-[2px] rounded-full bg-[#8b5e4a]/25 md:left-[26px]"
          />
          <ul className="relative flex flex-col gap-3">
            {localizedContent.progression.map((step, index) => {
              const active = index === activeIndex;
              return (
                <LevelCard
                  key={step.title}
                  step={step}
                  index={index}
                  active={active}
                  prog={prog}
                  matchedEvents={matchPercorso(percorsoEvents, index)}
                  onToggle={() => toggleActiveIndex(index)}
                  onClose={closeActiveIndex}
                  itemRef={(el) => {
                    itemRefs.current[index] = el;
                  }}
                />
              );
            })}
          </ul>
        </div>

        {/* ── Contatto ── */}
        <div className="mt-10 px-4 pb-4">
          <p className="mb-3 text-xs text-[#6b5a4e]">
            {prog.contactQuestion}
          </p>
          <button
            type="button"
            onClick={() => setContactModalOpen(true)}
            className="w-full rounded-full border border-[#2a1f1a] py-3 text-sm text-[#2a1f1a]"
          >
            {prog.askForInfo}
          </button>
        </div>
      </section>

      {/* Parallel activities — prominent block after the full path list */}
      <section id="in-parallelo" className="scroll-mt-24 mx-auto max-w-6xl px-5 pb-5 sm:px-6">
        <ParallelBlock
          intro={localizedContent.parallelPractice.intro}
          items={localizedContent.parallelPractice.items}
          activeIndex={activeParallelIndex}
          prog={prog}
          percorsoEvents={percorsoEvents}
          onToggle={(index) => {
            setActiveParallelIndex((current) => (current === index ? null : index));
            setActiveIndex(null);
          }}
        />
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
              aria-label={prog.contactClose}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-[#211815]/10 bg-[#f4efe8]/85 text-xl leading-none text-[#211815] transition hover:bg-white"
              onClick={closeModal}
            >
              ×
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">{prog.program}</p>
            <h2 id="contact-modal-title" className="mt-2 font-serif text-3xl font-medium leading-[1.06]">
              {prog.askForInfo}
            </h2>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-[#b07a5a]">
                  {prog.contactLabelName}
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder={prog.namePlaceholder}
                  className="w-full rounded-xl border border-[#c4a888] bg-white px-4 py-3 text-sm text-[#2a1f1a] outline-none focus:border-[#8b5e4a]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-[#b07a5a]">
                  {prog.contactLabelProgram}
                </label>
                <select
                  value={contactProgram}
                  onChange={(e) => setContactProgram(e.target.value)}
                  className="w-full rounded-xl border border-[#c4a888] bg-white px-4 py-3 text-sm text-[#2a1f1a] outline-none focus:border-[#8b5e4a]"
                >
                  <option value="">{prog.contactSelectDefault}</option>
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
                  {prog.contactLabelMessage}
                </label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder={prog.messagePlaceholder}
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
              {prog.sendEmail}
            </a>
          </div>
        </div>
      ) : null}
    </main>
  );
}

// ── Intro map — compact overview + navigation ─────────────────────────────────

function IntroMap({
  prog,
  progression,
  parallelLabels,
}: {
  prog: {
    mapEyebrow: string;
    mapIntro: string;
    mapStructuredPathLabel: string;
    mapParallelLabel: string;
  };
  progression: ProgramStep[];
  parallelLabels: string[];
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-5 pt-1 sm:px-6">
      <div className="rounded-[14px] border border-[#211815]/10 bg-white/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
          {prog.mapEyebrow}
        </p>
        <p className="mt-2 text-sm leading-[1.6] text-[#5f524c] md:text-base">
          {prog.mapIntro}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.3fr_1fr]">
          {/* Structured path */}
          <a
            href="#percorso-livelli"
            className="group rounded-[10px] border border-[#211815]/10 bg-[#f4efe8]/50 p-3 transition hover:border-[#8b5e4a]/45 hover:bg-white/60"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]/80">
              {prog.mapStructuredPathLabel}
            </p>
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {progression.map((step, index) => (
                <span key={step.title} className="flex shrink-0 items-center gap-1.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-[#8b5e4a]/45 bg-[#f4efe8] text-[11px] font-semibold text-[#8b5e4a] transition group-hover:border-[#8b5e4a]">
                    {index + 1}
                  </span>
                  {index < progression.length - 1 ? (
                    <span aria-hidden="true" className="h-[2px] w-4 shrink-0 rounded-full bg-[#8b5e4a]/25 md:w-6" />
                  ) : null}
                </span>
              ))}
            </div>
            <p className="mt-2 truncate text-xs text-[#5f524c]/80">
              {progression.map((step) => step.title).join(" · ")}
            </p>
          </a>

          {/* Parallel activities */}
          <a
            href="#in-parallelo"
            className="group rounded-[10px] border border-[#8b5e4a]/25 bg-[#8b5e4a]/[0.06] p-3 transition hover:border-[#8b5e4a]/50 hover:bg-[#8b5e4a]/[0.1]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]/80">
              {prog.mapParallelLabel}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parallelLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[#8b5e4a]/30 bg-white/50 px-2.5 py-1 text-[11px] font-semibold text-[#5f524c] transition group-hover:border-[#8b5e4a]/50"
                >
                  {label}
                </span>
              ))}
            </div>
          </a>
        </div>
      </div>
    </section>
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

function ParallelBlock({
  intro,
  items,
  activeIndex,
  prog,
  percorsoEvents,
  onToggle,
}: {
  intro: string;
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
    <div className="rounded-[14px] border border-[#8b5e4a]/25 bg-[#8b5e4a]/[0.07] p-4 md:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
        {prog.inParallel}
      </p>
      <p className="mt-2 text-sm leading-[1.6] text-[#5f524c] md:text-base">{intro}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
              className={`rounded-[10px] border px-4 py-3 text-left text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4efe8] ${
                active
                  ? "border-[#8b5e4a] bg-white/80 text-[#211815] shadow-[0_8px_20px_rgba(33,24,21,0.08)]"
                  : "border-[#8b5e4a]/25 bg-white/40 text-[#5f524c] hover:border-[#8b5e4a]/45 hover:bg-white/60"
              }`}
            >
              {label}
            </button>
          );
        })}
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

// ── Level card (vertical list, inline expand) ─────────────────────────────────

function LevelCard({
  step,
  index,
  active,
  prog,
  matchedEvents,
  onToggle,
  onClose,
  itemRef,
}: {
  step: ProgramStep;
  index: number;
  active: boolean;
  prog: {
    whatWeWork: string;
    forWhom: string;
    detailsLink: string;
    closeDetail: string;
  };
  matchedEvents: PeonyEvent[];
  onToggle: () => void;
  onClose: () => void;
  itemRef: (el: HTMLLIElement | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!active) setExpanded(false);
  }, [active]);

  return (
    <li ref={itemRef} className="scroll-mt-24">
      <div
        className={`relative rounded-[14px] border transition-colors duration-200 ${
          active
            ? "border-[#8b5e4a] bg-white/55 shadow-[0_10px_30px_rgba(33,24,21,0.08)]"
            : "border-[#211815]/10 bg-white/25"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={active}
          className="flex w-full items-center gap-3 rounded-[14px] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4efe8]"
        >
          <span
            className={`programs-knot relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 bg-[#f4efe8] transition duration-300 ${
              active ? "border-[#8b5e4a] shadow-[0_0_0_6px_rgba(139,94,74,0.12)]" : "border-[#8b5e4a]/30"
            }`}
          >
            <span
              aria-hidden="true"
              className={`text-[13px] font-semibold leading-none ${active ? "text-[#8b5e4a]" : "text-[#8b5e4a]/50"}`}
            >
              {index + 1}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block font-serif text-lg leading-tight ${active ? "text-[#211815]" : "text-[#211815]/85"}`}>
              {step.title}
            </span>
            <span className="block text-xs text-[#5f524c]/75">{step.subtitle}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            size={18}
            className={`shrink-0 text-[#8b5e4a] transition-transform duration-200 ${active ? "rotate-180" : ""}`}
          />
        </button>

        {active ? (
          <div className="programs-panel-in relative border-t border-[#211815]/10 px-4 pb-4 pt-4 md:px-5">
            <button
              type="button"
              onClick={onClose}
              aria-label={prog.closeDetail}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-[#211815]/10 bg-[#f4efe8]/80 text-base leading-none text-[#211815] transition hover:bg-white"
            >
              ×
            </button>
            <p className="pr-10 text-sm leading-[1.7] text-[#5f524c] md:text-base">
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
                aria-expanded={expanded}
                className="inline-flex items-center gap-1 border-b border-[#8b5e4a]/35 pb-0.5 text-sm font-medium text-[#8b5e4a] transition hover:border-[#8b5e4a]"
                onClick={() => setExpanded((v) => !v)}
              >
                {prog.detailsLink} {expanded ? "↑" : "↓"}
              </button>
            </div>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="grid gap-3 pt-3">
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
        ) : null}
      </div>
    </li>
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

