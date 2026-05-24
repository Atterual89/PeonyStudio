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
        <div key={card.eyebrow} className="rounded-3xl bg-white/70 p-6 shadow-sm">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-[#8b5e4a]">
            {card.eyebrow}
          </p>
          <h2 className="mb-3 text-2xl font-semibold">{card.title}</h2>
          <p className="text-[#5f524c]">{card.description}</p>
        </div>
      ))}
    </section>
  );
}
