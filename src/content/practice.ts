export type PracticeBranchKey = "practice" | "social";

export type PracticeActivity = {
  title: string;
  description: string;
  tags: string[];
  icons: string[];
  frequency: string;
};

export type PracticeBranch = {
  key: PracticeBranchKey;
  title: string;
  description: string;
  activities: PracticeActivity[];
};

export const practiceContent = {
  slug: "practice",
  title: "Pratica e socialità",
  navigationLabel: "Pratica e socialità",
  hero: {
    eyebrow: "Pratica e socialità",
    title: "Pratica e socialità",
    intro:
      "Spazi ricorrenti per allenarsi, consolidare, incontrare persone e partecipare alla vita dello spazio.",
    cta: {
      label: "Guarda le prossime date",
      href: "#prossime-date",
    },
  },
  branches: [
    {
      key: "practice",
      title: "Pratica",
      description:
        "Momenti pensati per ripetere, consolidare e approfondire. Non sostituiscono i percorsi formativi, ma aiutano a trasformare quello che hai imparato in esperienza reale.",
      activities: [
        {
          title: "Pratica assistita",
          description:
            "Uno spazio accompagnato per ripetere materiale già visto, fare domande e lavorare con più continuità sulle basi.",
          tags: ["Anche per single", "Aperta a chi inizia", "Richiede basi"],
          icons: ["User", "BookOpen", "Sprout"],
          frequency: "Una volta al mese",
        },
        {
          title: "Classi tematiche",
          description:
            "Incontri dedicati a un tema specifico scelto da Kurogami e Shiawase e comunicato in anticipo, con spiegazioni, demo e pratica guidata.",
          tags: ["Aperta a chi inizia", "Richiede basi", "Con demo"],
          icons: ["Users", "BookOpen", "Sprout"],
          frequency: "Ogni due mesi",
        },
      ],
    },
    {
      key: "social",
      title: "Socialità",
      description:
        "Momenti per vivere lo spazio, incontrare persone, osservare, praticare liberamente e prendere parte alla community.",
      activities: [
        {
          title: "Rope Jam",
          description:
            "Uno spazio libero di pratica e incontro, con sessioni, musica, atmosfera e possibilità di osservare o legare nel rispetto dello spazio condiviso.",
          tags: ["Anche per single", "Aperta a chi inizia", "Observer ammessi"],
          icons: ["Eye", "Sprout", "User"],
          frequency: "Una volta al mese",
        },
        {
          title: "Open Day",
          description:
            "Una giornata lunga nel weekend per conoscere lo spazio, praticare, osservare e partecipare a laboratori o attività speciali.",
          tags: ["Anche per single", "Aperta a chi inizia", "Observer ammessi", "Giornata intera"],
          icons: ["Eye", "Sprout", "User"],
          frequency: "4 volte all'anno",
        },
        {
          title: "Aperi-bottom",
          description:
            "Un incontro dedicato ai bottom, con temi di confronto sul bottoming e momenti sociali per parlare, ascoltare e condividere esperienze.",
          tags: ["Per bottom", "Aperto a chi inizia", "Incontro tematico", "Momento sociale"],
          icons: ["Ribbon", "Sprout", "User"],
          frequency: "Ogni due mesi",
        },
      ],
    },
  ] satisfies PracticeBranch[],
  dates: {
    title: "Prossime date",
    cta: {
      label: "Guarda il calendario completo",
      href: "/calendario",
    },
  },
  dashboard: {
    text: "Accedi alla dashboard per vedere iscrizioni, eventi salvati e attività consigliate.",
    cta: {
      label: "Vai alla dashboard",
      href: "/dashboard",
    },
  },
};

const practiceContentEn = {
  slug: "practice",
  title: "Practice & Community",
  navigationLabel: "Practice & Community",
  hero: {
    eyebrow: "Practice & Community",
    title: "Practice & Community",
    intro:
      "Regular sessions to train, consolidate, meet people and take part in the life of the venue.",
    cta: { label: "View upcoming dates", href: "#prossime-date" },
  },
  branches: [
    {
      key: "practice" as PracticeBranchKey,
      title: "Practice",
      description:
        "Moments designed to repeat, consolidate and deepen. They don't replace the structured programs, but help turn what you have learned into real experience.",
      activities: [
        {
          title: "Assisted Practice",
          description:
            "An accompanied space to repeat material already covered, ask questions and work with more continuity on the basics.",
          tags: ["You can join without a partner", "Open to beginners", "Requires basics"],
          icons: ["User", "BookOpen", "Sprout"],
          frequency: "Once a month",
        },
        {
          title: "Themed Classes",
          description:
            "Sessions dedicated to a specific topic chosen by Kurogami and Shiawase and announced in advance, with explanations, demos and guided practice.",
          tags: ["Open to beginners", "Requires basics", "With demo"],
          icons: ["Users", "BookOpen", "Sprout"],
          frequency: "Every two months",
        },
      ],
    },
    {
      key: "social" as PracticeBranchKey,
      title: "Community",
      description:
        "Moments to experience the venue, meet people, observe, practice freely and take part in community life.",
      activities: [
        {
          title: "Rope Jam",
          description:
            "A free practice and gathering space, with sessions, music, atmosphere and the possibility to observe or tie in respect of the shared space.",
          tags: ["You can join without a partner", "Open to beginners", "Observers welcome"],
          icons: ["Eye", "Sprout", "User"],
          frequency: "Once a month",
        },
        {
          title: "Open Day",
          description:
            "A long weekend day to discover the venue, practice, observe and take part in workshops or special activities.",
          tags: ["You can join without a partner", "Open to beginners", "Observers welcome", "Full day"],
          icons: ["Eye", "Sprout", "User"],
          frequency: "4 times a year",
        },
        {
          title: "Aperi-bottom",
          description:
            "A gathering dedicated to bottoms, with topics about the bottom experience and social moments to talk, listen and share.",
          tags: ["For bottoms", "Open to beginners", "Themed gathering", "Social moment"],
          icons: ["Ribbon", "Sprout", "User"],
          frequency: "Every two months",
        },
      ],
    },
  ] satisfies PracticeBranch[],
  dates: {
    title: "Upcoming dates",
    cta: { label: "View full calendar", href: "/calendario" },
  },
  dashboard: {
    text: "Access your dashboard to view bookings, saved events and recommended activities.",
    cta: { label: "Go to dashboard", href: "/dashboard" },
  },
};

export const practiceBilingual = {
  it: practiceContent,
  en: practiceContentEn,
};
