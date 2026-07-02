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
      "Una progressione chiara, un passo alla volta, nel Kinbaku LuXuria.",
  },
  structuredPaths: [
    {
      title: "Foundation 1",
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
        "Per coppie che iniziano o vogliono costruire fondamenta tecniche chiare e solide.",
    },
    {
      title: "Foundation 2",
      subtitle: "4 lezioni",
      description:
        "Un percorso in 4 lezioni che prosegue il lavoro di Foundation 1. Introduce prime linee di sospensione, direzioni di tensione, lavoro sul corpo e continuità tra pattern e transizioni.",
      work: [
        "prime linee di sospensione",
        "direzioni di tensione",
        "lavoro sul corpo",
        "continuità tra pattern e transizioni",
      ],
      audience:
        "Per coppie che hanno già lavorato sulle basi e vogliono comprendere linee, tensioni e gestione del corpo nello spazio.",
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
        // TODO: sostituire con /pratica#pratica-assistita quando la pagina Pratica avra anchor dedicate.
        cta: {
          label: "Scopri la pratica assistita",
          href: "/percorsi/socialita",
        },
      },
      {
        title: "Classi tematiche",
        subtitle: "Un tema, una demo, esercizi da portare a casa.",
        description:
          "Serate pratiche dedicate a un tema specifico: chair tie, bamboo, gag e altri strumenti o situazioni. Ogni incontro parte da una demo e prosegue con esercizi guidati e riproducibili a casa.",
        tags: ["Aperte a tutti i livelli", "Demo + esercizio", "Temi singoli"],
        // TODO: sostituire con /pratica#classi-tematiche quando la pagina Pratica avra anchor dedicate.
        cta: {
          label: "Scopri le classi tematiche",
          href: "/percorsi/socialita",
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
        "Per coppie che iniziano o vogliono costruire fondamenta tecniche chiare e solide.",
    },
    {
      title: "Foundation 2",
      subtitle: "Linee, stabilità, lavoro sul corpo",
      description:
        "Il secondo step del percorso Foundation. Si introducono le prime linee di sospensione, le direzioni di tensione e il lavoro sul corpo. L’obiettivo è costruire sicurezza, fluidità e continuità.",
      work: [
        "prime linee di sospensione",
        "direzioni di tensione",
        "gestione del corpo a terra",
        "gestione del corpo nello spazio",
        "continuità tra pattern e transizioni",
      ],
      audience:
        "Per coppie che hanno già lavorato sulle basi e vogliono iniziare a comprendere linee, tensioni e corpo nello spazio.",
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
          "Hai già lavorato con linee di sospensione o lavoro sul corpo nello spazio?",
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

const programsContentEn = {
  slug: "programs",
  title: "Programs",
  navigationLabel: "Programs",
  hero: {
    eyebrow: "Structured programs",
    title: "Your rope journey.",
    intro: "A clear progression, one step at a time, in Kinbaku LuXuria.",
  },
  structuredPaths: [
    {
      title: "Foundation 1",
      subtitle: "4 sessions",
      description:
        "A 4-session program covering basic technical principles. Not just technique: classes designed to leave complete, reproducible exercises to take home and work on during Rope Jams.",
      work: ["knots", "single and double column", "frictions and countertensions", "basic patterns", "complete reproducible exercises"],
      audience: "For couples who are starting or want to build clear and solid technical foundations.",
    },
    {
      title: "Foundation 2",
      subtitle: "4 sessions",
      description:
        "A 4-session program that continues Foundation 1. Introduces first suspension lines, tension directions, body work and continuity between patterns and transitions.",
      work: ["first suspension lines", "tension directions", "body work", "continuity between patterns and transitions"],
      audience: "For couples who have already worked on the basics and want to understand lines, tensions and body management in space.",
    },
    {
      title: "Classe 1",
      subtitle: "4 evenings",
      description:
        "A 4-evening program to learn the Kinbaku LuXuria gote from scratch and reach the first suspensions through the basic Kata.",
      work: ["Kinbaku LuXuria gote", "basic Kata", "first suspensions", "technical progression"],
      audience: "For those with solid foundations who want to enter the structured language of Classe 1.",
    },
    {
      title: "Classe 1+",
      subtitle: "4 evenings",
      description:
        "A 4-evening program for those who already know the Kinbaku LuXuria gote. Continues with new Kata and begins to incorporate personality, intention and aesthetics.",
      work: ["new Kata", "gote variations", "intention and aesthetics", "personal direction"],
      audience: "For those who already know the Kinbaku LuXuria gote and want to deepen quality, intention and personality in rope.",
    },
  ] satisfies ProgramStep[],
  parallelPractice: {
    intro:
      "Programs build a progression. Alongside this path there are evenings designed for practice, repetition and exploration: you can attend them while going through the programs, or use them to consolidate what you have already studied.",
    items: [
      {
        title: "Assisted Practice",
        subtitle: "Repeat, consolidate, receive support.",
        description:
          "A focused practice evening, without demos or jam atmosphere. Couples work on patterns already known in the Kinbaku LuXuria style, repeating them faithfully or using them as a base for personal exploration. Kurogami is present to give support, advice and corrections.",
        tags: ["Open to all levels", "No demo", "Not a rope jam"],
        cta: { label: "Explore Assisted Practice", href: "/pratica" },
      },
      {
        title: "Themed Classes",
        subtitle: "A theme, a demo, exercises to take home.",
        description:
          "Practical evenings dedicated to a specific topic: chair tie, bamboo, gag and other tools or situations. Each session starts with a demo and continues with guided, reproducible exercises.",
        tags: ["Open to all levels", "Demo + exercise", "Single topics"],
        cta: { label: "Explore Themed Classes", href: "/pratica" },
      },
    ] satisfies ParallelPracticeItem[],
  },
  progression: [
    {
      title: "Foundation 1",
      subtitle: "Technical foundations",
      description:
        "The first program to enter the technical work of Peony Studio. We work on knots, single and double column, frictions, countertensions and basic patterns. Each session leaves complete, reproducible exercises, useful also during practice.",
      work: [
        "knots and rope management",
        "single and double column",
        "frictions and countertensions",
        "basic patterns",
        "reproducible exercises for home or practice",
      ],
      audience: "For couples who are starting or want to build clear and solid technical foundations.",
    },
    {
      title: "Foundation 2",
      subtitle: "Lines, stability, body work",
      description:
        "The second step of the Foundation program. First suspension lines, tension directions and body work are introduced. The goal is to build security, fluidity and continuity.",
      work: [
        "first suspension lines",
        "tension directions",
        "floor body management",
        "body management in space",
        "continuity between patterns and transitions",
      ],
      audience: "For couples who have already worked on the basics and want to understand lines, tensions and body in space.",
    },
    {
      title: "Classe 1",
      subtitle: "Gote and first kata",
      description:
        "A program to learn the Kinbaku LuXuria gote from scratch and approach the first suspensions through the basic kata. Technique becomes structure, progression and the ability to read what happens in the body.",
      work: [
        "Kinbaku LuXuria gote",
        "basic kata",
        "first suspensions",
        "technical progression",
        "body listening and tension management",
      ],
      audience: "For those with solid foundations who want to enter the structured language of Classe 1.",
    },
    {
      title: "Classe 1+",
      subtitle: "Kata, aesthetics, personality",
      description:
        "Starting from knowledge of the Kinbaku LuXuria gote, we continue with new kata that begin to incorporate personality, intention and aesthetics. The path becomes less imitation and more personal language.",
      work: [
        "new kata",
        "gote variations",
        "intention and aesthetics",
        "body adaptation",
        "building a personal language",
      ],
      audience: "For those who already know the Kinbaku LuXuria gote and want to deepen quality, intention and personality in rope.",
    },
  ] satisfies ProgramStep[],
  quiz: {
    title: "Where should you start?",
    intro: "Answer a few questions to find your way between Foundation, classes and practice.",
    questions: [
      {
        question: "How much experience do you have with rope?",
        answers: [
          { label: "I have never tied or barely tried", result: "foundation1" as ProgramQuizResultKey },
          { label: "I've taken some classes or workshops, but I lack organized foundations", result: "foundation1" as ProgramQuizResultKey },
          { label: "I tie with some regularity and know basic patterns", result: "foundation2" as ProgramQuizResultKey },
          { label: "I have already studied gote, kata or structured programs", result: "classe1plus" as ProgramQuizResultKey },
        ],
      },
      {
        question: "How confident are you with knots, single/double column, frictions and countertensions?",
        answers: [
          { label: "Not at all or barely", result: "foundation1" as ProgramQuizResultKey },
          { label: "I know them, but don't always use them well", result: "foundation1" as ProgramQuizResultKey },
          { label: "I use them with reasonable confidence", result: "foundation2" as ProgramQuizResultKey },
          { label: "I use them confidently and can adapt them to the situation", result: "classe1" as ProgramQuizResultKey },
        ],
      },
      {
        question: "Have you worked with suspension lines or body work in space?",
        answers: [
          { label: "No", result: "foundation1" as ProgramQuizResultKey },
          { label: "I've seen something, but don't really practice it", result: "foundation2" as ProgramQuizResultKey },
          { label: "I've started working on it and want to consolidate", result: "foundation2" as ProgramQuizResultKey },
          { label: "Yes, and I want to deepen more complex structures", result: "classe1" as ProgramQuizResultKey },
        ],
      },
      {
        question: "Do you know the Kinbaku LuXuria gote?",
        answers: [
          { label: "No", result: "foundation2" as ProgramQuizResultKey },
          { label: "I've heard about it or seen it, but don't know it technically", result: "classe1" as ProgramQuizResultKey },
          { label: "I'd like to learn it from scratch in a structured way", result: "classe1" as ProgramQuizResultKey },
          { label: "I already know it and want to deepen kata, variations and quality", result: "classe1plus" as ProgramQuizResultKey },
        ],
      },
      {
        question: "What are you looking for right now?",
        answers: [
          { label: "Build solid foundations", result: "foundation1" as ProgramQuizResultKey },
          { label: "Understand lines, tensions and body work", result: "foundation2" as ProgramQuizResultKey },
          { label: "Enter a more precise technical structure", result: "classe1" as ProgramQuizResultKey },
          { label: "Refine aesthetics, intention and personal language", result: "classe1plus" as ProgramQuizResultKey },
        ],
      },
    ] satisfies ProgramQuizQuestion[],
    results: {
      foundation1: {
        title: "You could start with Foundation 1",
        text: "It's the best starting point if you want to build clear technical foundations: knots, single and double column, frictions, countertensions and basic patterns. It helps organize your practice and leave with concrete exercises.",
      },
      foundation2: {
        title: "You could start with Foundation 2",
        text: "It's right for you if you already have technical basics and want to start working on lines, tension directions and floor body work. It's the bridge between foundations and the more structured work of the following classes.",
      },
      classe1: {
        title: "You could start with Classe 1",
        text: "It's the right program if you already have solid foundations and want to learn the Kinbaku LuXuria gote from scratch, entering the first kata and first suspensions with a clear progression.",
      },
      classe1plus: {
        title: "You could start with Classe 1+",
        text: "It's designed for those who already know the Kinbaku LuXuria gote and want to deepen kata, variations, aesthetics, intention and quality of tying.",
      },
    } satisfies Record<ProgramQuizResultKey, ProgramQuizResult>,
  },
  finalCta: {
    title: "Want to see the upcoming dates?",
    text: "Updated program dates are in the calendar.",
    actions: [
      { label: "View the calendar", href: "/calendario" },
    ] satisfies ProgramCta[],
  },
};

export const programsBilingual = {
  it: programsContent,
  en: programsContentEn,
};
