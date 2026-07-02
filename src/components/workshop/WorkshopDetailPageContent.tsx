"use client";

import Link from "next/link";

import { EventImage } from "@/components/shared/EventImage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { useLanguage } from "@/components/site/LanguageProvider";

type WorkshopDetailProps = {
  title: string;
  teachers: string[];
  dateLabel: string | undefined;
  timeLabel: string | undefined;
  shortDescription: string | undefined;
  prerequisites: string | undefined;
  location: string | undefined;
  imageUrl: string | undefined;
  hasHeroImage: boolean;
  international: boolean;
  coupleOnly: boolean;
  observersAllowed: boolean;
  hasTTBooking: boolean;
  isExternal: boolean;
  isPreview: boolean;
  ctaHref: string | null;
  staticCtaLabel: string | undefined;
};

type WorkshopCopy = {
  eyebrow: string;
  badgeInternational: string;
  badgeCoupleOnly: string;
  badgeObserverDenied: string;
  previewBanner: string;
  backToAll: string;
  ctaBook: string;
  ctaExternal: string;
  quickInfoTitle: string;
  quickInfoSubtitle: string;
  prerequisitesTitle: string;
  prerequisitesFallback: string;
  briefTitle: string;
  briefFallback: string;
  viewCalendar: string;
  labelDate: string;
  labelTime: string;
  labelCategory: string;
  labelTeachers: string;
  labelFormat: string;
  labelFormatCouple: string;
  labelFormatOpen: string;
  labelObserver: string;
  labelObserverYes: string;
  labelObserverNo: string;
  labelLocation: string;
};

export function WorkshopDetailPageContent({
  title,
  teachers,
  dateLabel,
  timeLabel,
  shortDescription,
  prerequisites,
  location,
  imageUrl,
  hasHeroImage,
  international,
  coupleOnly,
  observersAllowed,
  hasTTBooking,
  isExternal,
  isPreview,
  ctaHref,
  staticCtaLabel,
}: WorkshopDetailProps) {
  const { dictionary } = useLanguage();
  const w = dictionary.workshop as unknown as WorkshopCopy;

  const ctaLabel = hasTTBooking
    ? w.ctaBook
    : isExternal
      ? (staticCtaLabel ?? w.ctaExternal)
      : null;

  const infoItems = buildInfoItems({ dateLabel, timeLabel, teachers, coupleOnly, observersAllowed, location, w });

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-8 sm:px-6 md:pb-10 md:pt-12">
        <div className="grid gap-5 rounded-[8px] border border-[#211815]/10 bg-white/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:grid-cols-[0.96fr_1.04fr] md:items-stretch md:p-4">
          {imageUrl ? (
            <EventImage
              src={imageUrl}
              alt={title}
              variant={hasHeroImage ? "hero" : "card"}
              className="min-h-[200px] rounded-[8px] border border-[#211815]/10 md:min-h-[320px]"
              priority
            />
          ) : (
            <div className="h-[200px] rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-[#efe4d7] to-[#d6b89f]/30 md:h-auto md:min-h-[320px]" />
          )}

          <div className="flex flex-col justify-between p-1 md:p-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#8b5e4a]/20 bg-[#8b5e4a]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                  {w.eyebrow}
                </span>
                {international && (
                  <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-1 text-xs font-medium text-[#5f524c]">
                    {w.badgeInternational}
                  </span>
                )}
                {coupleOnly && (
                  <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-1 text-xs font-medium text-[#5f524c]">
                    {w.badgeCoupleOnly}
                  </span>
                )}
                {!observersAllowed && (
                  <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-1 text-xs font-medium text-[#5f524c]">
                    {w.badgeObserverDenied}
                  </span>
                )}
              </div>

              <h1 className="mt-4 max-w-3xl font-serif text-[clamp(32px,6vw,60px)] font-medium leading-[1.0] tracking-normal">
                {title}
              </h1>
              {teachers.length > 0 && (
                <p className="mt-2 text-base text-[#5f524c]">
                  {teachers.join(" · ")}
                </p>
              )}
              {dateLabel && (
                <p className="mt-3 text-sm font-medium text-[#211815]">
                  {dateLabel}
                  {timeLabel ? ` · ${timeLabel}` : ""}
                </p>
              )}
            </div>

            <div className="mt-6">
              {isPreview ? (
                <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/65 px-4 py-3 text-sm text-[#5f524c]">
                  {w.previewBanner}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {ctaHref && ctaLabel && (
                    <Link
                      href={ctaHref}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(33,24,21,0.22)]"
                    >
                      {ctaLabel}
                    </Link>
                  )}
                  <Link
                    href="/workshop"
                    className="inline-flex justify-center rounded-full border border-[#211815]/15 bg-white/55 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white/80"
                  >
                    {w.backToAll}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-6 md:pb-14">
        <div className="grid gap-4 lg:grid-cols-[1.04fr_0.96fr]">
          <section className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-4 md:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              {w.quickInfoTitle}
            </p>
            <h2 className="mt-1 font-serif text-3xl font-medium leading-[1.06] md:text-4xl">
              {w.quickInfoSubtitle}
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
              {infoItems.map((item) => (
                <div
                  key={item.label}
                  className="min-h-[78px] rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/65 p-3"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-[1.35] text-[#211815]">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/[0.08] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                {w.prerequisitesTitle}
              </p>
              <p className="mt-1 text-sm leading-[1.5] text-[#211815]">
                {prerequisites ?? w.prerequisitesFallback}
              </p>
            </div>
          </section>

          <section className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-4 md:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              {w.briefTitle}
            </p>
            <p className="mt-3 text-[15px] leading-[1.7] text-[#5f524c]">
              {shortDescription ?? w.briefFallback}
            </p>
            <div className="mt-5">
              {isPreview ? (
                <Link
                  href="/calendario"
                  className="inline-flex justify-center rounded-full border border-[#211815]/15 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815]"
                >
                  {w.viewCalendar}
                </Link>
              ) : ctaHref && ctaLabel ? (
                <Link
                  href={ctaHref}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white"
                >
                  {ctaLabel}
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function buildInfoItems({
  dateLabel,
  timeLabel,
  teachers,
  coupleOnly,
  observersAllowed,
  location,
  w,
}: {
  dateLabel: string | undefined;
  timeLabel: string | undefined;
  teachers: string[];
  coupleOnly: boolean;
  observersAllowed: boolean;
  location: string | undefined;
  w: WorkshopCopy;
}) {
  const items: { label: string; value: string }[] = [];
  if (dateLabel) items.push({ label: w.labelDate, value: dateLabel });
  if (timeLabel) items.push({ label: w.labelTime, value: timeLabel });
  items.push({ label: w.labelCategory, value: w.eyebrow });
  if (teachers.length > 0) items.push({ label: w.labelTeachers, value: teachers.join(", ") });
  items.push({ label: w.labelFormat, value: coupleOnly ? w.labelFormatCouple : w.labelFormatOpen });
  items.push({ label: w.labelObserver, value: observersAllowed ? w.labelObserverYes : w.labelObserverNo });
  if (location) items.push({ label: w.labelLocation, value: location });
  return items;
}
