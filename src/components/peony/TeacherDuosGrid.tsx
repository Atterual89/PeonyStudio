"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import type { TeacherDuo } from "@/content/teacher-duos";

export function TeacherDuosGrid({ duos }: { duos: TeacherDuo[] }) {
  const [activeDuo, setActiveDuo] = useState<TeacherDuo | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const dialogTitleId = useId();

  useEffect(() => {
    if (!activeDuo) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDuo(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDuo]);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {duos.map((duo, index) => (
          <article
            key={duo.id}
            className="peony-reveal group overflow-hidden rounded-[8px] border border-[#211815]/10 bg-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition duration-500 hover:-translate-y-1 hover:bg-white/65 hover:shadow-[0_14px_34px_rgba(33,24,21,0.09)]"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <TeacherImage
              duo={duo}
              failed={failedImages[duo.id]}
              onError={() =>
                setFailedImages((current) => ({ ...current, [duo.id]: true }))
              }
              className="h-52 md:h-48"
            />
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
                {duo.role}
              </p>
              <h3 className="mt-2 font-serif text-2xl font-medium leading-[1.08]">
                {duo.name}
              </h3>
              <p className="mt-2 text-sm leading-[1.55] text-[#5f524c]">
                {duo.shortBio}
              </p>
              {duo.tags?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {duo.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#8b5e4a]/15 bg-[#8b5e4a]/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#8b5e4a]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                className="mt-4 inline-flex rounded-full border border-[#211815]/15 bg-white/55 px-4 py-2 text-sm font-medium text-[#211815] transition hover:bg-white/85"
                onClick={() => setActiveDuo(duo)}
              >
                Leggi bio
              </button>
            </div>
          </article>
        ))}
      </div>

      {activeDuo ? (
        <div
          aria-labelledby={dialogTitleId}
          aria-modal="true"
          className="fixed inset-0 z-[90] grid place-items-center bg-[#211815]/45 px-4 py-5 backdrop-blur-sm"
          role="dialog"
          onClick={() => setActiveDuo(null)}
        >
          <div
            className="relative max-h-[calc(100dvh-40px)] w-full max-w-4xl overflow-y-auto rounded-[8px] border border-[#211815]/10 bg-[#f4efe8] shadow-[0_24px_80px_rgba(33,24,21,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Chiudi bio insegnanti"
              className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-[#211815]/10 bg-[#f4efe8]/85 text-xl leading-none text-[#211815] backdrop-blur-sm transition hover:bg-white"
              onClick={() => setActiveDuo(null)}
            >
              ×
            </button>
            <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
              <TeacherImage
                duo={activeDuo}
                failed={failedImages[activeDuo.id]}
                onError={() =>
                  setFailedImages((current) => ({
                    ...current,
                    [activeDuo.id]: true,
                  }))
                }
                className="h-64 md:h-full md:min-h-[520px]"
              />
              <div className="p-5 md:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  {activeDuo.role}
                </p>
                <h3
                  id={dialogTitleId}
                  className="mt-2 font-serif text-4xl font-medium leading-[1.02] md:text-5xl"
                >
                  {activeDuo.name}
                </h3>
                <p className="mt-4 text-[15px] leading-[1.75] text-[#5f524c]">
                  {activeDuo.fullBio}
                </p>

                {activeDuo.tags?.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {activeDuo.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[#8b5e4a]/15 bg-white/45 px-3 py-1.5 text-xs font-medium text-[#8b5e4a]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {activeDuo.links?.length ? (
                  <div className="mt-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b5e4a]">
                      Link
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeDuo.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="rounded-full border border-[#211815]/15 bg-white/45 px-4 py-2 text-sm font-medium text-[#211815] transition hover:bg-white/80"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeDuo.workshopLinks?.length ? (
                  <div className="mt-6 rounded-[8px] border border-[#211815]/10 bg-white/35 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b5e4a]">
                      Workshop collegati
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      {activeDuo.workshopLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="inline-flex justify-center rounded-full bg-[#211815] px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TeacherImage({
  duo,
  failed,
  onError,
  className,
}: {
  duo: TeacherDuo;
  failed?: boolean;
  onError: () => void;
  className: string;
}) {
  if (failed) {
    return (
      <div
        className={`grid w-full place-items-center bg-[#8b5e4a]/[0.08] ${className}`}
      >
        <div className="max-w-[220px] px-5 text-center">
          <p className="font-serif text-3xl font-medium leading-[1.05] text-[#8b5e4a]">
            {duo.name}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#5f524c]">
            Foto in arrivo
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#efe4d7] ${className}`}>
      <Image
        src={duo.image}
        alt={duo.imageAlt}
        fill
        sizes="(min-width: 768px) 33vw, 100vw"
        className="object-cover saturate-[0.94] transition duration-700 group-hover:scale-105"
        onError={onError}
      />
    </div>
  );
}
