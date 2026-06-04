"use client";

import { BookOpen, Calendar, Eye, Ribbon, Sprout, User, Users } from "lucide-react";
import Link from "next/link";

import { IconTooltip } from "@/components/ui/IconTooltip";
import { useLanguage } from "@/components/site/LanguageProvider";
import { practiceBilingual } from "@/content/practice";

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

const SOCIAL_ACTIVITIES = [
  {
    key: "Rope Jam",
    icons: ["Eye", "Sprout", "User"] as IconName[],
    frequency: { it: "Una volta al mese", en: "Once a month" },
  },
  {
    key: "Open Day",
    icons: ["Eye", "Sprout", "User"] as IconName[],
    frequency: { it: "4 volte all'anno", en: "4 times a year" },
  },
  {
    key: "Aperi-bottom",
    icons: ["Ribbon", "Sprout", "User"] as IconName[],
    frequency: { it: "Ogni due mesi", en: "Every two months" },
  },
];

export function SocialitaTabContent() {
  const { dictionary, locale } = useLanguage();
  const prac = dictionary.practice;
  const content = practiceBilingual[locale] ?? practiceBilingual.it;
  const socialBranch = content.branches.find(b => b.key === "social");
  const activities = socialBranch?.activities ?? [];

  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-6 md:pb-16 md:pt-10">
      {/* Header */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b5e4a]">
        {locale === "en" ? "Social" : "Socialità"}
      </p>
      <h1 className="mt-4 max-w-3xl font-serif text-[clamp(36px,8vw,64px)] font-medium leading-[0.97] text-[#211815]">
        {socialBranch?.title ?? (locale === "en" ? "Community" : "Socialità")}
      </h1>
      {socialBranch?.description ? (
        <p className="mt-4 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
          {socialBranch.description}
        </p>
      ) : null}

      {/* Activity cards */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activities.map((activity) => {
          const meta = SOCIAL_ACTIVITIES.find(a => activity.title.toLowerCase().includes(a.key.toLowerCase().split("-")[0]!));
          const icons = meta?.icons ?? [];
          const freq = meta?.frequency[locale === "en" ? "en" : "it"] ?? activity.frequency;

          return (
            <article
              key={activity.title}
              className="rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-white/68 to-[#efe4d7]/50 p-4 shadow-[0_2px_0_rgba(33,24,21,0.03)] md:p-5"
            >
              <h3 className="font-serif text-2xl font-medium leading-[1.05] text-[#211815] md:text-3xl">
                {activity.title}
              </h3>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Calendar size={11} className="shrink-0 text-[#8b5e4a]/55" aria-hidden="true" />
                <span className="text-[11px] leading-none text-[#5f524c]/65">{freq}</span>
              </div>
              <p className="mt-2.5 text-sm leading-[1.6] text-[#5f524c]">
                {activity.description}
              </p>
              {icons.length > 0 ? (
                <div className="mt-3 flex gap-2">
                  {icons.map(name => (
                    <IconTooltip
                      key={name}
                      icon={ICON_MAP[name]}
                      label={prac[ICON_LABEL_KEY[name]]}
                      size={15}
                    />
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-8">
        <Link
          href="/calendario"
          className="inline-flex rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815] transition hover:-translate-y-0.5 hover:bg-white/70"
        >
          {locale === "en" ? "View upcoming dates →" : "Guarda le prossime date →"}
        </Link>
      </div>
    </div>
  );
}
