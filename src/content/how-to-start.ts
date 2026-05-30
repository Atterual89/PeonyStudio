export type SoftCta = {
  label: string;
  href: string;
};

export type QuizAnswerKey = "A" | "B" | "C" | "D";

export type QuizAnswer = {
  key: QuizAnswerKey;
  label: string;
};

export type QuizQuestion = {
  question: string;
  answers: QuizAnswer[];
};

export type QuizResult = {
  key: QuizAnswerKey;
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
      "Non devi sapere già quale corso scegliere, né avere già esperienza. Puoi partire osservando, imparando le basi o continuando una pratica già iniziata.",
    primaryCta: {
      label: "Fai il quiz",
      href: "#quiz",
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
      "Rispondi a poche domande e scopri quale può essere il tuo punto di partenza.",
    questions: [
      {
        question: "Hai già provato shibari / kinbaku?",
        answers: [
          {
            key: "A",
            label: "Mai, ho curiosità e vorrei capire meglio",
          },
          {
            key: "B",
            label: "Ho provato qualcosa, ma non ho basi solide",
          },
          {
            key: "C",
            label: "Ho già fatto corsi o pratico da un po'",
          },
          {
            key: "D",
            label:
              "Pratico già e voglio approfondire stile, ricerca o direzione personale",
          },
        ],
      },
      {
        question: "In questo momento, cosa ti aiuterebbe di più?",
        answers: [
          {
            key: "A",
            label: "Guardare, fare domande e capire l'ambiente",
          },
          {
            key: "B",
            label: "Imparare le basi con una guida chiara",
          },
          {
            key: "C",
            label: "Praticare con supporto e correggere quello che faccio",
          },
          {
            key: "D",
            label: "Esplorare temi più specifici, intensi o personali",
          },
        ],
      },
      {
        question: "Vieni con una persona con cui praticare?",
        answers: [
          {
            key: "A",
            label: "No, vorrei capire se posso iniziare anche senza partner",
          },
          {
            key: "B",
            label: "Forse, dipende dal tipo di attività",
          },
          {
            key: "C",
            label: "Sì, ho una persona con cui praticare",
          },
          {
            key: "D",
            label:
              "Non è il punto principale: mi interessa soprattutto il percorso",
          },
        ],
      },
      {
        question: "Cosa ti farebbe sentire nel posto giusto?",
        answers: [
          {
            key: "A",
            label: "Poter osservare senza pressione",
          },
          {
            key: "B",
            label: "Avere un percorso semplice, chiaro e progressivo",
          },
          {
            key: "C",
            label: "Trovare continuità, confronto e correzioni",
          },
          {
            key: "D",
            label:
              "Avere uno spazio dove sviluppare il mio modo di stare nelle corde",
          },
        ],
      },
    ] satisfies QuizQuestion[],
    results: {
      A: {
        key: "A",
        title: "Explorer",
        path: "Open Day",
        text:
          "Il tuo punto di partenza è l'Open Day. Puoi conoscere lo spazio, osservare senza pressione, fare domande e capire se l'approccio di Peony fa per te.",
        cta: {
          label: "Vedi i prossimi Open Day",
          href: "/calendario",
        },
      },
      B: {
        key: "B",
        title: "Foundation Student",
        path: "Foundation",
        text:
          "Il tuo punto di partenza è Foundation. Un percorso chiaro e progressivo per costruire le basi: tecnica, comunicazione, sicurezza e metodo.",
        cta: {
          label: "Scopri Foundation",
          href: "/programmi",
        },
      },
      C: {
        key: "C",
        title: "Practice Builder",
        path: "Pratica assistita / Classi tematiche",
        text:
          "Il tuo punto di partenza è la pratica assistita o una classe tematica. Hai già iniziato e ora può esserti utile praticare con continuità, ricevere correzioni e consolidare quello che fai.",
        cta: {
          label: "Guarda le prossime pratiche",
          href: "/pratica",
        },
      },
      D: {
        key: "D",
        title: "Research Student",
        path: "Workshop / Laydown / Rope Jam",
        text:
          "Il tuo punto di partenza è un workshop, Laydown, una Rope Jam o un contesto di ricerca. Hai già una pratica attiva e vuoi approfondire stile, direzione personale e modo di stare nelle corde.",
        cta: {
          label: "Esplora i prossimi appuntamenti",
          href: "/calendario",
        },
      },
    } satisfies Record<QuizAnswerKey, QuizResult>,
  },
  entryPaths: {
    eyebrow: "Percorsi",
    title: "I percorsi di ingresso",
    cards: [
      {
        title: "Open Day",
        text: "Per conoscere lo spazio, osservare e fare domande.",
      },
      {
        title: "Foundation",
        text: "Per iniziare dalle basi con un percorso chiaro e progressivo.",
      },
      {
        title: "Pratica assistita / Classi tematiche",
        text:
          "Per praticare con continuità, ricevere correzioni e approfondire aspetti specifici.",
      },
      {
        title: "Workshop / Laydown / Rope Jam",
        text: "Per esplorare temi più personali, intensi o legati alla ricerca.",
      },
    ] satisfies SimpleCard[],
  },
  preview: {
    eyebrow: "Prima di scegliere",
    title: "Guarda prima di scegliere",
    intro:
      "A volte il modo più semplice per capire se un luogo fa per te è guardarlo: lo spazio, l'atmosfera, le attività, il modo in cui si pratica.",
    cards: [
      {
        title: "Gallery",
        text: "Immagini dello studio, degli eventi e dei momenti di pratica.",
        cta: {
          label: "Guarda la gallery",
          href: "/peony",
        },
      },
      {
        title: "Social",
        text: "Aggiornamenti, backstage e prossimi appuntamenti.",
        cta: {
          label: "Esplora i social",
          href: "https://www.instagram.com/",
        },
      },
    ] satisfies SimpleCard[],
  },
  finalCta: {
    title: "Trova il tuo primo passo",
    intro:
      "Ogni percorso ha un punto di ingresso chiaro. Puoi iniziare osservando, imparando le basi o continuando una pratica già avviata.",
    cta: {
      label: "Guarda il calendario",
      href: "/calendario",
    },
  },
};
