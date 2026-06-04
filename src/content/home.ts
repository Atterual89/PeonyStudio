export type HomeVerticalPathItem = {
  number: string;
  title: string;
  summary: string;
  href: string;
};

export type HomeArea = {
  title: string;
  description: string;
  href: string;
};

export type HomeEvent = {
  category: string;
  title: string;
  date: string;
  detail: string;
};

export type HomePathCard = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
};

export const homeContent = {
  hero: {
    eyebrow: "Kinbaku — Torino",
    title: "Peony Studio — Kinbaku venue · Torino",
    description:
      "Peony Studio unisce formazione, pratica e incontri in uno spazio dedicato alle corde.",
    primaryCta: {
      label: "Voglio iniziare",
      href: "/percorsi",
    },
    secondaryCta: {
      label: "Guarda il calendario",
      href: "/calendario",
    },
  },
  verticalPath: [
    {
      number: "01",
      title: "Open Day",
      summary: "Scopri Peony",
      href: "/percorsi",
    },
    {
      number: "02",
      title: "Foundation 1",
      summary: "Il tuo ingresso",
      href: "/percorsi",
    },
    {
      number: "03",
      title: "Pratica assistita",
      summary: "Allena con guidance",
      href: "/percorsi/socialita",
    },
    {
      number: "04",
      title: "Community",
      summary: "Rope Jam, Peony Night",
      href: "/percorsi/socialita",
    },
    {
      number: "05",
      title: "Classe 1+",
      summary: "Approfondisci",
      href: "/percorsi",
    },
  ] satisfies HomeVerticalPathItem[],
  splitIntro: {
    primary: {
      title: "Non sai da dove iniziare?",
      cta: {
        label: "Inizia da qui",
        href: "/percorsi",
      },
    },
    secondary: {
      eyebrow: "Sei già praticante?",
      title: "Non solo principianti.",
      cta: {
        label: "Vedi attività",
        href: "/percorsi/socialita",
      },
    },
  },
  areas: [
    {
      title: "Percorsi",
      description: "Percorsi strutturati",
      href: "/percorsi",
    },
    {
      title: "Pratica",
      description: "Allenamenti guidati",
      href: "/percorsi/socialita",
    },
    {
      title: "Community",
      description: "Spazi di incontro",
      href: "/percorsi/socialita",
    },
    {
      title: "Workshop",
      description: "Approfondimenti",
      href: "/workshop",
    },
    {
      title: "Exploration",
      description: "Ricerca esperienziale",
      href: "/workshop",
    },
    {
      title: "Cultura",
      description: "Cinema, storia, talk",
      href: "/workshop",
    },
    {
      title: "Shop",
      description: "Corde, kit, materiali",
      href: "/shop",
    },
  ] satisfies HomeArea[],
  philosophy: {
    title: "Basi chiare, una voce che diventa tua.",
    concepts: [
      {
        word: "Tecnica",
        desc: "Basi chiare, forma consapevole, una voce che ti guida. Il primo passo per costruire una pratica solida.",
      },
      {
        word: "Estetica",
        desc: "Ricerca della bellezza attraverso la pratica e l'attenzione al dettaglio. Ogni legatura racconta qualcosa.",
      },
      {
        word: "Personalità",
        desc: "Trovare la tua voce, il tuo modo di legare. Il percorso diventa espressione.",
      },
    ],
    cta: {
      label: "Scopri di più",
      href: "/peony",
    },
  },
  studioPreview: {
    title: "Uno spazio a Torino per praticare, studiare e incontrarsi.",
    features: [
      "Lounge",
      "Cucina",
      "Bamboo / Hashira",
      "Tappeti morbidi",
    ],
    cta: {
      label: "Scopri lo studio",
      href: "/peony",
    },
  },
  finalCta: {
    title: "Pronto/a a fare il primo passo?",
    intro: "Siamo qui per rispondere a ogni tua domanda.",
    primaryCta: {
      label: "Vedi prossimo Open Day",
      href: "/calendario",
    },
    secondaryCta: {
      label: "Scrivici",
      href: "/peony#contatti",
    },
  },
  footer: {
    brand: "Peony Studio",
    columns: [
      {
        title: "Link utili",
        links: [
          { label: "Come iniziare", href: "/come-iniziare" },
          { label: "Percorsi", href: "/percorsi" },
          { label: "Calendario", href: "/calendario" },
        ],
      },
      {
        title: "Seguici",
        links: [
          { label: "Instagram", href: "https://www.instagram.com/" },
          { label: "Peony", href: "/peony" },
        ],
      },
      {
        title: "Newsletter",
        links: [{ label: "Placeholder newsletter", href: "/" }],
      },
    ],
    copyright: "© 2025 Peony Studio",
  },

  // Compatibility data for older placeholder components that still live in the app.
  splitEntry: {
    primary: {
      title: "Non sai da dove iniziare?",
      cta: {
        label: "Inizia da qui",
        href: "/percorsi",
      },
    },
    secondary: {
      eyebrow: "Sei già praticante?",
      title: "Non solo principianti.",
      cta: {
        label: "Vedi attività",
        href: "/percorsi/socialita",
      },
    },
  },
  pathCards: [
    {
      eyebrow: "01",
      title: "Come iniziare",
      description: "Open Day, Foundation e primi passi nello studio.",
      href: "/percorsi",
    },
    {
      eyebrow: "02",
      title: "Percorsi",
      description: "Percorsi progressivi, classi e approfondimenti.",
      href: "/percorsi",
    },
    {
      eyebrow: "03",
      title: "Pratica",
      description: "Pratica assistita, rope jam e momenti community.",
      href: "/percorsi/socialita",
    },
  ] satisfies HomePathCard[],
  beginnerPath: {
    eyebrow: "Come iniziare",
    title: "Un percorso semplice per entrare nello studio.",
    intro:
      "Open Day, Foundation e pratica assistita aiutano a trovare il primo passo giusto.",
    steps: ["Open Day", "Foundation", "Pratica assistita", "Rope Jam"],
    cta: {
      label: "Scopri come iniziare",
      href: "/percorsi",
    },
  },
  calendarPreview: {
    eyebrow: "Prossimi appuntamenti",
    title: "Classi, pratiche e momenti community.",
    intro: "Una selezione statica temporanea dagli appuntamenti Peony Studio.",
    cta: {
      label: "Vai al calendario",
      href: "/calendario",
    },
  },
  spacePreview: {
    eyebrow: "Lo spazio",
    title: "Uno studio a Torino pensato per praticare con calma.",
    intro:
      "Sala principale, lounge, bamboo, hashira e un ambiente curato e accogliente.",
    cta: {
      label: "Conosci Peony",
      href: "/peony",
    },
  },
  studioSpace: {
    title: "Il nostro spazio a Torino",
    features: [
      "Lounge e area relax",
      "Cucina attrezzata",
      "Bamboo e hashira",
      "Ambiente curato e sicuro",
    ],
    cta: {
      label: "Scopri lo studio",
      href: "/peony",
    },
  },
  closingCta: {
    title: "Pronto/a a fare il primo passo?",
    intro: "Siamo qui per rispondere a ogni tua domanda.",
    primaryCta: {
      label: "Vedi prossimo Open Day",
      href: "/calendario",
    },
    secondaryCta: {
      label: "Scrivici",
      href: "/peony#contatti",
    },
  },
};
