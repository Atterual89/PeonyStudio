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

  const activeIndex = tabs.findIndex(
    (tab) =>
      pathname === tab.href ||
      pathname.startsWith(tab.href + "/"),
  );
  const resolved = activeIndex === -1 ? 0 : activeIndex;

  return (
    <div
      className="sticky z-40 border-b border-[#211815]/10 bg-[#f4efe8]"
      style={{ top: "57px" }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="relative flex">
          {/* Sliding underline indicator */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 h-[2px] bg-[#211815] transition-transform duration-200 ease-out"
            style={{
              width: `${100 / tabs.length}%`,
              transform: `translateX(${resolved * 100}%)`,
            }}
          />

          {tabs.map((tab, i) => {
            const active = i === resolved;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 items-center justify-center py-3 font-sans text-xs font-semibold uppercase tracking-widest transition-colors duration-150 ${
                  active ? "text-[#1a1510]" : "text-[#5f524c]/50 hover:text-[#5f524c]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
