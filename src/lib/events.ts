import {
  getTicketTailorEvents,
  inferEventCategory,
  TICKET_TAILOR_PUBLIC_URL,
} from "@/lib/ticketTailor";

export type PeonyEventCategory =
  | "percorso"
  | "pratica"
  | "community"
  | "workshop"
  | "chiusura"
  | "trasferta"
  | "altro";

export type PeonyEvent = {
  id: string;
  slug: string;
  source: "ticket-tailor" | "local";
  date: string;
  endDate?: string | null;
  title: string;
  code?: string;
  category: PeonyEventCategory;
  description?: string;
  shortDescription?: string;
  tags?: string[];
  isPublic: boolean;
  showOnHome?: boolean;
  featured?: boolean;
  bookingUrl?: string;
  imageUrl?: string;
  ticketTailorId?: string;
  status?: string;
  sourceUrl?: string;
  startTime?: string;
  endTime?: string;
  timeLabel?: string;
  dateLabel?: string;
  durationLabel?: string;
  workshopSlug?: string;
  rawTicketTailorPayload?: Record<string, unknown>;
};

export type EventsByMonth = {
  key: string;
  label: string;
  events: PeonyEvent[];
};

export type PeonyEventCard = {
  slug: string;
  category: string;
  title: string;
  date: string;
  detail?: string;
  image?: string;
  eventUrl: string;
  target?: string;
  bookingUrl?: string;
};

const fallbackBookingUrl = TICKET_TAILOR_PUBLIC_URL;

export async function getAllEvents(): Promise<PeonyEvent[]> {
  const [ticketTailorEvents] = await Promise.all([getTicketTailorEvents()]);
  const normalizedTicketTailorEvents = ticketTailorEvents.map(finalizeEvent);
  const events = normalizedTicketTailorEvents.sort(compareEventsByDate);

  debugEvents("getAllEvents", {
    ticketTailor: normalizedTicketTailorEvents.length,
    publicSource: events.length,
  });

  return events;
}

export async function getWorkshopEvents(): Promise<PeonyEvent[]> {
  const events = await getPublicEvents();
  const today = getTodayIsoDate();

  return events.filter((event) => isWorkshopEvent(event) && event.date >= today);
}

export function isWorkshopEvent(event: Pick<PeonyEvent, "category">): boolean {
  return event.category === "workshop";
}

export async function getPublicEvents(): Promise<PeonyEvent[]> {
  const events = await getAllEvents();
  const publicEvents = events.filter(
    (event) =>
      event.isPublic === true &&
      event.category !== "trasferta" &&
      event.category !== "chiusura",
  );

  debugEvents("getPublicEvents", { public: publicEvents.length });

  return publicEvents;
}

export async function getUpcomingEvents(limit = 5): Promise<PeonyEvent[]> {
  const events = await getPublicEvents();
  const today = getTodayIsoDate();

  const upcomingEvents = events
    .filter((event) => event.date >= today)
    .filter((event) => event.showOnHome !== false)
    .slice(0, limit);

  debugEvents("getUpcomingEvents", { upcoming: upcomingEvents.length, limit });

  return upcomingEvents;
}

export async function getFeaturedEvent(): Promise<PeonyEvent | null> {
  const upcoming = await getUpcomingEvents(12);

  return (
    upcoming.find((event) => event.featured) ??
    upcoming.find((event) => event.showOnHome !== false) ??
    null
  );
}

export function toEventCard(event: PeonyEvent): PeonyEventCard {
  return {
    slug: event.slug,
    category: event.code ?? categoryLabels[event.category] ?? "Evento",
    title: event.title,
    date: formatEventDate(event.date),
    detail: event.shortDescription,
    image: event.imageUrl ?? getEventImage(event),
    eventUrl: `/eventi/${event.slug}`,
    target: `${event.date}T21:00:00+02:00`,
    bookingUrl: event.bookingUrl ?? fallbackBookingUrl,
  };
}

export async function getEventsByMonth(): Promise<EventsByMonth[]> {
  const events = await getPublicEvents();
  const grouped = events.reduce<Map<string, PeonyEvent[]>>((months, event) => {
    const key = event.date.slice(0, 7);
    const group = months.get(key) ?? [];
    group.push(event);
    months.set(key, group);
    return months;
  }, new Map());

  return Array.from(grouped.entries()).map(([key, eventsForMonth]) => ({
    key,
    label: formatMonthLabel(key),
    events: eventsForMonth.sort(compareEventsByDate),
  }));
}

function finalizeEvent(event: PeonyEvent): PeonyEvent {
  const rawDescription = event.description
    ? stripHtmlToText(event.description)
    : undefined;
  const extractedDescription = extractTagsDirective(rawDescription);
  const description = extractedDescription.text || undefined;
  const rawShortDescription = event.shortDescription
    ? stripHtmlToText(event.shortDescription)
    : description;
  const extractedShortDescription = extractTagsDirective(rawShortDescription);
  const shortDescription = extractedShortDescription.text
    ? truncateText(extractedShortDescription.text, 280)
    : undefined;
  const baseEvent: PeonyEvent = {
    ...event,
    category: event.category ?? inferEventCategory(event.title),
    description,
    shortDescription,
    slug: event.slug ?? createEventSlug(event.title, event.date),
    tags: [
      ...(event.tags ?? []),
      ...extractedDescription.tags,
      ...extractedShortDescription.tags,
    ],
    dateLabel: buildDateLabel(event.date, event.endDate),
    durationLabel: buildDurationLabel(event.date, event.endDate),
    workshopSlug:
      event.category === "workshop"
        ? (event.workshopSlug ?? inferWorkshopSlug(event.title))
        : undefined,
  };

  return {
    ...baseEvent,
    tags: inferEventTags(baseEvent),
  };
}

export function createEventSlug(title: string, date: string) {
  const titlePart = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return `${titlePart || "evento"}-${date}`;
}

export function inferEventTags(
  event: Pick<
    PeonyEvent,
    "title" | "category" | "code" | "description" | "shortDescription" | "tags"
  >,
) {
  const tags = new Set<string>();
  const text = normalizeSearchText(
    [
      event.title,
      event.code,
      event.category,
      event.description,
      event.shortDescription,
    ]
      .filter(Boolean)
      .join(" "),
  );

  for (const tag of event.tags ?? []) {
    const normalizedTag = normalizeTag(tag);
    if (normalizedTag) {
      tags.add(normalizedTag);
    }
  }

  if (text.includes("open day")) {
    addTags(tags, [
      "principianti",
      "observer ammessi",
      "anche per single",
      "community",
    ]);
  }

  if (text.includes("rope jam")) {
    addTags(tags, ["community", "anche per single", "pratica libera"]);
  }

  if (
    text.includes("aperibottom") ||
    text.includes("aperi bottom") ||
    text.includes("aperi-bottom")
  ) {
    addTags(tags, ["bottom", "community"]);
  }

  if (text.includes("pratica assistita") || text.includes("pratica guidata")) {
    addTags(tags, ["percorso", "pratica", "richiede basi", "anche per single"]);
  }

  if (text.includes("classe tematica") || text.includes("classi tematiche")) {
    addTags(tags, ["pratica", "con demo", "richiede basi"]);
  }

  if (
    text.includes("foundation 1") ||
    text.includes("base 1") ||
    text.includes(" b1 ")
  ) {
    addTags(tags, ["percorso", "principianti", "anche per single"]);
  }

  if (
    text.includes("foundation 2") ||
    text.includes("base 2") ||
    text.includes(" b2 ")
  ) {
    addTags(tags, ["percorso", "richiede basi"]);
  }

  if (
    text.includes("class 1+") ||
    text.includes("classe 1+") ||
    text.includes("classe #1+") ||
    text.includes("class #1+")
  ) {
    addTags(tags, ["percorso", "avanzato", "ricerca personale"]);
  } else if (
    text.includes("class 1") ||
    text.includes("classe 1") ||
    text.includes("classe #1") ||
    text.includes("class #1")
  ) {
    addTags(tags, ["percorso", "richiede basi", "sospensioni"]);
  }

  if (text.includes("neck rope")) {
    addTags(tags, ["workshop", "neck rope", "peter soptik", "sansei"]);
  }

  if (
    text.includes("workshop kinbaku luxuria") ||
    text.includes("kinbaku luxuria") ||
    text.includes(" kl ")
  ) {
    addTags(tags, ["workshop", "kinbaku luxuria"]);
  } else if (text.includes("3 dimensions") || text.includes("three dimensions")) {
    addTags(tags, ["workshop", "3 dimensions"]);
  } else if (text.includes("workshop")) {
    addTags(tags, ["workshop"]);
  }

  if (
    event.category &&
    !["altro", "chiusura", "trasferta"].includes(event.category)
  ) {
    tags.add(event.category);
  }

  return Array.from(tags);
}

function addTags(tags: Set<string>, values: string[]) {
  for (const value of values) {
    const normalizedTag = normalizeTag(value);
    if (normalizedTag) {
      tags.add(normalizedTag);
    }
  }
}

function normalizeTag(tag: string) {
  return tag
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(text: string) {
  return ` ${text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[#/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function extractTagsDirective(text?: string) {
  if (!text) {
    return { text: "", tags: [] as string[] };
  }

  const tags: string[] = [];
  const cleanText = text
    .replace(/\[tags:\s*([^\]]+)\]/gi, (_, value: string) => {
      tags.push(
        ...value
          .split(",")
          .map(normalizeTag)
          .filter(Boolean),
      );
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  return { text: cleanText, tags };
}

function compareEventsByDate(a: PeonyEvent, b: PeonyEvent) {
  return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatEventDate(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00+02:00`));
}

function buildDateLabel(date: string, endDate?: string | null): string {
  if (!endDate || endDate === date) {
    return formatEventDate(date);
  }

  const start = new Date(`${date}T12:00:00+02:00`);
  const end = new Date(`${endDate}T12:00:00+02:00`);

  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    const monthYear = new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric",
    }).format(start);

    return `${start.getDate()}–${end.getDate()} ${monthYear}`;
  }

  const fmtDay = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
  });
  const fmtDayYear = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `${fmtDay.format(start)} – ${fmtDayYear.format(end)}`;
}

function inferWorkshopSlug(title: string): string | undefined {
  const t = title.toLowerCase();

  if (t.includes("neck rope")) return "neck-rope";
  if (t.includes("3 dimensions") || t.includes("three dimensions")) return "3-dimensions";
  if (t.includes("wildties") || t.includes("red sabbath")) return "wildties-red-sabbath";

  return undefined;
}

function buildDurationLabel(date: string, endDate?: string | null): string | undefined {
  if (!endDate || endDate === date) return undefined;

  const start = new Date(`${date}T12:00:00+02:00`);
  const end = new Date(`${endDate}T12:00:00+02:00`);
  const diffDays =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return diffDays >= 2 ? `${diffDays} giorni` : undefined;
}

const categoryLabels: Record<PeonyEventCategory, string> = {
  percorso: "Percorso",
  pratica: "Pratica",
  community: "Community",
  workshop: "Workshop",
  chiusura: "Chiusura",
  trasferta: "Trasferta",
  altro: "Evento",
};

function getEventImage(event: PeonyEvent) {
  const title = event.title.toLowerCase();

  if (title.includes("rope jam")) {
    return "/images/home/event-rope-jam.jpg";
  }

  if (title.includes("foundation")) {
    return "/images/home/event-foundation.jpg";
  }

  if (
    title.includes("pratica") ||
    title.includes("classe tematica") ||
    title.includes("classi tematiche")
  ) {
    return "/images/home/event-practice.jpg";
  }

  return "/images/home/event-class.jpg";
}

export function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(h[1-6]|p|div|section|article)>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export function truncateText(text: string, maxLength = 210): string {
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  const truncated = cleanText.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${truncated || cleanText.slice(0, maxLength).trim()}…`;
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    quot: '"',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    hellip: "…",
  };

  return text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, entity: string) => entities[entity] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function debugEvents(label: string, values: Record<string, number>) {
  if (process.env.DEBUG_EVENTS !== "true") {
    return;
  }

  console.info(`[events] ${label}`, values);
}
