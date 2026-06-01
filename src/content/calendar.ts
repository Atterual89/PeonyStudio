type CalendarPreviewEvent = {
  title: string;
  meta: string;
  description: string;
};

export const calendarContent = {
  slug: "calendar",
  title: "Calendario",
  navigationLabel: "Calendario",
  hero: {
    eyebrow: "Date e prenotazioni",
    title: "Calendario",
    intro:
      "Le date vengono aggiornate periodicamente. Per disponibilità, iscrizioni e dettagli aggiornati consulta Ticket Tailor.",
  },
  booking: {
    label: "Apri Ticket Tailor",
    href: "https://www.tickettailor.com/events/peonystudio1",
  },
  previewEvents: [] as CalendarPreviewEvent[],
};
