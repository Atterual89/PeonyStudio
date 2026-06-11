type PeonyCard = {
  title: string;
  text: string;
};

type PeonyLink = {
  label: string;
  href: string;
};

type TravelGroup = {
  title: string;
  items: string[];
};

export const peonyAboutContent = {
  slug: "peony",
  title: "Peony Studio — Kinbaku venue · Torino",
  navigationLabel: "Peony",
  language: "it",
  hero: {
    eyebrow: "Peony Studio",
    title: "Peony Studio — Kinbaku venue · Torino",
    intro:
      "Peony Studio è uno spazio dedicato allo studio delle corde: tecnica, connessione, estetica e pratica condivisa dentro un ambiente curato e accogliente.",
    primaryCta: { label: "Guarda il calendario", href: "/calendario" },
    secondaryCta: { label: "Come iniziare", href: "/come-iniziare" },
  },
  space: {
    eyebrow: "Lo spazio",
    title: "Uno studio pensato per praticare, studiare e incontrarsi.",
    intro:
      "Uno spazio accogliente e curato per classi, workshop, rope jam e momenti di ricerca condivisa.",
    cards: [
      {
        title: "Main workshop area",
        text:
          "Una sala di circa 100 m² per classi, workshop e rope jam, fino a 16 coppie. La sala principale è dotata di aria condizionata e ventilazione.",
      },
      {
        title: "Lounge & kitchen",
        text:
          "Una lounge separata con cucina e divani per pause, conversazioni e momenti informali.",
      },
      {
        title: "Practice setup",
        text:
          "Luce naturale, grandi finestre e un setup pensato per pratica e studio tecnico.",
      },
      {
        title: "Comfort",
        text:
          "Due bagni, area cambio ed effetti personali, con spazi pensati per stare comodi.",
      },
    ] satisfies PeonyCard[],
  },
  gallery: {
    eyebrow: "Gallery",
    title: "Gallery",
    intro:
      "Uno sguardo allo spazio, alla sala pratica e ai dettagli di Peony Studio.",
    empty:
      "La gallery verrà aggiornata con nuove immagini dello spazio.",
  },
  location: {
    eyebrow: "Dove siamo",
    title: "Torino, a pochi minuti dalla metro Marche.",
    intro:
      "Peony Studio si trova a Torino, a pochi minuti dalla metro Marche, in una zona servita da mezzi pubblici, negozi, ristoranti e servizi.",
    routes: [
      "Metro Linea 1, fermata Marche",
      "Bus 33, fermata Eritrea",
      "Bus 40, 62, 90, VE1, fermata Vandalino",
    ],
    travel: [
      {
        title: "In aereo",
        items: [
          "Turin Caselle Airport",
          "Milan Airports: Malpensa, Linate",
          "Bergamo Orio al Serio Airport",
        ],
      },
      {
        title: "In treno",
        items: ["Turin Porta Nuova", "Turin Porta Susa"],
      },
      {
        title: "Mezzi pubblici",
        items: [
          "Metro: Turin Metro Line, Marche Station",
          "Bus Line 33, Eritrea Stop",
          "Bus Lines 40, 62, 90, VE1, Vandalino Stop",
        ],
      },
    ] satisfies TravelGroup[],
  },
  nameStory: {
    eyebrow: "Perché Peony",
    title: "Da dove deriva il nome Peony",
    text:
      "Decidere il nome non è stato semplice. Come studio di kinbaku, è stato naturale cercare ispirazione nel Giappone. Approfondendo la nostra storia, il nostro \"perché\" e le ispirazioni raccolte nel tempo, siamo arrivati a una scelta profonda: dedicare questo studio alla duratura eredità di Naka San e al suo tatuaggio simbolico della peonia. Il logo di Peony Studio è handmade by Elemiaow.",
  },
  approach: {
    eyebrow: "Approccio",
    title: "Tecnica, personalità, estetica",
    text:
      "Per noi il kinbaku non è solo tecnica: è una comunicazione silenziosa che coinvolge corpo, respiro, estetica e intenzione. L'approccio di Peony Studio è ispirato al Kinbaku LuXuria style, dove la corda diventa strumento di ascolto, relazione, ritmo, presenza, tensione, abbandono, controllo e fiducia.",
    pillars: [
      {
        title: "Tecnica",
        text:
          "Strutture, tensioni, progressioni e metodo per costruire una pratica chiara.",
      },
      {
        title: "Connessione",
        text:
          "Ascolto del corpo, ritmo condiviso e attenzione alla relazione nelle corde.",
      },
      {
        title: "Estetica",
        text:
          "Linee, intenzione, personalità e qualità visiva come parte dello studio.",
      },
    ] satisfies PeonyCard[],
  },
  residentTeachers: {
    eyebrow: "Resident teachers",
    title: "Resident Teachers",
    intro:
      "Peony Studio nasce dal lavoro condiviso di Kurogami e Shiawase: relazione, pratica, insegnamento e ricerca nel kinbaku",
  },
  guestTeachers: {
    eyebrow: "Guest teachers",
    title: "Ospiti e collaborazioni",
    intro:
      "Peony Studio ospita periodicamente insegnanti italiani e internazionali per workshop, approfondimenti e progetti speciali.",
  },
  community: {
    eyebrow: "Community",
    title: "Peony come luogo vivo.",
    intro:
      "Peony Studio non è solo un venue. È un luogo in cui studiare, praticare, osservare, fare domande e incontrare persone con cui condividere la ricerca nelle corde.",
    cards: [
      {
        title: "Classi",
        text: "Percorsi e incontri per diversi livelli di esperienza.",
      },
      {
        title: "Rope jam",
        text: "Spazi di pratica libera, incontro e continuità.",
      },
      {
        title: "Incontri bottom",
        text:
          "Momenti dedicati a chi vuole esplorare il ruolo di bottom e lo stare nelle corde.",
      },
      {
        title: "Workshop internazionali",
        text: "Approfondimenti con insegnanti ospiti e progetti speciali.",
      },
    ] satisfies PeonyCard[],
  },
  finalCta: {
    title: "Vuoi incontrare Peony dal vivo?",
    text:
      "Il modo più semplice è scegliere una prossima data, venire a conoscere lo spazio o partire dalla guida per orientarti.",
    actions: [
      { label: "Guarda i prossimi eventi", href: "/calendario" },
      { label: "Scopri come iniziare", href: "/come-iniziare" },
      { label: "Contattaci", href: "/contatti" },
    ] satisfies PeonyLink[],
  },
};

const peonyAboutContentEn = {
  slug: "peony",
  title: "Peony Studio — Kinbaku venue · Turin",
  navigationLabel: "Peony",
  language: "en",
  hero: {
    eyebrow: "Peony Studio",
    title: "Peony Studio — Kinbaku venue · Turin",
    intro:
      "Peony Studio is a space dedicated to the study of rope: technique, connection, aesthetics and shared practice in a carefully crafted environment.",
    primaryCta: { label: "View the calendar", href: "/calendario" },
    secondaryCta: { label: "How to start", href: "/come-iniziare" },
  },
  space: {
    eyebrow: "The space",
    title: "A studio built for practice, study and connection.",
    intro:
      "A welcoming and carefully crafted space for classes, workshops, rope jams and moments of shared research.",
    cards: [
      {
        title: "Main workshop area",
        text: "A room of about 100 m² for classes, workshops and rope jams, accommodating up to 16 couples. The main hall is equipped with air conditioning and ventilation.",
      },
      {
        title: "Lounge & kitchen",
        text: "A separate lounge with kitchen and sofas for breaks, conversations and informal moments.",
      },
      {
        title: "Practice setup",
        text: "Natural light, large windows and a setup designed for practice and technical study.",
      },
      {
        title: "Comfort",
        text: "Two bathrooms, changing area and personal storage, with spaces designed for your comfort.",
      },
    ] satisfies PeonyCard[],
  },
  gallery: {
    eyebrow: "Gallery",
    title: "Gallery",
    intro: "A look at the space, the practice room and the details of Peony Studio.",
    empty: "The gallery will be updated with new images of the space.",
  },
  location: {
    eyebrow: "Where we are",
    title: "Turin, a few minutes from the Marche metro.",
    intro:
      "Peony Studio is in Turin, a few minutes from the Marche metro, in an area well served by public transport, shops, restaurants and services.",
    routes: [
      "Metro Line 1, Marche station",
      "Bus 33, Eritrea stop",
      "Bus 40, 62, 90, VE1, Vandalino stop",
    ],
    travel: [
      {
        title: "By Plane",
        items: [
          "Turin Caselle Airport",
          "Milan Airports: Malpensa, Linate",
          "Bergamo Orio al Serio Airport",
        ],
      },
      {
        title: "By Train",
        items: ["Turin Porta Nuova", "Turin Porta Susa"],
      },
      {
        title: "Public Transportation",
        items: [
          "Metro: Turin Metro Line, Marche Station",
          "Bus Line 33, Eritrea Stop",
          "Bus Lines 40, 62, 90, VE1, Vandalino Stop",
        ],
      },
    ] satisfies TravelGroup[],
  },
  nameStory: {
    eyebrow: "Why Peony",
    title: "Where the Peony name comes from",
    text:
      "Deciding on the name was no simple task. As a kinbaku studio, it was instinctive to draw inspiration from Japan. However, delving into our narrative, our \"why,\" and the inspirations gathered over the years led us to a profound decision. We have chosen to dedicate this studio to the enduring legacy of Naka San and his symbolic Peony tattoo. The studio's logo is handmade by Elemiaow.",
  },
  approach: {
    eyebrow: "Approach",
    title: "Technique, personality, aesthetics",
    text:
      "Kinbaku is going for depth.\nIt's not pride but sadness.\nIt's not a show of strength, it's sympathy.\nIt's not commanding, it's asking.\nIt's elegance, it's tact.\nIt's not tying a body, it's tying a person.\nKinbaku is offering something.\nKinbaku doesn't change anything.\nIt reveals what people have inside.\nKinbaku is educating.\n\nKinbaku is writing a letter: rope is just the pen we use.",
    pillars: [
      {
        title: "Technique",
        text: "Structures, tensions, progressions and method to build a clear practice.",
      },
      {
        title: "Connection",
        text: "Body listening, shared rhythm and attention to the relationship in ropes.",
      },
      {
        title: "Aesthetics",
        text: "Lines, intention, personality and visual quality as part of the study.",
      },
    ] satisfies PeonyCard[],
  },
  residentTeachers: {
    eyebrow: "Resident teachers",
    title: "The resident couple",
    intro:
      "Peony Studio was born from the shared work of Kurogami and Shiawase: relationship, practice, teaching and research in kinbaku",
  },
  guestTeachers: {
    eyebrow: "Guest teachers",
    title: "Guests and collaborations",
    intro:
      "Peony Studio regularly hosts Italian and international teachers for workshops, deep dives and special projects.",
  },
  community: {
    eyebrow: "Community",
    title: "Peony as a living place.",
    intro:
      "Peony Studio is not just a venue. It is a place to study, practice, observe, ask questions and meet people with whom to share research in ropes.",
    cards: [
      {
        title: "Classes",
        text: "Programs and sessions for different levels of experience.",
      },
      {
        title: "Rope jam",
        text: "Free practice spaces, gathering and continuity.",
      },
      {
        title: "Bottom gatherings",
        text: "Moments dedicated to those who want to explore the bottom role and being in ropes.",
      },
      {
        title: "International workshops",
        text: "Deep dives with guest teachers and special projects.",
      },
    ] satisfies PeonyCard[],
  },
  finalCta: {
    title: "Want to meet Peony in person?",
    text: "The simplest way is to choose an upcoming date, come and discover the space, or start from the guide to find your way.",
    actions: [
      { label: "View upcoming events", href: "/calendario" },
      { label: "Discover how to start", href: "/come-iniziare" },
      { label: "Contact us", href: "/contatti" },
    ] satisfies PeonyLink[],
  },
};

export const peonyAboutBilingual = {
  it: peonyAboutContent,
  en: peonyAboutContentEn,
};
