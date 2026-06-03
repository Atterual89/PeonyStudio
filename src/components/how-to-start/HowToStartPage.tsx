"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { HomeFooter } from "@/components/home/HomeFooter";
import { useLanguage } from "@/components/site/LanguageProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  howToStartBilingual,
  type QuizAnswerKey,
  type QuizBranch,
  type QuizBranchKey,
  type QuizFirstQuestion,
  type QuizResult,
  type QuizResultKey,
  type SimpleCard,
  type SoftCta,
  type howToStartContent,
} from "@/content/how-to-start";
import { homeContent } from "@/content/home";

type HowToStartPageProps = {
  content: typeof howToStartContent;
};

type LocaleQuiz = {
  title: string;
  firstQuestion: QuizFirstQuestion;
  branches: Record<QuizBranchKey, QuizBranch>;
  results: Record<QuizResultKey, QuizResult>;
};

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  intro?: string;
};

export function HowToStartPage({ content }: HowToStartPageProps) {
  const reduceMotion = useReducedMotion();
  const { dictionary, locale } = useLanguage();
  const hts = dictionary.howToStart;
  const localizedContent = howToStartBilingual[locale] ?? howToStartBilingual.it;
  const [quizOpen, setQuizOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = quizOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [quizOpen]);

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="relative overflow-hidden px-5 pb-14 pt-16 sm:px-6 md:pb-20 md:pt-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(33,24,21,0.025)_1px,transparent_1px),linear-gradient(rgba(33,24,21,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_50%_22%,black_24%,transparent_82%)]"
        />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              {hts.heroEyebrow}
            </p>
            <h1 className="mt-4 max-w-2xl font-serif text-[clamp(42px,10vw,76px)] font-medium leading-[0.98] tracking-normal text-[#211815]">
              {hts.heroTitle}
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
              {hts.heroIntro}
            </p>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <SoftActionButton
                label={hts.heroPrimaryCtaLabel}
                onClick={() => setQuizOpen(true)}
                variant="dark"
              />
              <SoftButton
                cta={{ label: hts.heroSecondaryCtaLabel, href: content.hero.secondaryCta.href }}
                variant="light"
              />
            </div>
          </motion.div>

          <motion.div
            className="relative"
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="overflow-hidden rounded-[8px] border border-[#211815]/10 shadow-[0_24px_60px_rgba(33,24,21,0.12)]">
              <Image
                src="/images/home/entry-beginner.jpg"
                alt="Ingresso beginner Peony Studio"
                width={900}
                height={680}
                priority
                className="aspect-[4/3] w-full object-cover saturate-[0.92]"
              />
            </div>
            <div className="absolute -bottom-4 left-4 right-4 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/90 px-4 py-3 shadow-[0_10px_30px_rgba(33,24,21,0.10)] backdrop-blur md:left-auto md:w-72">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
                {hts.fewQuestions}
              </p>
              <p className="mt-1 text-sm leading-[1.55] text-[#5f524c]">
                {hts.oneStartingPoint}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 md:py-14">
        <SectionIntro
          eyebrow={hts.entryPathsEyebrow}
          title={hts.entryPathsTitle}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {localizedContent.entryPaths.cards.map((card, index) => (
            <motion.article
              key={card.title}
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.62,
                delay: index * 0.08,
                ease: [0.23, 1, 0.32, 1],
              }}
              className="rounded-[8px] border border-[#211815]/10 bg-white/55 p-4 shadow-[0_1px_0_rgba(33,24,21,0.03)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-lg font-semibold leading-tight text-[#211815]">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-[1.45] text-[#5f524c]">
                {card.text}
              </p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 md:py-14">
        <div className="grid gap-6 md:grid-cols-[0.85fr_1.15fr] md:items-end">
          <SectionIntro
            eyebrow={hts.previewEyebrow}
            title={hts.previewTitle}
            intro={hts.previewIntro}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {localizedContent.preview.cards.map((card) => (
              <InfoCard key={card.title} card={card} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 md:py-16">
        <div className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/75 to-[#d6b89f]/35 px-6 py-8 md:px-10 md:py-10">
          <div className="max-w-3xl">
            <h2 className="font-serif text-3xl font-medium leading-[1.1] tracking-normal sm:text-4xl md:text-5xl">
              {hts.finalCtaTitle}
            </h2>
            <div className="mt-5">
              <SoftButton
                cta={{ label: hts.finalCtaCtaLabel, href: content.finalCta.cta.href }}
                variant="dark"
              />
            </div>
          </div>
        </div>
      </section>

      <HomeFooter content={homeContent.footer} />

      {quizOpen ? (
        <QuizDialog quiz={localizedContent.quiz} onClose={() => setQuizOpen(false)} />
      ) : null}
    </main>
  );
}

function QuizDialog({
  quiz,
  onClose,
}: {
  quiz: LocaleQuiz;
  onClose: () => void;
}) {
  const { dictionary } = useLanguage();
  const hts = dictionary.howToStart;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] grid place-items-center bg-[#211815]/35 px-3 py-4 backdrop-blur-sm sm:px-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-dialog-title"
        className="max-h-[calc(100vh-32px)] w-full max-w-5xl overflow-y-auto rounded-[8px] border border-[#211815]/10 bg-[#f4efe8] p-4 shadow-[0_28px_80px_rgba(33,24,21,0.24)] sm:p-5 md:p-6"
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              {hts.quiz}
            </p>
            <h2
              id="quiz-dialog-title"
              className="mt-1 font-serif text-3xl font-medium leading-[1.08] tracking-normal text-[#211815] md:text-5xl"
            >
              {quiz.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={hts.closeQuiz}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#211815]/20 bg-white/70 text-lg text-[#211815] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
          >
            x
          </button>
        </div>
        <QuizBlock quiz={quiz} />
      </motion.div>
    </div>
  );
}

function QuizBlock({ quiz }: { quiz: LocaleQuiz }) {
  const { dictionary } = useLanguage();
  const hts = dictionary.howToStart;
  const [currentStep, setCurrentStep] = useState(0);
  const [firstAnswer, setFirstAnswer] = useState<QuizAnswerKey | null>(null);
  const [branch, setBranch] = useState<QuizBranchKey | null>(null);
  const [branchAnswers, setBranchAnswers] = useState<
    Partial<Record<number, QuizAnswerKey>>
  >({});
  const branchQuestions = branch ? quiz.branches[branch].questions : [];
  const totalQuestions = 1 + branchQuestions.length;
  const question =
    currentStep === 0 ? quiz.firstQuestion : branchQuestions[currentStep - 1];
  const selectedAnswer =
    currentStep === 0 ? firstAnswer : branchAnswers[currentStep - 1];
  const completed =
    Boolean(branch) &&
    branchQuestions.length > 0 &&
    branchQuestions.every((_, index) => branchAnswers[index]);
  const result = useMemo(
    () =>
      completed && branch
        ? getQuizResult(branch, branchAnswers, quiz.results)
        : null,
    [branch, branchAnswers, completed, quiz.results],
  );

  function chooseAnswer(key: QuizAnswerKey) {
    if (currentStep === 0) {
      const nextBranch = quiz.firstQuestion.answers.find(
        (answer) => answer.key === key,
      )?.branch;

      setFirstAnswer(key);

      if (nextBranch && nextBranch !== branch) {
        setBranch(nextBranch);
        setBranchAnswers({});
      }

      return;
    }

    setBranchAnswers((current) => ({ ...current, [currentStep - 1]: key }));
  }

  function resetQuiz() {
    setCurrentStep(0);
    setFirstAnswer(null);
    setBranch(null);
    setBranchAnswers({});
  }

  if (result) {
    return (
      <div className="mx-auto mt-8 max-w-3xl">
        <article
          aria-live="polite"
          className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/75 to-[#efe4d7]/65 p-5 shadow-[0_14px_34px_rgba(33,24,21,0.08)] md:p-6"
        >
          <QuizResultCard result={result} onReset={resetQuiz} />
        </article>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-3xl">
      <article className="rounded-[8px] border border-[#211815]/10 bg-white/65 p-5 shadow-[0_2px_0_rgba(33,24,21,0.03)] md:p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {hts.question} {currentStep + 1} / {totalQuestions}
          </p>
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: totalQuestions }).map((_, index) => (
              <span
                key={index}
                className={`h-2 w-7 rounded-full transition ${
                  index === 0
                    ? firstAnswer
                      ? "bg-[#8b5e4a]"
                      : "bg-[#211815]/10"
                    : branchAnswers[index - 1]
                      ? "bg-[#8b5e4a]"
                      : "bg-[#211815]/10"
                }`}
              />
            ))}
          </div>
        </div>

        <h2 className="mt-5 font-serif text-[30px] font-medium leading-[1.1] tracking-normal text-[#211815] md:text-4xl">
          {question.question}
        </h2>

        <div className="mt-6 grid gap-3">
          {question.answers.map((answer) => {
            const selected = selectedAnswer === answer.key;

            return (
              <button
                key={answer.key}
                type="button"
                aria-pressed={selected}
                onClick={() => chooseAnswer(answer.key)}
                className={`flex w-full items-start gap-3 rounded-[8px] border p-4 text-left transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8] ${
                  selected
                    ? "border-[#8b5e4a] bg-[#f4efe8] shadow-[0_10px_26px_rgba(33,24,21,0.08)]"
                    : "border-[#211815]/10 bg-[#f4efe8]/55 hover:border-[#8b5e4a]/35 hover:bg-white/80"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    selected
                      ? "bg-[#211815] text-[#f4efe8]"
                      : "border border-[#211815]/15 text-[#8b5e4a]"
                  }`}
                >
                  {answer.key}
                </span>
                <span className="pt-0.5 text-sm leading-[1.6] text-[#5f524c]">
                  {answer.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep((current) => Math.max(0, current - 1))}
            disabled={currentStep === 0}
            className="rounded-full border border-[#211815]/20 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {hts.back}
          </button>
          <button
            type="button"
            onClick={() => {
              if (currentStep < totalQuestions - 1) {
                setCurrentStep((current) => current + 1);
              }
            }}
            disabled={!selectedAnswer || currentStep === totalQuestions - 1}
            className="rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(33,24,21,0.22)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {hts.next}
          </button>
        </div>
      </article>
    </div>
  );
}

function getQuizResult(
  branch: QuizBranchKey,
  answers: Partial<Record<number, QuizAnswerKey>>,
  results: Record<QuizResultKey, QuizResult>,
) {
  const q2 = answers[0];
  const q3 = answers[1];
  const q4 = answers[2];

  if (branch === "explorer") {
    return results.EXPLORER;
  }

  if (branch === "rigger") {
    if (q2 === "D" || q3 === "D") {
      return results.ROPE_RESEARCH;
    }

    if (q2 === "C" && q3 === "C") {
      return results.RIGGER_PRACTICE;
    }

    if (q2 === "A" || q2 === "B" || q3 === "A" || q3 === "B") {
      return results.RIGGER_FOUNDATION;
    }

    return results.RIGGER_FOUNDATION;
  }

  if (branch === "bottom") {
    if (q2 === "D" || q3 === "D") {
      return results.BOTTOM_RESEARCH;
    }

    if (q2 === "A" || q3 === "A" || q4 === "A") {
      return results.BOTTOM_EXPLORER;
    }

    if (q2 === "B" || q2 === "C" || q3 === "B" || q3 === "C") {
      return results.BOTTOM_PRACTICE;
    }

    return results.BOTTOM_EXPLORER;
  }

  if (q2 === "D" || q3 === "D") {
    return results.MIXED_RESEARCH;
  }

  if (q2 === "A" || q3 === "A") {
    return results.EXPLORER;
  }

  if (q3 === "B") {
    return results.RIGGER_FOUNDATION;
  }

  if (q3 === "C") {
    return results.RIGGER_PRACTICE;
  }

  return results.EXPLORER;
}

function QuizResultCard({
  result,
  onReset,
}: {
  result: QuizResult;
  onReset: () => void;
}) {
  const { dictionary } = useLanguage();
  const hts = dictionary.howToStart;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
        {hts.yourResult}
      </p>
      <h3 className="mt-3 font-serif text-4xl font-medium leading-[1.05] tracking-normal">
        {result.title}
      </h3>
      <p className="mt-4 text-[11px] font-semibold uppercase leading-5 tracking-[0.12em] text-[#8b5e4a]">
        {hts.recommendedPath} · {result.path}
      </p>
      <p className="mt-4 text-sm leading-[1.7] text-[#5f524c]">{result.text}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <SoftButton cta={result.cta} variant="dark" />
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/75"
        >
          {hts.retakeQuiz}
        </button>
      </div>
    </div>
  );
}

function SectionIntro({ eyebrow, title, intro }: SectionIntroProps) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-[32px] font-medium leading-[1.1] tracking-normal text-[#211815] md:text-5xl">
        {title}
      </h2>
      {intro ? (
        <p className="mt-4 text-sm leading-[1.7] text-[#5f524c] md:text-base">
          {intro}
        </p>
      ) : null}
    </div>
  );
}

function InfoCard({ card }: { card: SimpleCard }) {
  return (
    <article className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/70 to-[#efe4d7]/65 p-4 shadow-[0_1px_0_rgba(33,24,21,0.03)] md:p-5">
      <h3 className="font-serif text-2xl font-medium leading-[1.1] tracking-normal md:text-3xl">
        {card.title}
      </h3>
      <p className="mt-3 text-sm leading-[1.55] text-[#5f524c]">{card.text}</p>
      {card.cta ? (
        <Link
          href={card.cta.href}
          className="mt-5 inline-flex border-b border-[#8b5e4a]/35 pb-1 text-sm font-medium text-[#8b5e4a] transition hover:border-[#8b5e4a]"
        >
          {card.cta.label} →
        </Link>
      ) : null}
    </article>
  );
}

function SoftButton({ cta, variant }: { cta: SoftCta; variant: "dark" | "light" }) {
  const className =
    variant === "dark"
      ? "inline-flex justify-center rounded-full bg-[#211815] px-6 py-3.5 text-sm font-medium text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(33,24,21,0.22)]"
      : "inline-flex justify-center rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-6 py-3.5 text-sm font-medium text-[#211815] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/65";

  return (
    <Link href={cta.href} className={className}>
      {cta.label}
    </Link>
  );
}

function SoftActionButton({
  label,
  onClick,
  variant,
}: {
  label: string;
  onClick: () => void;
  variant: "dark" | "light";
}) {
  const className =
    variant === "dark"
      ? "inline-flex justify-center rounded-full bg-[#211815] px-6 py-3.5 text-sm font-medium text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(33,24,21,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
      : "inline-flex justify-center rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-6 py-3.5 text-sm font-medium text-[#211815] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]";

  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}
