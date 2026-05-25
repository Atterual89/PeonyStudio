export type BeginnerPathCard = {
  title: string;
  forWho: string;
  whatHappens: string;
  nextStep: string;
};

export const howToStartContent = {
  slug: "how-to-start",
  title: "Come iniziare",
  navigationLabel: "Come iniziare",
  status: "draft",
  sourceNotes: [
    "Use the current live-site concepts around Open Day and introduction to shibari.",
    "The live site presents Open Day / introduzione as the first contact point for people who want to connect with the studio.",
  ],
  hero: {
    eyebrow: "Primi passi",
    title: "Avvicinarsi alle corde con chiarezza, ascolto e gradualità.",
    intro:
      "Se è la prima volta che entri in Peony Studio, il percorso può iniziare in modo semplice: conoscere lo spazio, fare una prima introduzione, poi continuare con una base tecnica e momenti di pratica.",
  },
  path: {
    eyebrow: "Percorso beginner",
    title: "Open Day → Foundation → Pratica assistita → Rope Jam",
    cards: [
      {
        title: "Open Day",
        forWho:
          "Per chi vuole conoscere lo studio, fare domande e capire se iniziare.",
        whatHappens:
          "Un primo incontro leggero: orientamento, informazioni pratiche, atmosfera dello spazio e introduzione al modo in cui si lavora.",
        nextStep: "Prenotare una introduzione o entrare nel percorso Foundation.",
      },
      {
        title: "Foundation",
        forWho:
          "Per chi parte da zero o vuole costruire basi più solide e condivise.",
        whatHappens:
          "Si lavora su sicurezza, comunicazione, tecnica di base, gestione delle tensioni e primi pattern fondamentali.",
        nextStep: "Continuare con pratica assistita e classi successive.",
      },
      {
        title: "Pratica assistita",
        forWho:
          "Per chi ha già una base e vuole consolidare con uno sguardo esterno.",
        whatHappens:
          "Uno spazio guidato per ripetere, chiarire dubbi, correggere dettagli e restare in continuità.",
        nextStep: "Portare la pratica verso rope jam, classi o approfondimenti.",
      },
      {
        title: "Rope Jam",
        forWho:
          "Per chi vuole praticare in modo più autonomo dentro la community.",
        whatHappens:
          "Un momento informale per praticare, scambiare conoscenze e incontrare altre persone dello studio.",
        nextStep: "Scegliere il prossimo appuntamento dal calendario.",
      },
    ] satisfies BeginnerPathCard[],
  },
  unsure: {
    eyebrow: "Orientamento",
    title: "Non sai da dove partire?",
    intro:
      "Va bene così. Se non hai esperienza, se hai già praticato altrove o se non sai quale formato scegliere, puoi partire dal calendario o scriverci: ti aiuteremo a trovare il primo passo più adatto.",
  },
  finalCta: {
    title: "Scegli il primo passo con calma.",
    intro:
      "Guarda i prossimi appuntamenti oppure usa il contatto placeholder per una domanda prima di prenotare.",
    primaryCta: {
      label: "Vai al calendario",
      href: "/calendario",
    },
    secondaryCta: {
      label: "Contatto placeholder",
      href: "mailto:hello@peonystudio.example",
    },
  },
};
