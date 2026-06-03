"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { HomeFooter } from "@/components/home/HomeFooter";
import { TeacherDuosGrid } from "@/components/peony/TeacherDuosGrid";
import { useLanguage } from "@/components/site/LanguageProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { peonyAboutBilingual } from "@/content/peony-about";
import { teacherDuos } from "@/content/teacher-duos";

type GalleryImage = {
  src: string;
  alt: string;
};

type Props = {
  galleryImages: GalleryImage[];
};

export function PeonyPageClient({ galleryImages }: Props) {
  const { dictionary, locale } = useLanguage();
  const p = dictionary.peony;
  const content = peonyAboutBilingual[locale] ?? peonyAboutBilingual.it;
  const finalActions = content.finalCta.actions.filter(
    (action) => action.href !== "/contatti",
  );

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="relative overflow-hidden px-5 pb-10 pt-10 sm:px-6 md:pb-16 md:pt-20">
        <span
          aria-hidden="true"
          className="absolute right-0 top-14 hidden h-px w-1/2 bg-[#8b5e4a]/20 md:block"
        />
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[0.96fr_1.04fr] md:items-end">
          <div className="peony-reveal">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
              {content.hero.eyebrow}
            </p>
            <h1 className="mt-3 max-w-4xl font-serif text-[clamp(40px,10vw,86px)] font-medium leading-[0.98] tracking-normal">
              {p.heroTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-[1.7] text-[#5f524c] md:mt-5 md:text-base md:leading-[1.75]">
              {p.heroIntro}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                href={content.hero.primaryCta.href}
                className="inline-flex justify-center rounded-full bg-[#211815] px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 md:px-5 md:py-3"
              >
                {p.heroPrimaryCtaLabel}
              </Link>
              <Link
                href={content.hero.secondaryCta.href}
                className="inline-flex justify-center rounded-full border border-[#211815]/15 bg-white/45 px-4 py-2.5 text-sm font-medium text-[#211815] transition hover:bg-white/75 md:px-5 md:py-3"
              >
                {p.heroSecondaryCtaLabel}
              </Link>
            </div>
          </div>
          <div className="peony-reveal peony-reveal-delay-1 relative overflow-hidden rounded-[8px] border border-[#211815]/10 bg-[#efe4d7] shadow-[0_18px_50px_rgba(33,24,21,0.10)]">
            <Image
              src="/images/home/hero-studio.jpg"
              alt="Peony Studio a Torino"
              width={980}
              height={620}
              priority
              className="h-[270px] w-full object-cover saturate-[0.9] md:h-[470px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#211815]/42 via-transparent to-[#f4efe8]/18" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4 text-[#f4efe8]">
              <p className="max-w-[220px] font-serif text-2xl font-medium leading-[1.05] md:text-3xl">
                {p.heroOverlay}
              </p>
              <span className="hidden rounded-full border border-[#f4efe8]/25 px-3 py-1.5 text-xs font-medium md:inline-flex">
                {p.heroBadge}
              </span>
            </div>
          </div>
        </div>
        <div className="peony-reveal peony-reveal-delay-2 mx-auto mt-4 grid max-w-6xl gap-3 md:mt-5 md:grid-cols-[1.2fr_0.8fr]">
          <div className="relative min-h-[160px] overflow-hidden rounded-[8px] border border-[#211815]/10 bg-[#211815] p-5 text-[#f4efe8] md:min-h-[230px] md:p-7">
            <span
              aria-hidden="true"
              className="absolute -right-16 -top-20 h-60 w-60 rounded-full border border-[#d6b89f]/20"
            />
            <span
              aria-hidden="true"
              className="absolute right-8 top-10 h-px w-52 rotate-[-18deg] bg-[#d6b89f]/30"
            />
            <p className="relative text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b89f]">
              {p.studioCommunity}
            </p>
            <p className="relative mt-12 max-w-xl font-serif text-[28px] font-medium leading-[1.07] md:mt-20 md:text-4xl">
              {p.studioText}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            {content.approach.pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-[8px] border border-[#211815]/10 bg-white/42 p-3.5 md:p-4"
              >
                <p className="font-serif text-2xl font-medium leading-[1.08]">
                  {pillar.title}
                </p>
                <p className="mt-1 text-sm leading-[1.55] text-[#5f524c]">
                  {pillar.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionShell
        id="luogo"
        eyebrow={content.space.eyebrow}
        title={content.space.title}
      >
        <p className="max-w-3xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
          {content.space.intro}
        </p>
        <ImageMosaic />
        <CardGrid cards={content.space.cards} numbered />
      </SectionShell>

      <SectionShell
        id="gallery"
        eyebrow={content.gallery.eyebrow}
        title={content.gallery.title}
        intro={content.gallery.intro}
      >
        <GalleryGrid images={galleryImages} emptyText={content.gallery.empty} />
      </SectionShell>

      <section
        id="dove-siamo"
        className="mx-auto grid max-w-6xl gap-4 px-5 py-7 sm:px-6 md:grid-cols-[0.9fr_1.1fr] md:py-12"
      >
        <div className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-5 md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {content.location.eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-4xl font-medium leading-[1.02] md:text-5xl">
            {content.location.title}
          </h2>
          <p className="mt-3 text-[15px] leading-[1.68] text-[#5f524c] md:mt-4 md:leading-[1.75]">
            {content.location.intro}
          </p>
        </div>
        <div className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-5 md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {p.howToGetThere}
          </p>
          <div className="mt-4 grid gap-2.5">
            {content.location.travel.map((group, index) => (
              <details
                key={group.title}
                className="peony-details rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70"
                open={index === 2}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[#211815] marker:hidden">
                  <span>{group.title}</span>
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#211815]/10 bg-white/45 text-[#8b5e4a] transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <ul className="grid gap-2 border-t border-[#211815]/10 px-4 py-3">
                  {group.items.map((item) => (
                    <li key={item} className="text-sm leading-[1.55] text-[#5f524c]">
                      {item}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section
        id="approccio"
        className="mx-auto grid max-w-6xl gap-4 px-5 py-8 sm:px-6 md:grid-cols-2 md:py-12"
      >
        <article className="rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/[0.08] p-5 md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {content.nameStory.eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-4xl font-medium leading-[1.02] md:text-5xl">
            {content.nameStory.title}
          </h2>
          <p className="mt-4 text-[15px] leading-[1.75] text-[#5f524c]">
            {content.nameStory.text}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Naka San", "Peonia", "Elemiaow"].map((label) => (
              <span
                key={label}
                className="rounded-full border border-[#8b5e4a]/20 bg-white/45 px-3 py-1.5 text-xs font-medium text-[#8b5e4a]"
              >
                {label}
              </span>
            ))}
          </div>
        </article>
        <TextPanel
          eyebrow={content.approach.eyebrow}
          title={content.approach.title}
          text={content.approach.text}
        />
      </section>

      <SectionShell
        id="resident-teachers"
        eyebrow={content.residentTeachers.eyebrow}
        title={content.residentTeachers.title}
        intro={content.residentTeachers.intro}
      >
        <TeacherDuosGrid duos={teacherDuos.slice(0, 1)} />
      </SectionShell>

      <SectionShell
        id="guest-teachers"
        eyebrow={content.guestTeachers.eyebrow}
        title={content.guestTeachers.title}
        intro={content.guestTeachers.intro}
      >
        <TeacherDuosGrid duos={teacherDuos.slice(1)} />
        <div>
          <Link
            href="/workshop"
            className="inline-flex w-fit rounded-full border border-[#211815]/15 bg-white/45 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white/75"
          >
            {p.viewWorkshops}
          </Link>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow={content.community.eyebrow}
        title={content.community.title}
        intro={content.community.intro}
      >
        <CommunityLinkGrid
          cards={content.community.cards}
          labels={p.communityLabels}
          goToSection={p.goToSection}
        />
      </SectionShell>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-6 md:pb-24 md:pt-12">
        <div className="rounded-[8px] border border-[#211815]/10 bg-[#211815] p-6 text-[#f4efe8] md:p-8">
          <h2 className="font-serif text-4xl font-medium leading-[1.02] md:text-5xl">
            {content.finalCta.title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-[1.7] text-[#f4efe8]/72 md:text-base">
            {content.finalCta.text}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {finalActions.map((action, index) => (
              <Link
                key={action.href}
                href={action.href}
                className={
                  index === 0
                    ? "inline-flex justify-center rounded-full bg-[#f4efe8] px-5 py-3 text-sm font-medium text-[#211815]"
                    : "inline-flex justify-center rounded-full border border-[#f4efe8]/20 px-5 py-3 text-sm font-medium text-[#f4efe8] transition hover:bg-[#f4efe8]/10"
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <HomeFooter content={dictionary.footer} />
    </main>
  );
}

function SectionShell({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="mx-auto max-w-6xl px-5 py-7 sm:px-6 md:py-12"
    >
      <div className="mb-4 md:mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
          {eyebrow}
        </p>
        <h2 className="mt-2 max-w-3xl font-serif text-[34px] font-medium leading-[1.04] md:text-5xl">
          {title}
        </h2>
        {intro ? (
          <p className="mt-4 max-w-3xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
            {intro}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function CardGrid({
  cards,
  columns = "md:grid-cols-4",
  compact = false,
  numbered = false,
}: {
  cards: { title: string; text: string }[];
  columns?: string;
  compact?: boolean;
  numbered?: boolean;
}) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${columns}`}>
      {cards.map((card, index) => (
        <article
          key={card.title}
          className={`peony-reveal rounded-[8px] border border-[#211815]/10 bg-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition duration-500 hover:-translate-y-1 hover:bg-white/62 hover:shadow-[0_12px_32px_rgba(33,24,21,0.08)] ${
            compact ? "p-3.5 md:p-4" : "p-4"
          }`}
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-2xl font-medium leading-[1.08]">
              {card.title}
            </h3>
            {numbered ? (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]/70">
                {String(index + 1).padStart(2, "0")}
              </span>
            ) : null}
          </div>
          <p className={`mt-2 text-sm text-[#5f524c] ${compact ? "leading-[1.5]" : "leading-[1.6]"}`}>
            {card.text}
          </p>
        </article>
      ))}
    </div>
  );
}

function ImageMosaic() {
  const images = [
    {
      src: "/images/home/space-lounge.jpg",
      alt: "Lounge Peony Studio",
      label: "Lounge",
    },
    {
      src: "/images/home/space-bamboo.jpg",
      alt: "Bamboo e hashira Peony Studio",
      label: "Bamboo / Hashira",
    },
    {
      src: "/images/home/event-practice.jpg",
      alt: "Pratica nello spazio Peony",
      label: "Practice setup",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
      {images.map((image, index) => (
        <div
          key={image.src}
          className={`peony-reveal group relative overflow-hidden rounded-[8px] border border-[#211815]/10 bg-[#efe4d7] ${
            index === 0 ? "md:row-span-2" : ""
          }`}
          style={{ animationDelay: `${index * 90}ms` }}
        >
          <Image
            src={image.src}
            alt={image.alt}
            width={760}
            height={520}
            className={`w-full object-cover saturate-[0.92] transition duration-700 group-hover:scale-105 ${
              index === 0 ? "h-[240px] md:h-full" : "h-[170px] md:h-[190px]"
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#211815]/32 via-transparent to-transparent" />
          <span className="absolute bottom-3 left-3 rounded-full border border-[#f4efe8]/25 bg-[#211815]/35 px-3 py-1.5 text-xs font-medium text-[#f4efe8] backdrop-blur-sm">
            {image.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function GalleryGrid({
  images,
  emptyText,
}: {
  images: GalleryImage[];
  emptyText: string;
}) {
  if (!images.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[#211815]/15 bg-white/30 p-6 text-sm leading-[1.6] text-[#5f524c]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [scrollbar-color:#8b5e4a33_transparent] sm:mx-0 sm:px-0 md:overflow-visible">
      <div className="flex gap-3 md:grid md:grid-cols-3">
        {images.map((image, index) => (
          <figure
            key={image.src}
            className={`peony-reveal group relative w-[min(82vw,320px)] shrink-0 overflow-hidden rounded-[8px] border border-[#211815]/10 bg-[#efe4d7] [scroll-snap-align:start] md:w-auto ${
              index === 0 ? "md:col-span-2" : ""
            }`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={820}
              height={560}
              className={`w-full object-cover saturate-[0.94] transition duration-700 group-hover:scale-105 ${
                index === 0 ? "h-[260px] md:h-[360px]" : "h-[260px] md:h-[270px]"
              }`}
            />
            <figcaption className="absolute bottom-3 left-3 rounded-full border border-[#f4efe8]/25 bg-[#211815]/35 px-3 py-1.5 text-xs font-medium text-[#f4efe8] backdrop-blur-sm">
              {image.alt}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function CommunityLinkGrid({
  cards,
  labels,
  goToSection,
}: {
  cards: { title: string; text: string }[];
  labels: string[];
  goToSection: string;
}) {
  const hrefs = ["/percorsi", "/pratica", "/workshop", "/calendario"];

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
      {cards.map((card, index) => (
        <Link
          key={card.title}
          href={hrefs[index] ?? "/calendario"}
          className="peony-reveal group rounded-[8px] border border-[#211815]/10 bg-white/42 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition duration-500 hover:-translate-y-1 hover:bg-white/65 hover:shadow-[0_12px_32px_rgba(33,24,21,0.08)]"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
            {labels[index] ?? card.title}
          </p>
          <h3 className="mt-2 font-serif text-2xl font-medium leading-[1.08]">
            {card.title}
          </h3>
          <p className="mt-2 text-sm leading-[1.6] text-[#5f524c]">
            {card.text}
          </p>
          <span className="mt-4 inline-flex text-sm font-medium text-[#8b5e4a] transition group-hover:translate-x-1">
            {goToSection}
          </span>
        </Link>
      ))}
    </div>
  );
}

function TextPanel({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-4xl font-medium leading-[1.02] md:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-[15px] leading-[1.75] text-[#5f524c]">
        {text}
      </p>
    </article>
  );
}
