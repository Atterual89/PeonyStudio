export type PracticeBranchKey = "practice" | "social";

export type PracticeActivity = {
  title: string;
  description: string;
  tags: string[];
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
      "Spazi ricorrenti per allenarsi, consolidare, incontrare persone e partecipare alla vita dello studio.",
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
          tags: [
            "Anche per single",
            "Aperta a chi inizia",
            "Richiede basi",
          ],
        },
        {
          title: "Classi tematiche",
          description:
            "Incontri dedicati a un tema specifico scelto da Kurogami e Shiawase e comunicato in anticipo, con spiegazioni, demo e pratica guidata.",
          tags: ["Aperta a chi inizia", "Richiede basi", "Con demo"],
        },
      ],
    },
    {
      key: "social",
      title: "Socialità",
      description:
        "Momenti per vivere lo studio, incontrare persone, osservare, praticare liberamente e prendere parte alla community.",
      activities: [
        {
          title: "Rope Jam",
          description:
            "Uno spazio libero di pratica e incontro, con sessioni, musica, atmosfera e possibilità di osservare o legare nel rispetto dello spazio condiviso.",
          tags: [
            "Anche per single",
            "Aperta a chi inizia",
            "Observer ammessi",
          ],
        },
        {
          title: "Open Day",
          description:
            "Una giornata lunga nel weekend per conoscere lo studio, praticare, osservare e partecipare a laboratori o attività speciali.",
          tags: [
            "Anche per single",
            "Aperta a chi inizia",
            "Observer ammessi",
            "Giornata intera",
          ],
        },
        {
          title: "Aperi-bottom",
          description:
            "Un incontro dedicato ai bottom, con temi di confronto sul bottoming e momenti sociali per parlare, ascoltare e condividere esperienze.",
          tags: [
            "Per bottom",
            "Aperto a chi inizia",
            "Incontro tematico",
            "Momento sociale",
          ],
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
