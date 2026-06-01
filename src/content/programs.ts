export type ProgramStep = {
  title: string;
  subtitle: string;
  description: string;
  work: string[];
  audience: string;
};

export type ParallelPracticeItem = {
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  cta: ProgramCta;
};

export type ProgramCta = {
  label: string;
  href: string;
};

export type ProgramQuizResultKey =
  | "foundation1"
  | "foundation2"
  | "classe1"
  | "classe1plus";

export type ProgramQuizAnswer = {
  label: string;
  result: ProgramQuizResultKey;
};

export type ProgramQuizQuestion = {
  question: string;
  answers: ProgramQuizAnswer[];
};

export type ProgramQuizResult = {
  title: string;
  text: string;
};

export const programsContent = {
  slug: "programs",
  title: "Percorsi",
  navigationLabel: "Percorsi",
  hero: {
    eyebrow: "Percorsi strutturati",
    title: "Il tuo percorso nella corda.",
    intro:
      "Una progressione chiara, costruita per farti crescere nello studio del Kinbaku LuXuria, un passo alla volta.",
  },
  structuredPaths: [
    {
      title: "Foundation",
      subtitle: "4 lezioni",
      description:
        "Un percorso in 4 lezioni sui principi tecnici di base. Non solo tecnica: classi pensate per lasciare esercizi completi da portare a casa e riprendere anche durante le Rope Jam.",
      work: [
        "nodi",
        "single e double column",
        "frizioni e controtensioni",
        "pattern di base",
        "esercizi completi e riproducibili",
      ],
      audience:
        "Per chi inizia o vuole costruire fondamenta tecniche chiare e solide.",
    },
    {
      title: "Laydown",
      subtitle: "4 serate",
      description:
        "Un percorso in 4 serate che introduce il lavoro sulle linee di sospensione e concetti vicini al lavoro a terra / liedown. Copy provvisoria da rifinire.",
      work: [
        "linee di sospensione",
        "direzioni di tensione",
        "lavoro a terra",
        "continuità e ascolto",
      ],
      audience:
        "Per chi vuole iniziare a comprendere linee, tensioni e corpo nello spazio.",
    },
    {
      title: "Classe 1",
      subtitle: "4 serate",
      description:
        "Un percorso in 4 serate per imparare da zero il gote di Kinbaku LuXuria e arrivare alle prime sospensioni attraverso i Kata di base.",
      work: [
        "gote di Kinbaku LuXuria",
        "Kata di base",
        "prime sospensioni",
        "progressione tecnica",
      ],
      audience:
        "Per chi ha fondamenta solide e vuole entrare nel linguaggio strutturato della Classe 1.",
    },
    {
      title: "Classe 1+",
      subtitle: "4 serate",
      description:
        "Un percorso in 4 serate per chi conosce già il gote di Kinbaku LuXuria. Prosegue con nuovi Kata e inizia a inglobare personalità, intenzione ed estetica.",
      work: [
        "nuovi Kata",
        "variazioni sul gote",
        "intenzione ed estetica",
        "direzione personale",
      ],
      audience:
        "Per chi conosce già il gote di Kinbaku LuXuria e vuole approfondire qualità, intenzione e personalità nella corda.",
    },
  ] satisfies ProgramStep[],
  parallelPractice: {
    intro:
      "I percorsi costruiscono una progressione. Accanto a questa linea ci sono serate pensate per praticare, ripetere ed esplorare: puoi frequentarle mentre attraversi i programmi, oppure usarle per consolidare ciò che hai già studiato.",
    items: [
      {
        title: "Pratica assistita",
        subtitle: "Ripetere, consolidare, ricevere supporto.",
        description:
          "Una serata di pratica concentrata, senza demo e senza atmosfera da jam. Le coppie lavorano su pattern già conosciuti nello stile Kinbaku LuXuria, ripetendoli fedelmente o usandoli come base per esplorazioni personali. Kurogami è presente per dare supporto, consigli e correzioni.",
        tags: ["Aperta a tutti i livelli", "Nessuna demo", "Non è una rope jam"],
        cta: {
          label: "Scopri la pratica assistita",
          href: "/pratica",
        },
      },
      {
        title: "Classi tematiche",
        subtitle: "Un tema, una demo, esercizi da portare a casa.",
        description:
          "Serate pratiche dedicate a un tema specifico: chair tie, bamboo, gag e altri strumenti o situazioni. Ogni incontro parte da una demo e prosegue con esercizi guidati e riproducibili a casa.",
        tags: ["Aperte a tutti i livelli", "Demo + esercizio", "Temi singoli"],
        cta: {
          label: "Scopri le classi tematiche",
          href: "/pratica",
        },
      },
    ] satisfies ParallelPracticeItem[],
  },
  progression: [
    {
      title: "Foundation 1",
      subtitle: "Le fondamenta tecniche",
      description:
        "Il primo percorso per entrare nel lavoro tecnico di Peony Studio. Si lavora su nodi, single e double column, frizioni, controtensioni e pattern di base. Non è solo tecnica: ogni lezione lascia esercizi completi e riproducibili, utili anche durante la pratica.",
      work: [
        "nodi e gestione della corda",
        "single e double column",
        "frizioni e controtensioni",
        "pattern di base",
        "esercizi riproducibili a casa o in pratica",
      ],
      audience:
        "Per chi inizia o vuole costruire fondamenta tecniche chiare e solide.",
    },
    {
      title: "Foundation 2",
      subtitle: "Linee, stabilità, laydown",
      description:
        "Il secondo step del percorso Foundation. Si introducono le prime linee di sospensione, le direzioni di tensione e il lavoro sul corpo a terra, con concetti vicini al laydown. L’obiettivo è costruire sicurezza, fluidità e continuità.",
      work: [
        "prime linee di sospensione",
        "direzioni di tensione",
        "gestione del corpo a terra",
        "strutture vicine al laydown",
        "continuità tra pattern e transizioni",
      ],
      audience:
        "Per chi ha già lavorato sulle basi e vuole iniziare a comprendere linee, tensioni e corpo nello spazio.",
    },
    {
      title: "Classe 1",
      subtitle: "Gote e primi kata",
      description:
        "Un percorso per imparare da zero il gote di Kinbaku LuXuria e avvicinarsi alle prime sospensioni attraverso i kata di base. La tecnica diventa struttura, progressione e capacità di leggere ciò che accade nel corpo.",
      work: [
        "gote di Kinbaku LuXuria",
        "kata di base",
        "prime sospensioni",
        "progressione tecnica",
        "ascolto del corpo e gestione della tensione",
      ],
      audience:
        "Per chi ha fondamenta solide e vuole entrare nel linguaggio strutturato della Classe 1.",
    },
    {
      title: "Classe 1+",
      subtitle: "Kata, estetica, personalità",
      description:
        "Si parte dalla conoscenza del gote di Kinbaku LuXuria e si prosegue con nuovi kata che iniziano a inglobare personalità, intenzione ed estetica. Il percorso diventa meno imitazione e più linguaggio personale.",
      work: [
        "nuovi kata",
        "variazioni sul gote",
        "intenzione ed estetica",
        "adattamento al corpo",
        "costruzione di un linguaggio personale",
      ],
      audience:
        "Per chi conosce già il gote di Kinbaku LuXuria e vuole approfondire qualità, intenzione e personalità nella corda.",
    },
  ] satisfies ProgramStep[],
  quiz: {
    title: "Da dove dovresti iniziare?",
    intro:
      "Rispondi a poche domande per orientarti tra Foundation, classi e pratica.",
    questions: [
      {
        question: "Che esperienza hai con la corda?",
        answers: [
          {
            label: "Non ho mai legato o ho provato pochissimo",
            result: "foundation1",
          },
          {
            label:
              "Ho fatto qualche lezione o workshop, ma mi mancano basi ordinate",
            result: "foundation1",
          },
          {
            label:
              "Lego già con una certa continuità e conosco pattern di base",
            result: "foundation2",
          },
          {
            label: "Ho già studiato gote, kata o percorsi strutturati",
            result: "classe1plus",
          },
        ],
      },
      {
        question:
          "Quanto ti senti sicuro/a su nodi, single/double column, frizioni e controtensioni?",
        answers: [
          { label: "Poco o per niente", result: "foundation1" },
          {
            label: "Li conosco, ma non sempre so usarli bene",
            result: "foundation1",
          },
          { label: "Li uso con abbastanza sicurezza", result: "foundation2" },
          {
            label: "Li uso con sicurezza e so adattarli alla situazione",
            result: "classe1",
          },
        ],
      },
      {
        question:
          "Hai già lavorato con linee di sospensione o lavoro a terra tipo laydown?",
        answers: [
          { label: "No", result: "foundation1" },
          {
            label: "Ho visto qualcosa, ma non lo pratico davvero",
            result: "foundation2",
          },
          {
            label: "Ho iniziato a lavorarci e voglio consolidare",
            result: "foundation2",
          },
          {
            label: "Sì, e voglio approfondire strutture più complesse",
            result: "classe1",
          },
        ],
      },
      {
        question: "Conosci il gote di Kinbaku LuXuria?",
        answers: [
          { label: "No", result: "foundation2" },
          {
            label:
              "Ne ho sentito parlare o l’ho visto, ma non lo conosco tecnicamente",
            result: "classe1",
          },
          {
            label: "Vorrei impararlo da zero in modo strutturato",
            result: "classe1",
          },
          {
            label:
              "Lo conosco già e voglio approfondire kata, variazioni e qualità",
            result: "classe1plus",
          },
        ],
      },
      {
        question: "Cosa cerchi adesso?",
        answers: [
          { label: "Costruire basi solide", result: "foundation1" },
          {
            label: "Capire linee, tensioni e lavoro sul corpo",
            result: "foundation2",
          },
          {
            label: "Entrare in una struttura tecnica più precisa",
            result: "classe1",
          },
          {
            label: "Raffinare estetica, intenzione e linguaggio personale",
            result: "classe1plus",
          },
        ],
      },
    ] satisfies ProgramQuizQuestion[],
    results: {
      foundation1: {
        title: "Potresti partire da Foundation 1",
        text:
          "È il punto migliore se vuoi costruire fondamenta tecniche chiare: nodi, single e double column, frizioni, controtensioni e pattern di base. Ti aiuta a ordinare la pratica e a portare a casa esercizi concreti.",
      },
      foundation2: {
        title: "Potresti partire da Foundation 2",
        text:
          "È adatto se hai già basi tecniche e vuoi iniziare a lavorare su linee, direzioni di tensione e corpo a terra. È il ponte tra le fondamenta e il lavoro più strutturato delle classi successive.",
      },
      classe1: {
        title: "Potresti partire da Classe 1",
        text:
          "È il percorso giusto se hai già basi solide e vuoi imparare il gote di Kinbaku LuXuria da zero, entrando nei primi kata e nelle prime sospensioni con una progressione chiara.",
      },
      classe1plus: {
        title: "Potresti partire da Classe 1+",
        text:
          "È pensata per chi conosce già il gote di Kinbaku LuXuria e vuole approfondire kata, variazioni, estetica, intenzione e qualità della legatura.",
      },
    } satisfies Record<ProgramQuizResultKey, ProgramQuizResult>,
  },
  finalCta: {
    title: "Vuoi vedere le prossime date?",
    text: "Le date aggiornate dei percorsi sono nel calendario.",
    actions: [
      { label: "Guarda il calendario", href: "/calendario" },
    ] satisfies ProgramCta[],
  },
};
