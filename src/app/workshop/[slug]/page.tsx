import Link from "next/link";
import { notFound } from "next/navigation";

import { EventImage } from "@/components/shared/EventImage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { homeContent } from "@/content/home";
import { getWorkshopBySlug } from "@/content/workshops";
import { getWorkshopEvents } from "@/lib/events";
import { TICKET_TAILOR_PUBLIC_URL } from "@/lib/ticketTailor";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function WorkshopDetailPage({ params }: Props) {
  const { slug } = await params;

  const [liveEvents, staticWorkshop] = await Promise.all([
    getWorkshopEvents(),
    Promise.resolve(getWorkshopBySlug(slug)),
  ]);

  const liveEvent = liveEvents.find((e) => e.workshopSlug === slug);

  if (!liveEvent && !staticWorkshop) {
    notFound();
  }

  const title = liveEvent?.title ?? staticWorkshop?.title ?? "Workshop";
  const teachers =
    staticWorkshop?.teachers ?? teachersFromTags(liveEvent?.tags ?? []);
  const dateLabel = liveEvent?.dateLabel ?? staticWorkshop?.dateLabel;
  const timeLabel = liveEvent?.timeLabel ?? staticWorkshop?.timeLabel;
  const shortDescription =
    liveEvent?.shortDescription ?? staticWorkshop?.shortDescription;
  const prerequisites = staticWorkshop?.prerequisites;
  const location = staticWorkshop?.location;
  const international = staticWorkshop?.international ?? true;
  const coupleOnly = staticWorkshop?.coupleOnly ?? true;
  const observersAllowed = staticWorkshop?.observersAllowed ?? false;
  const imageUrl = liveEvent?.imageUrl ?? staticWorkshop?.image;

  const hasTTBooking =
    liveEvent?.source === "ticket-tailor" &&
    Boolean(liveEvent.bookingUrl) &&
    liveEvent.bookingUrl !== TICKET_TAILOR_PUBLIC_URL;

  const isExternal =
    !liveEvent && staticWorkshop?.source === "external";
  const isPreview = !hasTTBooking && !isExternal;

  const ctaHref = hasTTBooking
    ? liveEvent.bookingUrl
    : isExternal
      ? (staticWorkshop?.externalUrl ?? null)
      : null;

  const ctaLabel = hasTTBooking
    ? "Prenota su Ticket Tailor"
    : isExternal
      ? (staticWorkshop?.ctaLabel ?? "Info e iscrizioni")
      : null;

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-8 sm:px-6 md:pb-10 md:pt-12">
        <div className="grid gap-5 rounded-[8px] border border-[#211815]/10 bg-white/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:grid-cols-[0.96fr_1.04fr] md:items-stretch md:p-4">
          {imageUrl ? (
            <EventImage
              src={imageUrl}
              alt={title}
              variant={liveEvent?.imageUrl ? "hero" : "card"}
              className="min-h-[200px] rounded-[8px] border border-[#211815]/10 md:min-h-[320px]"
              priority
            />
          ) : (
            <div className="h-[200px] rounded-[8px] border border-[#211815]/10 bg-gradient-to-br from-[#efe4d7] to-[#d6b89f]/30 md:h-auto md:min-h-[320px]" />
          )}

          <div className="flex flex-col justify-between p-1 md:p-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#8b5e4a]/20 bg-[#8b5e4a]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                  Workshop
                </span>
                {international && (
                  <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-1 text-xs font-medium text-[#5f524c]">
                    Internazionale
                  </span>
                )}
                {coupleOnly && (
                  <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-1 text-xs font-medium text-[#5f524c]">
                    Solo coppie
                  </span>
                )}
                {!observersAllowed && (
                  <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-1 text-xs font-medium text-[#5f524c]">
                    Observer non ammessi
                  </span>
                )}
              </div>

              <h1 className="mt-4 max-w-3xl font-serif text-[clamp(32px,6vw,60px)] font-medium leading-[1.0] tracking-normal">
                {title}
              </h1>
              {teachers.length > 0 && (
                <p className="mt-2 text-base text-[#5f524c]">
                  {teachers.join(" · ")}
                </p>
              )}

              {dateLabel && (
                <p className="mt-3 text-sm font-medium text-[#211815]">
                  {dateLabel}
                  {timeLabel ? ` · ${timeLabel}` : ""}
                </p>
              )}
            </div>

            <div className="mt-6">
              {isPreview ? (
                <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/65 px-4 py-3 text-sm text-[#5f524c]">
                  In programma — biglietti non ancora disponibili
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {ctaHref && ctaLabel && (
                    <Link
                      href={ctaHref}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(33,24,21,0.22)]"
                    >
                      {ctaLabel}
                    </Link>
                  )}
                  <Link
                    href="/workshop"
                    className="inline-flex justify-center rounded-full border border-[#211815]/15 bg-white/55 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white/80"
                  >
                    Tutti i workshop
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-6 md:pb-14">
        <div className="grid gap-4 lg:grid-cols-[1.04fr_0.96fr]">
          <section className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-4 md:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              Info rapide
            </p>
            <h2 className="mt-1 font-serif text-3xl font-medium leading-[1.06] md:text-4xl">
              Prima di prenotare
            </h2>

            <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
              {buildInfoItems({
                dateLabel,
                timeLabel,
                teachers,
                coupleOnly,
                observersAllowed,
                location,
              }).map((item) => (
                <div
                  key={item.label}
                  className="min-h-[78px] rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/65 p-3"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-[1.35] text-[#211815]">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/[0.08] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                Prerequisiti
              </p>
              <p className="mt-1 text-sm leading-[1.5] text-[#211815]">
                {prerequisites ?? "Verranno comunicati in fase di iscrizione."}
              </p>
            </div>
          </section>

          <section className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-4 md:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              In breve
            </p>
            <p className="mt-3 text-[15px] leading-[1.7] text-[#5f524c]">
              {shortDescription ??
                "Dettagli in arrivo. Segui i canali Peony Studio per aggiornamenti."}
            </p>

            <div className="mt-5">
              {isPreview ? (
                <Link
                  href="/calendario"
                  className="inline-flex justify-center rounded-full border border-[#211815]/15 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815]"
                >
                  Vedi il calendario
                </Link>
              ) : ctaHref && ctaLabel ? (
                <Link
                  href={ctaHref}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white"
                >
                  {ctaLabel}
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      </section>

    </main>
  );
}

function buildInfoItems({
  dateLabel,
  timeLabel,
  teachers,
  coupleOnly,
  observersAllowed,
  location,
}: {
  dateLabel: string | undefined;
  timeLabel: string | undefined;
  teachers: string[];
  coupleOnly: boolean;
  observersAllowed: boolean;
  location: string | undefined;
}) {
  const items: { label: string; value: string }[] = [];

  if (dateLabel) items.push({ label: "Data", value: dateLabel });
  if (timeLabel) items.push({ label: "Orario", value: timeLabel });

  items.push({ label: "Categoria", value: "Workshop" });

  if (teachers.length > 0) {
    items.push({ label: "Insegnanti", value: teachers.join(", ") });
  }

  items.push({
    label: "Formato",
    value: coupleOnly ? "Solo coppie" : "Aperto",
  });
  items.push({
    label: "Observer",
    value: observersAllowed ? "Ammessi" : "Non ammessi",
  });

  if (location) items.push({ label: "Luogo", value: location });

  return items;
}

function teachersFromTags(tags: string[]): string[] {
  const tagMap: [string, string][] = [
    ["peter soptik", "Peter Soptik"],
    ["sansei", "Sansei"],
    ["kurogami", "Kurogami"],
    ["shiawase", "Shiawase"],
    ["wildties", "Riccardo Wildties"],
    ["red sabbath", "Red Sabbath"],
  ];
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));

  return tagMap
    .filter(([tag]) => tagSet.has(tag))
    .map(([, name]) => name);
}
