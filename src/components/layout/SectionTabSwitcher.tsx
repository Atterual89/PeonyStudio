"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionTab = {
  href: string;
  label: string;
};

type Props = {
  tabs: SectionTab[];
};

export function SectionTabSwitcher({ tabs }: Props) {
  const pathname = usePathname();

  // Longest-match-wins: prefer the most specific (longest) matching href
  const resolved = tabs.reduce<number>((best, tab, i) => {
    const matches = pathname === tab.href || pathname.startsWith(tab.href + "/");
    if (!matches) return best;
    if (best === -1 || tabs[i].href.length > tabs[best].href.length) return i;
    return best;
  }, -1);
  const activeIdx = resolved === -1 ? 0 : resolved;

  return (
    <div
      className="sticky z-40 border-b border-[#211815]/12 bg-[#f4efe8]"
      style={{ top: "57px" }}
    >
      <div className="mx-auto flex max-w-6xl items-end gap-0.5 px-4 pt-2.5 sm:gap-1 sm:px-6">
        {tabs.map((tab, i) => {
          const active = i === activeIdx;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-t-[8px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5e4a] focus-visible:ring-offset-2 sm:px-4 sm:text-[11px] sm:tracking-[0.16em] ${
                active
                  ? "-mb-px border border-b-[#f4efe8] border-[#211815]/12 bg-[#f4efe8] text-[#211815]"
                  : "border border-transparent bg-[#e8e3db]/80 text-[#5f524c]/60 hover:text-[#5f524c]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
