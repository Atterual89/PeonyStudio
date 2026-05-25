import type { HomeEvent } from "@/content/home";

type EventsPreviewSectionProps = {
  featured: HomeEvent;
  items: HomeEvent[];
};

export function EventsPreviewSection({
  featured,
  items,
}: EventsPreviewSectionProps) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 md:py-28">
      <div className="mb-10 max-w-2xl">
        <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
          Appuntamenti
        </p>
        <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
          Prossimi appuntamenti
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <article className="flex min-h-72 flex-col justify-between rounded-[8px] bg-[#211815] p-6 text-[#f4efe8] sm:min-h-80 sm:p-7 md:p-8 lg:min-h-96">
          <div>
            <p className="mb-5 text-sm uppercase tracking-[0.25em] text-[#d6b89f]">
              {featured.category}
            </p>
            <h3 className="text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
              {featured.title}
            </h3>
          </div>

          <div className="border-t border-[#f4efe8]/15 pt-6">
            <p className="text-xl font-medium">{featured.date}</p>
            <p className="mt-2 text-[#f4efe8]/75">{featured.detail}</p>
          </div>
        </article>

        <div className="divide-y divide-[#211815]/10 rounded-[8px] border border-[#211815]/10 bg-white/55">
          {items.map((event) => (
            <article
              key={`${event.category}-${event.title}`}
              className="grid gap-3 p-5 md:p-6 lg:grid-cols-[120px_minmax(0,1fr)_auto] lg:items-center"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
                {event.category}
              </p>
              <div className="min-w-0">
                <h3 className="text-xl font-semibold">{event.title}</h3>
                <p className="mt-1 text-[#5f524c]">{event.date}</p>
              </div>
              <p className="text-sm font-medium text-[#5f524c]">
                {event.detail}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
