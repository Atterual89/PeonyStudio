export type HomePathCard = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
};

export const homeContent = {
  hero: {
    eyebrow: "Kinbaku · Torino",
    title: "Uno spazio per imparare, praticare e crescere nelle corde.",
    description:
      "Peony Studio è una scuola e community dedicata al kinbaku: tecnica, consapevolezza, ricerca e continuità nella pratica.",
    primaryCta: {
      label: "Come iniziare",
      href: "/come-iniziare",
    },
    secondaryCta: {
      label: "Calendario",
      href: "/calendario",
    },
  },
  pathCards: [
    {
      eyebrow: "01",
      title: "Come iniziare",
      description:
        "Open day, Foundation e primi passi per entrare nello studio con chiarezza.",
      href: "/come-iniziare",
    },
    {
      eyebrow: "02",
      title: "Programmi",
      description:
        "Percorsi progressivi: Foundation, Laydown, classi tematiche e workshop.",
      href: "/programmi",
    },
    {
      eyebrow: "03",
      title: "Pratica",
      description:
        "Rope jam, pratica assistita e momenti community per continuare a crescere.",
      href: "/pratica",
    },
  ] satisfies HomePathCard[],
  beginnerPath: {
    eyebrow: "Come iniziare",
    title: "Un percorso semplice per entrare nello studio.",
    intro:
      "Il primo contatto passa da Open Day e introduzioni, poi continua con Foundation e momenti di pratica assistita o rope jam.",
    steps: ["Open Day", "Foundation", "Pratica assistita / rope jam"],
    cta: {
      label: "Scopri come iniziare",
      href: "/come-iniziare",
    },
  },
  calendarPreview: {
    eyebrow: "Prossimi appuntamenti",
    title: "Classi, pratiche e momenti community.",
    intro:
      "Una selezione statica temporanea dagli appuntamenti Peony Studio. Il calendario completo arriverà nella pagina dedicata.",
    cta: {
      label: "Vai al calendario",
      href: "/calendario",
    },
  },
  spacePreview: {
    eyebrow: "Lo spazio",
    title: "Uno studio a Torino pensato per praticare con calma.",
    intro:
      "Peony Studio accoglie classi, workshop e pratica in un ambiente morbido: sala principale con bambù e hashira, lounge e spazi per prepararsi con agio.",
    cta: {
      label: "Conosci Peony",
      href: "/peony",
    },
  },
  finalCta: {
    title: "Se vuoi avvicinarti alle corde, puoi iniziare da qui.",
    intro:
      "Trova il primo passo più adatto al tuo livello e al tuo momento di pratica.",
    cta: {
      label: "Come iniziare",
      href: "/come-iniziare",
    },
  },
  sourceNotes: [
    "Current homepage copy is intentionally kept almost identical for this phase.",
    "Future copy should draw from the live Peony Studio site: technique, connection, aesthetics, Kinbaku LuXuria, semenawa, rope jams, guided practice, workshops, and the Turin studio.",
  ],
};
