export type SoftCta = {
  label: string;
  href: string;
};

export type QuizAnswerKey = "A" | "B" | "C" | "D";
export type QuizBranchKey = "explorer" | "rigger" | "bottom" | "both";
export type QuizResultKey =
  | "EXPLORER"
  | "RIGGER_FOUNDATION"
  | "RIGGER_PRACTICE"
  | "BOTTOM_EXPLORER"
  | "BOTTOM_PRACTICE"
  | "BOTTOM_RESEARCH"
  | "ROPE_RESEARCH"
  | "MIXED_RESEARCH";

export type QuizAnswer = {
  key: QuizAnswerKey;
  label: string;
};

export type QuizFirstAnswer = QuizAnswer & {
  branch: QuizBranchKey;
};

export type QuizQuestion = {
  question: string;
  answers: QuizAnswer[];
};

export type QuizFirstQuestion = {
  question: string;
  answers: QuizFirstAnswer[];
};

export type QuizBranch = {
  questions: QuizQuestion[];
};

export type QuizResult = {
  key: QuizResultKey;
  title: string;
  path: string;
  text: string;
  cta: SoftCta;
};

export type SimpleCard = {
  title: string;
  text: string;
  cta?: SoftCta;
};

export const howToStartContent = {
  slug: "how-to-start",
  title: "Come iniziare",
  navigationLabel: "Come iniziare",
  hero: {
    eyebrow: "Primi passi",
    title: "Come iniziare",
    intro:
      "Non devi sapere già quale corso scegliere. Rispondi a poche domande e trova il punto di partenza più adatto.",
    primaryCta: {
      label: "Fai il quiz",
      href: "#",
    },
    secondaryCta: {
      label: "Guarda il calendario",
      href: "/calendario",
    },
  },
  quiz: {
    eyebrow: "Quiz",
    title: "Che Peony student sei?",
    intro:
      "Un orientamento veloce per capire da dove partire.",
    firstQuestion: {
      question: "Da che punto vuoi iniziare?",
      answers: [
        {
          key: "A",
          label: "Vorrei conoscere lo spazio e capire che tipo di pratica fa per me",
          branch: "explorer",
        },
        {
          key: "B",
          label: "Vorrei imparare a legare",
          branch: "rigger",
        },
        {
          key: "C",
          label: "Vorrei stare nelle corde o esplorare il ruolo di bottom",
          branch: "bottom",
        },
        {
          key: "D",
          label: "Vorrei esplorare entrambi i lati",
          branch: "both",
        },
      ],
    } satisfies QuizFirstQuestion,
    branches: {
      explorer: {
        questions: [
          {
            question: "Cosa ti aiuterebbe di più ora?",
            answers: [
              { key: "A", label: "Osservare senza pressione" },
              { key: "B", label: "Capire corsi e livelli" },
              { key: "C", label: "Conoscere persone e ambiente" },
              { key: "D", label: "Vedere come si pratica dal vivo" },
            ],
          },
          {
            question: "Come immagini il primo contatto con Peony?",
            answers: [
              { key: "A", label: "Una serata aperta e informale" },
              { key: "B", label: "Un momento in cui fare domande" },
              { key: "C", label: "Guardare una pratica o una Rope Jam" },
              {
                key: "D",
                label: "Capire se posso iniziare anche senza partner",
              },
            ],
          },
        ],
      },
      rigger: {
        questions: [
          {
            question: "Che esperienza hai nel legare?",
            answers: [
              { key: "A", label: "Non ho mai legato" },
              {
                key: "B",
                label: "Ho provato qualcosa, ma senza basi solide",
              },
              {
                key: "C",
                label: "Ho già fatto corsi o pratico da un po'",
              },
              {
                key: "D",
                label: "Conosco già basi, gote o sospensioni",
              },
            ],
          },
          {
            question: "Cosa ti serve adesso?",
            answers: [
              { key: "A", label: "Imparare nodi, tensioni e strutture base" },
              { key: "B", label: "Avere un percorso progressivo" },
              {
                key: "C",
                label: "Praticare con correzioni e continuità",
              },
              {
                key: "D",
                label: "Approfondire kata, estetica, stile o sospensioni",
              },
            ],
          },
        ],
      },
      bottom: {
        questions: [
          {
            question: "Hai già esperienza nello stare nelle corde?",
            answers: [
              { key: "A", label: "No, vorrei capire da dove iniziare" },
              {
                key: "B",
                label: "Ho provato qualcosa, ma vorrei più consapevolezza",
              },
              {
                key: "C",
                label: "Pratico già e voglio continuità",
              },
              {
                key: "D",
                label:
                  "Voglio approfondire corpo, ascolto, intensità o ricerca personale",
              },
            ],
          },
          {
            question: "Cosa ti aiuterebbe di più?",
            answers: [
              { key: "A", label: "Conoscere persone e ambiente" },
              {
                key: "B",
                label: "Capire come stare nelle corde in modo più consapevole",
              },
              {
                key: "C",
                label: "Trovare occasioni di pratica e confronto",
              },
              {
                key: "D",
                label:
                  "Esplorare il mio modo di vivere l'esperienza nelle corde",
              },
            ],
          },
          {
            question: "Vieni con una persona con cui praticare?",
            answers: [
              { key: "A", label: "No, arrivo senza partner" },
              { key: "B", label: "Forse" },
              { key: "C", label: "Sì" },
              { key: "D", label: "Non è il punto principale" },
            ],
          },
        ],
      },
      both: {
        questions: [
          {
            question: "Hai già praticato?",
            answers: [
              { key: "A", label: "No, voglio capire da dove partire" },
              {
                key: "B",
                label: "Ho provato qualcosa, ma non ho basi solide",
              },
              {
                key: "C",
                label: "Pratico già da uno o entrambi i lati",
              },
              {
                key: "D",
                label: "Ho già esperienza e voglio approfondire",
              },
            ],
          },
          {
            question: "Cosa ti interessa di più adesso?",
            answers: [
              { key: "A", label: "Orientarmi e conoscere l'ambiente" },
              { key: "B", label: "Costruire basi tecniche" },
              {
                key: "C",
                label: "Alternare pratica, confronto e correzioni",
              },
              {
                key: "D",
                label:
                  "Approfondire corpo, stile, ricerca o direzione personale",
              },
            ],
          },
        ],
      },
    } satisfies Record<QuizBranchKey, QuizBranch>,
    results: {
      EXPLORER: {
        key: "EXPLORER",
        title: "Explorer",
        path: "Open Day / Rope Jam",
        text:
          "Il tuo punto di partenza può essere un Open Day o una Rope Jam. Puoi conoscere lo spazio, osservare, fare domande e capire che tipo di pratica ti interessa.",
        cta: {
          label: "Guarda i prossimi appuntamenti",
          href: "/calendario",
        },
      },
      RIGGER_FOUNDATION: {
        key: "RIGGER_FOUNDATION",
        title: "Rigger Foundation",
        path: "Foundation 1 / Foundation 2",
        text:
          "Il tuo punto di partenza è Foundation. Foundation 1 lavora sulle basi tecniche; Foundation 2 introduce linee di sospensione e lavoro a terra in modo progressivo.",
        cta: {
          label: "Scopri Foundation",
          href: "/percorsi",
        },
      },
      RIGGER_PRACTICE: {
        key: "RIGGER_PRACTICE",
        title: "Practice Builder",
        path: "Pratica assistita / Classi tematiche",
        text:
          "Hai già iniziato e ora può esserti utile praticare con continuità, ricevere correzioni e approfondire aspetti specifici.",
        cta: {
          label: "Guarda le prossime pratiche",
          href: "/pratica",
        },
      },
      BOTTOM_EXPLORER: {
        key: "BOTTOM_EXPLORER",
        title: "Bottom Explorer",
        path: "Aperibottom / Rope Jam / Open Day",
        text:
          "Il tuo punto di partenza può essere Aperibottom, una Rope Jam o un Open Day. Sono occasioni leggere per conoscere persone, osservare l'ambiente e avvicinarti alla pratica dal punto di vista di chi vuole stare nelle corde.",
        cta: {
          label: "Guarda i prossimi appuntamenti",
          href: "/calendario",
        },
      },
      BOTTOM_PRACTICE: {
        key: "BOTTOM_PRACTICE",
        title: "Bottom Practice",
        path: "Classi tematiche / Pratica assistita",
        text:
          "Hai già iniziato a stare nelle corde e vuoi costruire più consapevolezza. Classi tematiche e pratica assistita possono aiutarti a fare domande, confrontarti e dare continuità alla pratica.",
        cta: {
          label: "Guarda le prossime pratiche",
          href: "/pratica",
        },
      },
      BOTTOM_RESEARCH: {
        key: "BOTTOM_RESEARCH",
        title: "Bottom Research",
        path: "Workshop / Classi tematiche / Classe 1+",
        text:
          "Il tuo punto di partenza può essere un workshop, una classe tematica o Classe 1+. Sono contesti utili per esplorare ascolto del corpo, presenza, intensità e modo personale di stare nelle corde.",
        cta: {
          label: "Esplora i prossimi appuntamenti",
          href: "/calendario",
        },
      },
      ROPE_RESEARCH: {
        key: "ROPE_RESEARCH",
        title: "Rope Research",
        path: "Classe 1 / Classe 1+ / Workshop",
        text:
          "Il tuo punto di partenza può essere Classe 1, Classe 1+ o un workshop. Classe 1 introduce il gote di KL e i Kata di base; Classe 1+ prosegue con nuovi Kata, personalità, estetica e direzione personale.",
        cta: {
          label: "Esplora i prossimi appuntamenti",
          href: "/calendario",
        },
      },
      MIXED_RESEARCH: {
        key: "MIXED_RESEARCH",
        title: "Mixed Research",
        path: "Workshop / Classi tematiche / Classe 1+",
        text:
          "Il tuo punto di partenza può essere un percorso specifico o un approfondimento. Classe 1 e Classe 1+ lavorano su gote, Kata, sospensioni, estetica e direzione personale; workshop e classi tematiche aprono spazi di ricerca mirati.",
        cta: {
          label: "Esplora i prossimi appuntamenti",
          href: "/calendario",
        },
      },
    } satisfies Record<QuizResultKey, QuizResult>,
  },
  entryPaths: {
    eyebrow: "Orientamento",
    title: "I possibili punti di partenza",
    cards: [
      {
        title: "Open Day / Rope Jam",
        text: "Osservare e orientarsi",
      },
      {
        title: "Aperibottom",
        text: "Stare nelle corde e conoscere persone",
      },
      {
        title: "Foundation 1 / Foundation 2",
        text: "Basi tecniche e primi lavori a terra",
      },
      {
        title: "Pratica assistita / Classi tematiche",
        text: "Consolidare e approfondire",
      },
      {
        title: "Classe 1 / Classe 1+",
        text: "Gote KL, Kata e prime sospensioni",
      },
      {
        title: "Workshop / KL",
        text: "Deep dive e ricerca",
      },
    ] satisfies SimpleCard[],
  },
  preview: {
    eyebrow: "Prima di scegliere",
    title: "Guarda prima di scegliere",
    intro:
      "A volte il modo più semplice per capire se un luogo fa per te è guardarlo.",
    cards: [
      {
        title: "Gallery",
        text: "Lo spazio, l'atmosfera, la pratica.",
        cta: {
          label: "Guarda la gallery",
          href: "/peony",
        },
      },
      {
        title: "Social",
        text: "Aggiornamenti e prossimi appuntamenti.",
        cta: {
          label: "Esplora i social",
          href: "https://www.instagram.com/",
        },
      },
    ] satisfies SimpleCard[],
  },
  finalCta: {
    title: "Vuoi vedere le prossime date?",
    intro: "Le date aggiornate sono nel calendario.",
    cta: {
      label: "Guarda il calendario",
      href: "/calendario",
    },
  },
};
