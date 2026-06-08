import {
  WorkshopPageClient,
  type WorkshopCardData,
} from "@/components/workshop/WorkshopPageClient";
import { getWorkshopBySlug } from "@/content/workshops";
import { getWorkshopEvents, type PeonyEvent } from "@/lib/events";

export default async function WorkshopPage() {
  const liveEvents = await getWorkshopEvents();
  const allCards: WorkshopCardData[] = liveEvents.map(buildLiveCard);

  return <WorkshopPageClient cards={allCards} />;
}

function buildLiveCard(event: PeonyEvent): WorkshopCardData {
  const enrichment = event.workshopSlug
    ? getWorkshopBySlug(event.workshopSlug)
    : undefined;

  return {
    id: event.id,
    detailHref: event.workshopSlug
      ? `/workshop/${event.workshopSlug}`
      : `/eventi/${event.slug}`,
    title: event.title,
    teachers: enrichment?.teachers ?? teachersFromTags(event.tags ?? []),
    dateLabel: event.dateLabel ?? enrichment?.dateLabel,
    timeLabel: event.timeLabel ?? enrichment?.timeLabel,
    isPreview: false,
    international: enrichment?.international ?? true,
    coupleOnly: enrichment?.coupleOnly ?? true,
    imageUrl: event.imageUrl ?? enrichment?.image,
    description: event.shortDescription ?? event.description,
  };
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
