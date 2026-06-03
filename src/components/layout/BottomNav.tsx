"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLanguage } from "@/components/site/LanguageProvider";

type TabKey = "home" | "calendar" | "programs" | "shop" | "profile";

const tabs: { href: string; key: TabKey; overrideLabel?: string }[] = [
  { href: "/peony", key: "home", overrideLabel: "Peony" },
  { href: "/calendario", key: "calendar" },
  { href: "/percorsi", key: "programs" },
  { href: "/shop", key: "shop" },
  { href: "/area-personale", key: "profile" },
];

function isActive(href: string, key: TabKey, pathname: string): boolean {
  if (key === "home") return pathname.startsWith("/peony");
  if (key === "programs") {
    return pathname.startsWith("/percorsi") || pathname.startsWith("/workshop");
  }
  return pathname.startsWith(href);
}

function TabIcon({ name, active }: { name: TabKey; active: boolean }) {
  const cls = `h-[22px] w-[22px] transition-colors ${
    active ? "text-[#8b5e4a]" : "text-[#5f524c]"
  }`;

  switch (name) {
    case "home":
      return (
        <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
          <circle cx="10" cy="10" r="2" />
          <circle cx="10"  cy="5.8" r="2.2" />
          <circle cx="13.6" cy="8.8" r="2.2" />
          <circle cx="12.2" cy="13"  r="2.2" />
          <circle cx="7.8"  cy="13"  r="2.2" />
          <circle cx="6.4"  cy="8.8" r="2.2" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12" rx="2" />
          <path d="M3 8.5h14M7 4.5V2.5M13 4.5V2.5" />
          <path d="M6.5 12h1M9.5 12h1M12.5 12h1" strokeWidth="1.8" />
        </svg>
      );
    case "programs":
      return (
        <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 17h4v-4h4v-4h4V5" />
          <circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="13" cy="9" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="17" cy="5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "shop":
      return (
        <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8h14l-1.4 9H4.4z" />
          <path d="M7 8V6a3 3 0 016 0v2" />
        </svg>
      );
    case "profile":
      return (
        <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="10" cy="7" r="3.5" />
          <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" />
        </svg>
      );
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const { dictionary } = useLanguage();
  const labels = dictionary.nav.bottomNav;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-[#211815]/10 bg-[#f4efe8]/[0.97] backdrop-blur-[14px]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Bottom navigation"
    >
      {tabs.map(({ href, key, overrideLabel }) => {
        const active = isActive(href, key, pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] transition-all duration-150 active:scale-95 ${
              active ? "text-[#8b5e4a]" : "text-[#5f524c]"
            }`}
          >
            <TabIcon name={key} active={active} />
            <span>{overrideLabel ?? labels[key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
