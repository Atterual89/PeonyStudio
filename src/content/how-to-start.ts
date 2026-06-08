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

const howToStartContentEn = {
  slug: "how-to-start",
  title: "How to start",
  navigationLabel: "How to start",
  hero: {
    eyebrow: "First steps",
    title: "How to start",
    intro:
      "You don't need to know which course to choose yet. Answer a few questions and find the right starting point.",
    primaryCta: { label: "Take the quiz", href: "#" },
    secondaryCta: { label: "View the calendar", href: "/calendario" },
  },
  quiz: {
    eyebrow: "Quiz",
    title: "What kind of Peony student are you?",
    intro: "A quick orientation to find your starting point.",
    firstQuestion: {
      question: "Where do you want to start from?",
      answers: [
        {
          key: "A" as QuizAnswerKey,
          label: "I'd like to explore the space and understand what kind of practice suits me",
          branch: "explorer" as QuizBranchKey,
        },
        {
          key: "B" as QuizAnswerKey,
          label: "I'd like to learn to tie",
          branch: "rigger" as QuizBranchKey,
        },
        {
          key: "C" as QuizAnswerKey,
          label: "I'd like to be in ropes or explore the bottom role",
          branch: "bottom" as QuizBranchKey,
        },
        {
          key: "D" as QuizAnswerKey,
          label: "I'd like to explore both sides",
          branch: "both" as QuizBranchKey,
        },
      ],
    } satisfies QuizFirstQuestion,
    branches: {
      explorer: {
        questions: [
          {
            question: "What would help you most right now?",
            answers: [
              { key: "A" as QuizAnswerKey, label: "Observe without pressure" },
              { key: "B" as QuizAnswerKey, label: "Understand the courses and levels" },
              { key: "C" as QuizAnswerKey, label: "Meet people and discover the environment" },
              { key: "D" as QuizAnswerKey, label: "See practice in person" },
            ],
          },
          {
            question: "How do you imagine your first contact with Peony?",
            answers: [
              { key: "A" as QuizAnswerKey, label: "An open, informal evening" },
              { key: "B" as QuizAnswerKey, label: "A moment to ask questions" },
              { key: "C" as QuizAnswerKey, label: "Watch a practice session or a Rope Jam" },
              { key: "D" as QuizAnswerKey, label: "Find out if I can start without a partner" },
            ],
          },
        ],
      },
      rigger: {
        questions: [
          {
            question: "How much experience do you have tying?",
            answers: [
              { key: "A" as QuizAnswerKey, label: "I have never tied" },
              { key: "B" as QuizAnswerKey, label: "I've tried something, but without solid foundations" },
              { key: "C" as QuizAnswerKey, label: "I've already taken courses or practiced for a while" },
              { key: "D" as QuizAnswerKey, label: "I already know basics, gote or suspensions" },
            ],
          },
          {
            question: "What do you need right now?",
            answers: [
              { key: "A" as QuizAnswerKey, label: "Learn knots, tensions and basic structures" },
              { key: "B" as QuizAnswerKey, label: "Have a progressive learning path" },
              { key: "C" as QuizAnswerKey, label: "Practice with feedback and continuity" },
              { key: "D" as QuizAnswerKey, label: "Deepen kata, aesthetics, style or suspensions" },
            ],
          },
        ],
      },
      bottom: {
        questions: [
          {
            question: "Do you have experience being in ropes?",
            answers: [
              { key: "A" as QuizAnswerKey, label: "No, I'd like to understand where to start" },
              { key: "B" as QuizAnswerKey, label: "I've tried something, but I'd like more awareness" },
              { key: "C" as QuizAnswerKey, label: "I already practice and want continuity" },
              {
                key: "D" as QuizAnswerKey,
                label: "I want to deepen body awareness, listening, intensity or personal research",
              },
            ],
          },
          {
            question: "What would help you most?",
            answers: [
              { key: "A" as QuizAnswerKey, label: "Meet people and discover the environment" },
              { key: "B" as QuizAnswerKey, label: "Learn how to be in ropes more consciously" },
              { key: "C" as QuizAnswerKey, label: "Find opportunities for practice and exchange" },
              { key: "D" as QuizAnswerKey, label: "Explore my own way of experiencing ropes" },
            ],
          },
          {
            question: "Are you coming with a practice partner?",
            answers: [
              { key: "A" as QuizAnswerKey, label: "No, I'll come without a partner" },
              { key: "B" as QuizAnswerKey, label: "Maybe" },
              { key: "C" as QuizAnswerKey, label: "Yes" },
              { key: "D" as QuizAnswerKey, label: "That's not the main point" },
            ],
          },
        ],
      },
      both: {
        questions: [
          {
            question: "Have you practiced before?",
            answers: [
              { key: "A" as QuizAnswerKey, label: "No, I want to find my starting point" },
              { key: "B" as QuizAnswerKey, label: "I've tried something, but I don't have solid foundations" },
              { key: "C" as QuizAnswerKey, label: "I already practice from one or both sides" },
              { key: "D" as QuizAnswerKey, label: "I already have experience and want to go deeper" },
            ],
          },
          {
            question: "What interests you most right now?",
            answers: [
              { key: "A" as QuizAnswerKey, label: "Get oriented and discover the environment" },
              { key: "B" as QuizAnswerKey, label: "Build technical foundations" },
              { key: "C" as QuizAnswerKey, label: "Alternate practice, exchange and feedback" },
              {
                key: "D" as QuizAnswerKey,
                label: "Deepen body awareness, style, research or personal direction",
              },
            ],
          },
        ],
      },
    } satisfies Record<QuizBranchKey, QuizBranch>,
    results: {
      EXPLORER: {
        key: "EXPLORER" as QuizResultKey,
        title: "Explorer",
        path: "Open Day / Rope Jam",
        text: "Your starting point could be an Open Day or a Rope Jam. You can discover the space, observe, ask questions and understand what kind of practice interests you.",
        cta: { label: "View upcoming dates", href: "/calendario" },
      },
      RIGGER_FOUNDATION: {
        key: "RIGGER_FOUNDATION" as QuizResultKey,
        title: "Rigger Foundation",
        path: "Foundation 1 / Foundation 2",
        text: "Your starting point is Foundation. Foundation 1 covers technical basics; Foundation 2 introduces suspension lines and floor work progressively.",
        cta: { label: "Explore Foundation", href: "/percorsi" },
      },
      RIGGER_PRACTICE: {
        key: "RIGGER_PRACTICE" as QuizResultKey,
        title: "Practice Builder",
        path: "Assisted Practice / Themed Classes",
        text: "You've already started and it would be useful to practice consistently, receive feedback and deepen specific aspects.",
        cta: { label: "View upcoming practice sessions", href: "/pratica" },
      },
      BOTTOM_EXPLORER: {
        key: "BOTTOM_EXPLORER" as QuizResultKey,
        title: "Bottom Explorer",
        path: "Aperibottom / Rope Jam / Open Day",
        text: "Your starting point could be Aperibottom, a Rope Jam or an Open Day. Light occasions to meet people, observe the environment and approach practice from the perspective of someone who wants to be in ropes.",
        cta: { label: "View upcoming dates", href: "/calendario" },
      },
      BOTTOM_PRACTICE: {
        key: "BOTTOM_PRACTICE" as QuizResultKey,
        title: "Bottom Practice",
        path: "Themed Classes / Assisted Practice",
        text: "You've started being in ropes and want to build more awareness. Themed classes and Assisted Practice help you ask questions, share experiences and give continuity to your practice.",
        cta: { label: "View upcoming practice sessions", href: "/pratica" },
      },
      BOTTOM_RESEARCH: {
        key: "BOTTOM_RESEARCH" as QuizResultKey,
        title: "Bottom Research",
        path: "Workshop / Themed Classes / Classe 1+",
        text: "Your starting point could be a workshop, a themed class or Classe 1+. Useful contexts for exploring body listening, presence, intensity and your personal way of experiencing ropes.",
        cta: { label: "Explore upcoming dates", href: "/calendario" },
      },
      ROPE_RESEARCH: {
        key: "ROPE_RESEARCH" as QuizResultKey,
        title: "Rope Research",
        path: "Classe 1 / Classe 1+ / Workshop",
        text: "Your starting point could be Classe 1, Classe 1+ or a workshop. Classe 1 introduces the KL gote and basic Kata; Classe 1+ continues with new Kata, personality, aesthetics and personal direction.",
        cta: { label: "Explore upcoming dates", href: "/calendario" },
      },
      MIXED_RESEARCH: {
        key: "MIXED_RESEARCH" as QuizResultKey,
        title: "Mixed Research",
        path: "Workshop / Themed Classes / Classe 1+",
        text: "Your starting point could be a specific program or a deep dive. Classe 1 and Classe 1+ work on gote, Kata, suspensions, aesthetics and personal direction; workshops and themed classes open targeted research spaces.",
        cta: { label: "Explore upcoming dates", href: "/calendario" },
      },
    } satisfies Record<QuizResultKey, QuizResult>,
  },
  entryPaths: {
    eyebrow: "Orientation",
    title: "Possible starting points",
    cards: [
      { title: "Open Day / Rope Jam", text: "Explore and get oriented" },
      { title: "Aperibottom", text: "Experience the bottom role and meet people" },
      { title: "Foundation 1 / Foundation 2", text: "Technical foundations and first floor work" },
      { title: "Assisted Practice / Themed Classes", text: "Consolidate and deepen" },
      { title: "Classe 1 / Classe 1+", text: "KL gote, Kata and first suspensions" },
      { title: "Workshop / KL", text: "Deep dive and research" },
    ] satisfies SimpleCard[],
  },
  preview: {
    eyebrow: "Before choosing",
    title: "Look before you choose",
    intro: "Sometimes the simplest way to know if a place is right for you is to look at it.",
    cards: [
      {
        title: "Gallery",
        text: "The space, the atmosphere, the practice.",
        cta: { label: "View the gallery", href: "/peony" },
      },
    ] satisfies SimpleCard[],
  },
  finalCta: {
    title: "Want to see the upcoming dates?",
    intro: "Updated dates are in the calendar.",
    cta: { label: "View the calendar", href: "/calendario" },
  },
};

export const howToStartBilingual = {
  it: howToStartContent,
  en: howToStartContentEn,
};
