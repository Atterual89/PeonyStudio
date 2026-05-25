import Link from "next/link";

import type { HomeArea } from "@/content/home";

type AreasScrollSectionProps = {
  areas: HomeArea[];
};

export function AreasScrollSection({ areas }: AreasScrollSectionProps) {
  return (
    <section className="py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
            Aree
          </p>
          <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
            Le aree di Peony
          </h2>
        </div>
      </div>

      <div className="overflow-x-auto px-5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex max-w-6xl gap-4">
          {areas.map((area, index) => (
            <Link
              key={area.title}
              href={area.href}
              className="group flex min-h-52 w-[82vw] max-w-[300px] shrink-0 flex-col justify-between rounded-[8px] border border-[#211815]/10 bg-white/60 p-6 transition hover:-translate-y-0.5 hover:bg-white/80 sm:w-[300px] md:w-[320px] md:max-w-[320px]"
            >
              <div>
                <p className="mb-8 text-sm uppercase tracking-[0.22em] text-[#8b5e4a]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-3xl font-semibold">{area.title}</h3>
                <p className="mt-3 text-lg text-[#5f524c]">
                  {area.description}
                </p>
              </div>
              <span className="mt-8 text-sm font-medium text-[#8b5e4a] transition group-hover:translate-x-1">
                Scopri →
              </span>
            </Link>
          ))}
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-6xl px-5 text-sm text-[#8b5e4a] sm:px-6">
        → scorri per vedere tutte le aree
      </p>
    </section>
  );
}
