"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { HomeFooter } from "@/components/home/HomeFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  type QuizAnswerKey,
  type QuizResult,
  type SimpleCard,
  type SoftCta,
  type howToStartContent,
} from "@/content/how-to-start";
import { homeContent } from "@/content/home";

type HowToStartPageProps = {
  content: typeof howToStartContent;
};

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  intro?: string;
};

const answerKeys: QuizAnswerKey[] = ["A", "B", "C", "D"];

export function HowToStartPage({ content }: HowToStartPageProps) {
  const reduceMotion = useReducedMotion();
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
              {content.hero.eyebrow}
            </p>
            <h1 className="mt-4 max-w-2xl font-serif text-[clamp(42px,10vw,76px)] font-medium leading-[0.98] tracking-normal text-[#211815]">
              {content.hero.title}
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
              {content.hero.intro}
            </p>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <SoftActionButton
                label={content.hero.primaryCta.label}
                onClick={() => setQuizOpen(true)}
                variant="dark"
              />
              <SoftButton cta={content.hero.secondaryCta} variant="light" />
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
                Che Peony student sei?
              </p>
              <p className="mt-1 text-sm leading-[1.55] text-[#5f524c]">
                Quattro domande, un primo orientamento.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="quiz" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14 sm:px-6 md:py-20">
        <QuizTeaser quiz={content.quiz} onStart={() => setQuizOpen(true)} />
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-20">
        <SectionIntro
          eyebrow={content.entryPaths.eyebrow}
          title={content.entryPaths.title}
        />
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {content.entryPaths.cards.map((card, index) => (
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
              className="rounded-[8px] border border-[#211815]/10 bg-white/62 p-5 shadow-[0_2px_0_rgba(33,24,21,0.03)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 font-serif text-[26px] font-medium leading-[1.08] tracking-normal text-[#211815]">
                {card.title}
              </h3>
              <p className="mt-4 text-sm leading-[1.65] text-[#5f524c]">
                {card.text}
              </p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-20">
        <div className="grid gap-6 md:grid-cols-[0.85fr_1.15fr] md:items-end">
          <SectionIntro
            eyebrow={content.preview.eyebrow}
            title={content.preview.title}
            intro={content.preview.intro}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {content.preview.cards.map((card) => (
              <InfoCard key={card.title} card={card} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 md:py-28">
        <div className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/75 to-[#d6b89f]/35 px-6 py-12 md:px-10 md:py-16">
          <div className="max-w-3xl">
            <h2 className="font-serif text-3xl font-medium leading-[1.1] tracking-normal sm:text-4xl md:text-6xl">
              {content.finalCta.title}
            </h2>
            <p className="mt-5 text-base leading-[1.75] text-[#5f524c] md:text-lg">
              {content.finalCta.intro}
            </p>
            <div className="mt-8">
              <SoftButton cta={content.finalCta.cta} variant="dark" />
            </div>
          </div>
        </div>
      </section>

      <HomeFooter content={homeContent.footer} />

      {quizOpen ? (
        <QuizDialog quiz={content.quiz} onClose={() => setQuizOpen(false)} />
      ) : null}
    </main>
  );
}

function QuizTeaser({
  quiz,
  onStart,
}: {
  quiz: typeof howToStartContent.quiz;
  onStart: () => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-end">
      <SectionIntro eyebrow={quiz.eyebrow} title={quiz.title} intro={quiz.intro} />
      <article className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/75 to-[#efe4d7]/65 p-5 shadow-[0_14px_34px_rgba(33,24,21,0.08)] md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
          Orientamento leggero
        </p>
        <h3 className="mt-3 font-serif text-3xl font-medium leading-[1.08] tracking-normal text-[#211815] md:text-4xl">
          Apri il quiz in un riquadro dedicato.
        </h3>
        <p className="mt-4 max-w-xl text-sm leading-[1.65] text-[#5f524c]">
          La pagina resta libera: il quiz si apre solo quando vuoi e puoi chiuderlo o rifarlo in ogni momento.
        </p>
        <div className="mt-6">
          <SoftActionButton label="Fai il quiz" onClick={onStart} variant="dark" />
        </div>
      </article>
    </div>
  );
}

function QuizDialog({
  quiz,
  onClose,
}: {
  quiz: typeof howToStartContent.quiz;
  onClose: () => void;
}) {
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
              Quiz
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
            aria-label="Chiudi quiz"
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

function QuizBlock({ quiz }: { quiz: typeof howToStartContent.quiz }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<number, QuizAnswerKey>>>({});
  const question = quiz.questions[currentQuestion];
  const selectedAnswer = answers[currentQuestion];
  const completed = quiz.questions.every((_, index) => answers[index]);
  const result = useMemo(
    () => (completed ? getQuizResult(answers, quiz.results) : null),
    [answers, completed, quiz.results],
  );

  function chooseAnswer(key: QuizAnswerKey) {
    setAnswers((current) => ({ ...current, [currentQuestion]: key }));
  }

  function resetQuiz() {
    setCurrentQuestion(0);
    setAnswers({});
  }

  return (
    <div className="mt-8 grid gap-5 md:grid-cols-[1.05fr_0.95fr] md:items-start">
      <article className="rounded-[8px] border border-[#211815]/10 bg-white/65 p-5 shadow-[0_2px_0_rgba(33,24,21,0.03)] md:p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Domanda {currentQuestion + 1} / {quiz.questions.length}
          </p>
          <div className="flex gap-1.5" aria-hidden="true">
            {quiz.questions.map((item, index) => (
              <span
                key={item.question}
                className={`h-2 w-7 rounded-full transition ${
                  answers[index] ? "bg-[#8b5e4a]" : "bg-[#211815]/10"
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
            onClick={() => setCurrentQuestion((current) => Math.max(0, current - 1))}
            disabled={currentQuestion === 0}
            className="rounded-full border border-[#211815]/20 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Indietro
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentQuestion((current) =>
                Math.min(quiz.questions.length - 1, current + 1),
              )
            }
            disabled={!selectedAnswer || currentQuestion === quiz.questions.length - 1}
            className="rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(33,24,21,0.22)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Avanti
          </button>
        </div>
      </article>

      <aside
        aria-live="polite"
        className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/75 to-[#efe4d7]/65 p-5 shadow-[0_14px_34px_rgba(33,24,21,0.08)] md:sticky md:top-28 md:p-6"
      >
        {result ? (
          <QuizResultCard result={result} onReset={resetQuiz} />
        ) : (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              Il risultato appare qui
            </p>
            <h3 className="mt-3 font-serif text-3xl font-medium leading-[1.1] tracking-normal">
              Scegli una risposta per ogni domanda.
            </h3>
            <p className="mt-4 text-sm leading-[1.65] text-[#5f524c]">
              Non è un test definitivo: serve solo a orientare il primo passo.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function getQuizResult(
  answers: Partial<Record<number, QuizAnswerKey>>,
  results: Record<QuizAnswerKey, QuizResult>,
) {
  const counts = answerKeys.reduce(
    (total, key) => ({ ...total, [key]: 0 }),
    {} as Record<QuizAnswerKey, number>,
  );

  Object.values(answers).forEach((answer) => {
    if (answer) {
      counts[answer] += 1;
    }
  });

  const highest = Math.max(...Object.values(counts));
  const winners = answerKeys.filter((key) => counts[key] === highest);

  if (winners.length === 1) {
    return results[winners[0]];
  }

  const secondAnswer = answers[1];

  if (secondAnswer && winners.includes(secondAnswer)) {
    return results[secondAnswer];
  }

  return results.A;
}

function QuizResultCard({
  result,
  onReset,
}: {
  result: QuizResult;
  onReset: () => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
        Il tuo risultato
      </p>
      <h3 className="mt-3 font-serif text-4xl font-medium leading-[1.05] tracking-normal">
        {result.title}
      </h3>
      <p className="mt-4 text-[11px] font-semibold uppercase leading-5 tracking-[0.12em] text-[#8b5e4a]">
        Percorso consigliato · {result.path}
      </p>
      <p className="mt-4 text-sm leading-[1.7] text-[#5f524c]">{result.text}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <SoftButton cta={result.cta} variant="dark" />
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/75"
        >
          Rifai il quiz
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
    <article className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/70 to-[#efe4d7]/65 p-5 shadow-[0_2px_0_rgba(33,24,21,0.03)]">
      <h3 className="font-serif text-3xl font-medium leading-[1.1] tracking-normal">
        {card.title}
      </h3>
      <p className="mt-4 text-sm leading-[1.65] text-[#5f524c]">{card.text}</p>
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
