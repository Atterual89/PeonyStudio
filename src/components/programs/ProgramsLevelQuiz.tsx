"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";

import type {
  ProgramQuizAnswer,
  ProgramQuizResultKey,
  programsContent,
} from "@/content/programs";

type ProgramsLevelQuizProps = {
  quiz: typeof programsContent.quiz;
};

const resultOrder: ProgramQuizResultKey[] = [
  "foundation1",
  "foundation2",
  "classe1",
  "classe1plus",
];

type SelectedQuizAnswer = {
  result: ProgramQuizResultKey;
  answerIndex: number;
};

export function ProgramsLevelQuiz({ quiz }: ProgramsLevelQuizProps) {
  const [open, setOpen] = useState(false);
  const { dictionary } = useLanguage();
  const prog = dictionary.programs;

  return (
    <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 md:py-10">
      <div className="relative overflow-hidden rounded-[14px] border border-[#211815]/10 bg-white/36 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:grid md:grid-cols-[1fr_0.72fr] md:items-center md:gap-6 md:p-6">
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {prog.quizEyebrow}
          </p>
          <h2 className="mt-2 font-serif text-[31px] font-medium leading-[1.08] tracking-normal text-[#211815] md:text-4xl">
            {prog.quizTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-[1.65] text-[#5f524c] md:text-base">
            {prog.quizDescription}
          </p>
        </div>
        <div className="relative mt-5 flex flex-col gap-3 sm:flex-row md:mt-0 md:justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex justify-center rounded-full bg-[#211815] px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(33,24,21,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
          >
            {prog.quizCta}
          </button>
        </div>
      </div>

      {open ? <QuizModal quiz={quiz} prog={prog} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

type ProgQuizDict = {
  quizCloseAria: string;
  quizResultEyebrow: string;
  quizResultDisclaimer: string;
  quizViewDates: string;
  quizRetake: string;
  quizClose: string;
  quizQuestion: string;
  quizOf: string;
  quizBack: string;
  quizNext: string;
  quizShowResult: string;
};

function QuizModal({
  quiz,
  prog,
  onClose,
}: {
  quiz: typeof programsContent.quiz;
  prog: ProgQuizDict;
  onClose: () => void;
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<
    Partial<Record<number, SelectedQuizAnswer>>
  >({});
  const completed = quiz.questions.every((_, index) => answers[index]);
  const resultKey = useMemo(
    () => (completed && showResult ? getQuizResult(answers) : null),
    [answers, completed, showResult],
  );
  const result = resultKey ? quiz.results[resultKey] : null;
  const question = quiz.questions[currentQuestion];
  const selectedAnswer = answers[currentQuestion];
  const progress = showResult
    ? 100
    : (Object.keys(answers).length / quiz.questions.length) * 100;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function chooseAnswer(answer: ProgramQuizAnswer, answerIndex: number) {
    setAnswers((current) => ({
      ...current,
      [currentQuestion]: {
        result: answer.result,
        answerIndex,
      },
    }));
    setShowResult(false);
  }

  function resetQuiz() {
    setCurrentQuestion(0);
    setShowResult(false);
    setAnswers({});
  }

  function goNext() {
    if (currentQuestion === quiz.questions.length - 1) {
      setShowResult(true);
      return;
    }

    setCurrentQuestion((current) =>
      Math.min(quiz.questions.length - 1, current + 1),
    );
  }

  function goBack() {
    setCurrentQuestion((current) => Math.max(0, current - 1));
  }

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
        aria-labelledby="program-quiz-title"
        className="programs-panel-in max-h-[calc(100dvh-32px)] w-full max-w-4xl overflow-y-auto rounded-[8px] border border-[#211815]/10 bg-[#f4efe8] p-4 shadow-[0_28px_80px_rgba(33,24,21,0.24)] md:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              Quiz
            </p>
            <h2
              id="program-quiz-title"
              className="mt-2 font-serif text-3xl font-medium leading-[1.06] tracking-normal text-[#211815] md:text-5xl"
            >
              {quiz.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={prog.quizCloseAria}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#211815]/20 bg-white/70 text-lg text-[#211815] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
          >
            x
          </button>
        </div>

        <div className="mb-5 h-px overflow-hidden rounded-full bg-[#211815]/10">
          <div
            className="h-full bg-gradient-to-r from-[#8b5e4a]/35 to-[#d6b89f]/55 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        {result ? (
          <div aria-live="polite" className="programs-panel-in">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              {prog.quizResultEyebrow}
            </p>
            <h3 className="mt-3 font-serif text-3xl font-medium leading-[1.08] tracking-normal text-[#211815] md:text-4xl">
              {result.title}
            </h3>
            <p className="mt-4 text-sm leading-[1.7] text-[#5f524c]">
              {result.text}
            </p>
            <p className="mt-4 text-sm leading-[1.6] text-[#5f524c]">
              {prog.quizResultDisclaimer}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/calendario"
                className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(33,24,21,0.22)]"
              >
                {prog.quizViewDates}
              </Link>
              <button
                type="button"
                onClick={resetQuiz}
                className="inline-flex justify-center rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
              >
                {prog.quizRetake}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex justify-center rounded-full border border-[#211815]/20 bg-white/55 px-5 py-3 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8]"
              >
                {prog.quizClose}
              </button>
            </div>
          </div>
        ) : (
          <div key={question.question} className="programs-panel-in">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              {prog.quizQuestion} {currentQuestion + 1} {prog.quizOf} {quiz.questions.length}
            </p>
            <h3 className="mt-3 font-serif text-[30px] font-medium leading-[1.08] tracking-normal text-[#211815] md:text-4xl">
              {question.question}
            </h3>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {question.answers.map((answer, index) => {
                const selected = selectedAnswer?.answerIndex === index;

                return (
                  <button
                    key={answer.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseAnswer(answer, index)}
                    className={`group rounded-[8px] border p-4 text-left transition duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4efe8] ${
                      selected
                        ? "border-[#8b5e4a]/60 bg-white/82 shadow-[0_10px_26px_rgba(33,24,21,0.08)]"
                        : "border-[#211815]/10 bg-[#f4efe8]/62 hover:border-[#8b5e4a]/35 hover:bg-white/70"
                    }`}
                  >
                    <span
                      className={`mb-3 grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition ${
                        selected
                          ? "border-[#211815] bg-[#211815] text-[#f4efe8]"
                          : "border-[#8b5e4a]/25 text-[#8b5e4a] group-hover:border-[#8b5e4a]/45"
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-sm leading-[1.55] text-[#5f524c]">
                      {answer.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={currentQuestion === 0}
                className="rounded-full border border-[#211815]/20 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {prog.quizBack}
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={
                  !selectedAnswer ||
                  (currentQuestion === quiz.questions.length - 1 && !completed)
                }
                className="rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_18px_rgba(33,24,21,0.15)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {currentQuestion === quiz.questions.length - 1
                  ? prog.quizShowResult
                  : prog.quizNext}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getQuizResult(answers: Partial<Record<number, SelectedQuizAnswer>>) {
  const counts = resultOrder.reduce(
    (total, key) => ({ ...total, [key]: 0 }),
    {} as Record<ProgramQuizResultKey, number>,
  );

  Object.values(answers).forEach((answer) => {
    if (answer) {
      counts[answer.result] += 1;
    }
  });

  const highest = Math.max(...Object.values(counts));

  return resultOrder.find((key) => counts[key] === highest) ?? "foundation1";
}
