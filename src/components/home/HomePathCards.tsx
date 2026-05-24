import Link from "next/link";

import type { HomePathCard } from "@/content/home";

type HomePathCardsProps = {
  cards: HomePathCard[];
};

export function HomePathCards({ cards }: HomePathCardsProps) {
  return (
    <section
      id="start"
      className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 md:grid-cols-3"
    >
      {cards.map((card) => (
        <Link
          key={card.eyebrow}
          href={card.href}
          className="block rounded-[8px] bg-white/70 p-7 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/85"
        >
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-[#8b5e4a]">
            {card.eyebrow}
          </p>
          <h2 className="mb-3 text-2xl font-semibold">{card.title}</h2>
          <p className="text-[#5f524c]">{card.description}</p>
        </Link>
      ))}
    </section>
  );
}
