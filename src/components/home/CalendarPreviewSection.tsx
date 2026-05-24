import Link from "next/link";

import { HomeSectionHeading } from "@/components/home/HomeSectionHeading";
import type { calendarContent } from "@/content/calendar";
import type { homeContent } from "@/content/home";

type CalendarPreviewSectionProps = {
  content: typeof homeContent.calendarPreview;
  events: typeof calendarContent.previewEvents;
};

export function CalendarPreviewSection({
  content,
  events,
}: CalendarPreviewSectionProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20" id="calendar">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <HomeSectionHeading
          eyebrow={content.eyebrow}
          title={content.title}
          intro={content.intro}
        />

        <Link
          href={content.cta.href}
          className="inline-flex w-fit rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white"
        >
          {content.cta.label}
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {events.map((event) => (
          <article
            key={event.title}
            className="rounded-[8px] border border-[#211815]/10 bg-white/60 p-6"
          >
            <p className="mb-3 text-sm uppercase tracking-[0.18em] text-[#8b5e4a]">
              {event.meta}
            </p>
            <h3 className="mb-3 text-2xl font-semibold">{event.title}</h3>
            <p className="leading-7 text-[#5f524c]">{event.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
