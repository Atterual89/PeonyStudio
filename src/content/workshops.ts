export type WorkshopSource = "ticket-tailor" | "calendar-preview" | "external";
export type WorkshopStatus = "announced" | "tickets-open" | "sold-out" | "external-info";

export type Workshop = {
  slug: string;
  title: string;
  teachers: string[];
  source: WorkshopSource;
  status: WorkshopStatus;
  international: boolean;
  coupleOnly: boolean;
  observersAllowed: boolean;
  dateLabel?: string;
  timeLabel?: string;
  location?: string;
  shortDescription?: string;
  fullDescription?: string;
  prerequisites?: string;
  ticketTailorUrl?: string;
  externalUrl?: string;
  ctaLabel: string;
  image?: string;
};

export const workshops: Workshop[] = [
  {
    slug: "neck-rope",
    title: "Neck Rope",
    teachers: ["Peter Soptik", "Sansei"],
    source: "calendar-preview",
    status: "announced",
    international: true,
    coupleOnly: true,
    observersAllowed: false,
    dateLabel: "In programma — data da confermare",
    location: "Peony Studio · Torino",
    shortDescription:
      "Workshop intensivo dedicato alle tecniche di neck rope con Peter Soptik e Sansei. Un approfondimento strutturato per chi vuole esplorare questa dimensione del kinbaku con guida esperta.",
    prerequisites: "Classe 1 completata. Esperienza con sospensioni richiesta.",
    ctaLabel: "In programma — biglietti non ancora disponibili",
  },
  {
    slug: "3-dimensions",
    title: "3 Dimensions",
    teachers: ["Kurogami", "Shiawase"],
    source: "calendar-preview",
    status: "announced",
    international: true,
    coupleOnly: true,
    observersAllowed: false,
    dateLabel: "In programma — data da confermare",
    location: "Peony Studio · Torino",
    shortDescription:
      "Workshop intensivo sulle tre dimensioni del kinbaku con Kurogami e Shiawase. Un percorso dedicato all'integrazione spaziale, estetica e relazionale del legame.",
    prerequisites: "Esperienza intermedia richiesta. Classe 1 completata.",
    ctaLabel: "In programma — biglietti non ancora disponibili",
  },
  {
    slug: "wildties-red-sabbath",
    title: "Workshop con Riccardo Wildties & Red Sabbath",
    teachers: ["Riccardo Wildties", "Red Sabbath"],
    source: "external",
    status: "external-info",
    international: false,
    coupleOnly: true,
    observersAllowed: false,
    dateLabel: "In programma",
    location: "Peony Studio · Torino",
    shortDescription:
      "Workshop con Riccardo Wildties e Red Sabbath. Contenuti, date e modalità di iscrizione disponibili tramite i canali dedicati.",
    prerequisites: "Basi di kinbaku richieste. Dettagli comunicati in fase di iscrizione.",
    externalUrl: "https://www.instagram.com/alexandrarouge93/",
    ctaLabel: "Info e iscrizioni",
  },
];

export function getWorkshopBySlug(slug: string): Workshop | undefined {
  return workshops.find((w) => w.slug === slug);
}

export function getStatusLabel(status: WorkshopStatus): string {
  const labels: Record<WorkshopStatus, string> = {
    announced: "In programma",
    "tickets-open": "Biglietti disponibili",
    "sold-out": "Esaurito",
    "external-info": "Info esterne",
  };

  return labels[status];
}
