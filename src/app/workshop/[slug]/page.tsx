import { notFound } from "next/navigation";

import { WorkshopDetailPageContent } from "@/components/workshop/WorkshopDetailPageContent";
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
  const teachers = staticWorkshop?.teachers ?? teachersFromTags(liveEvent?.tags ?? []);
  const dateLabel = liveEvent?.dateLabel ?? staticWorkshop?.dateLabel;
  const timeLabel = liveEvent?.timeLabel ?? staticWorkshop?.timeLabel;
  const shortDescription = liveEvent?.shortDescription ?? staticWorkshop?.shortDescription;
  const prerequisites = staticWorkshop?.prerequisites;
  const location = staticWorkshop?.location;
  const international = staticWorkshop?.international ?? true;
  const coupleOnly = staticWorkshop?.coupleOnly ?? true;
  const observersAllowed = staticWorkshop?.observersAllowed ?? false;
  const imageUrl = liveEvent?.imageUrl ?? staticWorkshop?.image;
  const hasHeroImage = Boolean(liveEvent?.imageUrl);

  const hasTTBooking =
    liveEvent?.source === "ticket-tailor" &&
    Boolean(liveEvent.bookingUrl) &&
    liveEvent.bookingUrl !== TICKET_TAILOR_PUBLIC_URL;

  const isExternal = !liveEvent && staticWorkshop?.source === "external";
  const isPreview = !hasTTBooking && !isExternal;

  const ctaHref = hasTTBooking
    ? liveEvent.bookingUrl
    : isExternal
      ? (staticWorkshop?.externalUrl ?? null)
      : null;

  return (
    <WorkshopDetailPageContent
      title={title}
      teachers={teachers}
      dateLabel={dateLabel}
      timeLabel={timeLabel}
      shortDescription={shortDescription}
      prerequisites={prerequisites}
      location={location}
      imageUrl={imageUrl}
      hasHeroImage={hasHeroImage}
      international={international}
      coupleOnly={coupleOnly}
      observersAllowed={observersAllowed}
      hasTTBooking={hasTTBooking}
      isExternal={isExternal}
      isPreview={isPreview}
      ctaHref={ctaHref ?? null}
      staticCtaLabel={staticWorkshop?.ctaLabel}
    />
  );
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
  return tagMap.filter(([tag]) => tagSet.has(tag)).map(([, name]) => name);
}
