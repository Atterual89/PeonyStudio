"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProgramsLevelQuiz } from "@/components/programs/ProgramsLevelQuiz";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { ProgramStep, programsContent } from "@/content/programs";

type ProgramsProgressPageProps = {
  content: typeof programsContent;
};

const nodeLabels = ["Found. 1", "Found. 2", "Classe 1", "Classe 1+"];

export function ProgramsProgressPage({ content }: ProgramsProgressPageProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showFullPath, setShowFullPath] = useState(false);
  const [modalStep, setModalStep] = useState<ProgramStep | null>(null);
  const activeStep =
    activeIndex === null ? null : content.progression[activeIndex];
  const progressScale =
    activeIndex !== null && content.progression.length > 1
      ? activeIndex / (content.progression.length - 1)
      : 0;

  function toggleActiveIndex(index: number) {
    setActiveIndex((current) => (current === index ? null : index));
  }

  useEffect(() => {
    if (!modalStep) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalStep(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalStep]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="relative mx-auto max-w-6xl px-5 pb-8 pt-14 sm:px-6 md:pb-12 md:pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-120px] top-0 hidden h-72 w-[520px] opacity-45 md:block"
        >
          <svg viewBox="0 0 520 280" className="h-full w-full">
            <path
              d="M40 84 C128 8 244 176 334 70 C396 -3 494 38 458 118 C420 206 248 108 238 212 C232 272 360 254 434 208"
              fill="none"
              stroke="#8b5e4a"
              strokeLinecap="round"
              strokeWidth="10"
              opacity="0.12"
            />
            <path
              d="M42 84 C130 8 246 176 336 70 C398 -3 496 38 460 118 C422 206 250 108 240 212 C234 272 362 254 436 208"
              fill="none"
              stroke="#211815"
              strokeDasharray="2 16"
              strokeLinecap="round"
              strokeWidth="2"
              opacity="0.10"
            />
          </svg>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b5e4a]">
          {content.hero.eyebrow}
        </p>
        <h1 className="mt-5 max-w-3xl font-serif text-[clamp(48px,11vw,86px)] font-medium leading-[0.95] tracking-normal text-[#211815]">
          {content.hero.title}
        </h1>
        <p className="mt-6 max-w-2xl text-[16px] leading-[1.75] text-[#211815]/85 md:text-lg">
          {content.hero.intro}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-12 pt-4 sm:px-6 md:pb-20">
        <div className="relative px-1 pb-8 pt-12 md:px-2 md:pt-16">
          <div className="relative grid grid-cols-4 gap-1">
            <div
              aria-hidden="true"
              className="absolute left-[12.5%] right-[12.5%] top-[58px] h-[5px] rounded-full bg-[repeating-linear-gradient(105deg,rgba(139,94,74,0.22)_0_7px,rgba(33,24,21,0.08)_7px_13px)] shadow-[0_1px_0_rgba(255,255,255,0.65)] md:top-[72px]"
            />
            <div
              aria-hidden="true"
              className="programs-rope-interactive absolute left-[12.5%] right-[12.5%] top-[58px] h-[5px] origin-left rounded-full bg-gradient-to-r from-[#d4bda3]/25 via-[#b27a58]/55 to-[#8b5e4a]/55 md:top-[72px]"
              style={{ transform: `scaleX(${progressScale})` }}
            />

            {content.progression.map((step, index) => {
              const active = index === activeIndex;

              return (
                <button
                  key={step.title}
                  type="button"
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  onClick={() => toggleActiveIndex(index)}
                  className="group relative flex min-w-0 flex-col items-center gap-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
                >
                  <span
                    className={`font-serif text-[15px] font-medium leading-none tracking-normal text-[#211815] transition md:text-2xl ${
                      active ? "text-[#8b5e4a]" : ""
                    }`}
                  >
                    {nodeLabels[index]}
                  </span>
                  <span className="h-5 border-l border-dotted border-[#8b5e4a]/45" />
                  <span
                    className={`programs-knot relative z-10 grid h-9 w-9 place-items-center rounded-full border bg-[#f4efe8] transition duration-300 md:h-11 md:w-11 ${
                      active
                        ? "border-[#8b5e4a]/75 shadow-[0_0_0_8px_rgba(139,94,74,0.10)]"
                        : "border-[#8b5e4a]/28 shadow-[0_0_0_7px_rgba(244,239,232,0.74)] group-hover:border-[#8b5e4a]/55"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-5 w-5 rounded-full border bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.75),rgba(139,94,74,0.28)_42%,rgba(33,24,21,0.12))] transition md:h-6 md:w-6 ${
                        active ? "border-[#8b5e4a]/70" : "border-[#8b5e4a]/25"
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {!showFullPath ? (
          activeStep ? (
            <ProgramDetail step={activeStep} />
          ) : (
            <div className="programs-panel-in mx-auto mt-2 max-w-5xl rounded-[14px] border border-[#211815]/10 bg-white/32 px-5 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:px-8">
              <div
                aria-hidden="true"
                className="mx-auto mb-3 h-5 w-12 rounded-full border-t border-[#8b5e4a]/50"
              />
              <p className="font-serif text-lg leading-[1.5] text-[#211815] md:text-xl">
                Clicca su uno dei nodi per approfondire di cosa si tratta.
              </p>
            </div>
          )
        ) : null}

        <div className="mx-auto mt-8 max-w-xl">
          <button
            type="button"
            aria-expanded={showFullPath}
            onClick={() => setShowFullPath((current) => !current)}
            className="flex w-full items-center justify-between gap-4 rounded-full border border-[#8b5e4a]/45 bg-white/28 px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a] transition hover:bg-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
          >
            <span className="inline-flex items-center gap-3">
              <span aria-hidden="true" className="text-lg tracking-normal">
                ☷
              </span>
              {showFullPath
                ? "Nascondi il percorso completo"
                : "Scopri tutto il percorso"}
            </span>
            <span
              aria-hidden="true"
              className={`text-lg leading-none transition duration-300 ${
                showFullPath ? "rotate-180" : ""
              }`}
            >
              ˅
            </span>
          </button>

          <div
            className={`grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none ${
              showFullPath ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="mt-6 rounded-[12px] border border-[#211815]/10 bg-white/32 px-4 py-5 md:px-5 md:py-7">
                <FullPathTimeline
                  steps={content.progression}
                  onSelectStep={setModalStep}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#211815]/10 px-5 py-14 sm:px-6 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
            Attività trasversali
          </p>
          <h2 className="mt-3 max-w-3xl font-serif text-[36px] font-medium leading-[1.05] tracking-normal text-[#211815] md:text-5xl">
            Non tutto segue una linea.
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-[1.75] text-[#211815]/85 md:text-base">
            {content.parallelPractice.intro}
          </p>

          <div
            aria-hidden="true"
            className="programs-secondary-rope mt-10 h-8 rounded-t-[28px] border-x border-t border-[#8b5e4a]/28"
          />

          <div className="grid gap-5 md:grid-cols-2">
            {content.parallelPractice.items.map((item) => (
              <article
                key={item.title}
                className="relative overflow-hidden rounded-[14px] border border-[#211815]/10 bg-white/34 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:p-7"
              >
                <div
                  aria-hidden="true"
                  className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#d6b89f]/22 text-3xl text-[#8b5e4a]"
                >
                  ⌁
                </div>
                <h3 className="font-serif text-3xl font-medium leading-[1.08] tracking-normal text-[#211815] md:text-4xl">
                  {item.title}
                </h3>
                <p className="mt-3 text-[11px] font-semibold uppercase leading-5 tracking-[0.14em] text-[#8b5e4a]">
                  {item.subtitle}
                </p>
                <p className="mt-4 text-sm leading-[1.7] text-[#211815]/85">
                  {item.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/62 px-3 py-1.5 text-xs text-[#211815]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={item.cta.href}
                  className="mt-7 inline-flex border-b border-[#8b5e4a]/35 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a] transition hover:border-[#8b5e4a]"
                >
                  {item.cta.label} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProgramsLevelQuiz quiz={content.quiz} />

      {modalStep ? (
        <ProgramStepModal
          step={modalStep}
          onClose={() => setModalStep(null)}
        />
      ) : null}
    </main>
  );
}

function ProgramDetail({ step }: { step: ProgramStep }) {
  return (
    <article
      key={step.title}
      className="programs-panel-in mx-auto mt-2 max-w-5xl rounded-[14px] border border-[#211815]/10 bg-white/42 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:grid md:grid-cols-[0.9fr_1.1fr] md:gap-8 md:p-7"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
          Percorso selezionato
        </p>
        <h2 className="mt-3 font-serif text-[38px] font-medium leading-[1.02] tracking-normal text-[#211815] md:text-6xl">
          {step.title}
        </h2>
        <p className="mt-3 text-sm font-semibold leading-5 text-[#8b5e4a] md:text-base">
          {step.subtitle}
        </p>
        <p className="mt-5 text-sm leading-[1.75] text-[#5f524c] md:text-base">
          {step.description}
        </p>
        <Link
          href="/calendario"
          className="mt-6 inline-flex rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/70"
        >
          Vedi prossime date
        </Link>
      </div>

      <div className="mt-7 grid gap-4 md:mt-0">
        <InfoBlock title="Cosa si lavora" items={step.work} />
        <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Per chi è
          </h3>
          <p className="mt-3 text-sm leading-[1.65] text-[#5f524c]">
            {step.audience}
          </p>
        </div>
      </div>
    </article>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
        {title}
      </h3>
      <ul className="mt-4 grid gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-[1.55] text-[#5f524c]">
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8b5e4a]/55"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FullPathTimeline({
  steps,
  onSelectStep,
}: {
  steps: ProgramStep[];
  onSelectStep: (step: ProgramStep) => void;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute left-[13px] top-0 h-full w-px bg-[#211815]/10"
      />
      <div
        aria-hidden="true"
        className="programs-rope-fill absolute left-[13px] top-0 w-px bg-gradient-to-b from-[#8b5e4a]/15 via-[#8b5e4a]/42 to-[#8b5e4a]/18"
      />

      <div className="grid gap-5">
        {steps.map((step, index) => (
          <article key={step.title} className="relative pl-10">
            <span
              aria-hidden="true"
              className="programs-rope-node absolute left-[5px] top-1 grid h-4 w-4 place-items-center rounded-full border border-[#8b5e4a]/45 bg-[#f4efe8] shadow-[0_0_0_6px_rgba(244,239,232,0.86)]"
              style={{ animationDelay: `${180 + index * 120}ms` }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#8b5e4a]/55" />
            </span>
            <button
              type="button"
              onClick={() => onSelectStep(step)}
              className="block w-full rounded-[8px] border border-[#211815]/10 bg-white/52 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#8b5e4a]/35 hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 font-serif text-[26px] font-medium leading-[1.06] tracking-normal text-[#211815]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#8b5e4a]">
                {step.subtitle}
              </p>
              <p className="mt-3 text-sm leading-[1.65] text-[#5f524c]">
                {step.description}
              </p>
              <span className="mt-4 inline-flex border-b border-[#8b5e4a]/35 pb-1 text-sm font-medium text-[#8b5e4a]">
                Apri dettaglio
              </span>
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProgramStepModal({
  step,
  onClose,
}: {
  step: ProgramStep;
  onClose: () => void;
}) {
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[300] grid place-items-center bg-[#211815]/35 px-3 py-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-step-modal-title"
        className="programs-panel-in max-h-[calc(100dvh-32px)] w-full max-w-4xl overflow-y-auto rounded-[8px] border border-[#211815]/10 bg-[#f4efe8] p-4 shadow-[0_28px_80px_rgba(33,24,21,0.24)] md:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              Percorso
            </p>
            <h2
              id="program-step-modal-title"
              className="mt-2 font-serif text-3xl font-medium leading-[1.06] tracking-normal text-[#211815] md:text-5xl"
            >
              {step.title}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-5 text-[#8b5e4a]">
              {step.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi dettaglio"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#211815]/20 bg-white/70 text-lg text-[#211815] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
          >
            x
          </button>
        </div>

        <p className="text-sm leading-[1.75] text-[#5f524c] md:text-base">
          {step.description}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <InfoBlock title="Cosa si lavora" items={step.work} />
          <div className="rounded-[8px] border border-[#211815]/10 bg-white/55 p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              Per chi è
            </h3>
            <p className="mt-3 text-sm leading-[1.65] text-[#5f524c]">
              {step.audience}
            </p>
          </div>
        </div>

        <Link
          href="/calendario"
          className="mt-6 inline-flex rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5"
        >
          Vedi prossime date
        </Link>
      </div>
    </div>
  );
}
