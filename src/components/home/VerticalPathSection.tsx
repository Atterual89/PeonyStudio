import Link from "next/link";

import type { HomeVerticalPathItem } from "@/content/home";

type VerticalPathSectionProps = {
  items: HomeVerticalPathItem[];
};

export function VerticalPathSection({ items }: VerticalPathSectionProps) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 md:py-28">
      <div className="mb-10 max-w-2xl md:mb-12">
        <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
          Percorso
        </p>
        <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
          Un ingresso progressivo nello studio.
        </h2>
      </div>

      <div className="divide-y divide-[#211815]/10 border-y border-[#211815]/10">
        {items.map((item) => (
          <Link
            key={item.number}
            href={item.href}
            className="group grid gap-4 py-7 transition hover:bg-white/35 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center md:px-4"
          >
            <span className="text-5xl font-semibold leading-none text-[#8b5e4a] md:text-6xl">
              {item.number}
            </span>
            <span className="min-w-0">
              <span className="block text-2xl font-semibold md:text-4xl">
                {item.title}
              </span>
              <span className="mt-2 block text-lg text-[#5f524c]">
                {item.summary}
              </span>
            </span>
            <span className="text-sm font-medium text-[#8b5e4a] transition group-hover:translate-x-1">
              Scopri →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
