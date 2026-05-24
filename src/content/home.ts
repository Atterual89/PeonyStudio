export type HomePathCard = {
  eyebrow: string;
  title: string;
  description: string;
};

export const homeContent = {
  hero: {
    eyebrow: "Kinbaku · Torino",
    title: "Uno spazio per imparare, praticare e crescere nelle corde.",
    description:
      "Peony Studio è una scuola e community dedicata al kinbaku: tecnica, consapevolezza, ricerca e continuità nella pratica.",
    primaryCta: {
      label: "Come iniziare",
      href: "#start",
    },
    secondaryCta: {
      label: "Guarda il calendario",
      href: "#calendar",
    },
  },
  pathCards: [
    {
      eyebrow: "01",
      title: "Come iniziare",
      description:
        "Open day, Foundation e primi passi per entrare nello studio con chiarezza.",
    },
    {
      eyebrow: "02",
      title: "Programmi",
      description:
        "Percorsi progressivi: Foundation, Laydown, classi tematiche e workshop.",
    },
    {
      eyebrow: "03",
      title: "Pratica",
      description:
        "Rope jam, pratica assistita e momenti community per continuare a crescere.",
    },
  ] satisfies HomePathCard[],
  sourceNotes: [
    "Current homepage copy is intentionally kept almost identical for this phase.",
    "Future copy should draw from the live Peony Studio site: technique, connection, aesthetics, Kinbaku LuXuria, semenawa, rope jams, guided practice, workshops, and the Turin studio.",
  ],
};
