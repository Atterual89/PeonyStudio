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
  title: "Scuola, venue e community di kinbaku a Torino.",
  navigationLabel: "Peony",
  language: "it",
  hero: {
    eyebrow: "Peony Studio",
    title: "Scuola, venue e community di kinbaku a Torino.",
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
          "Una sala di circa 100 m² per classi, workshop e rope jam, fino a 16 coppie.",
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
    eyebrow: "Perché Peony",
    title: "Una peonia, un riferimento, una dedica.",
    text:
      "Il nome Peony nasce da un riferimento legato al Giappone, a Naka San e al simbolo della peonia. Lo studio è dedicato alla sua eredità e alla peonia come immagine di bellezza, presenza e memoria. Il logo Peony è handmade by Elemiaow.",
  },
  approach: {
    eyebrow: "Approccio",
    title: "Tecnica, connessione, estetica.",
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
    title: "La coppia residente",
    intro:
      "Peony Studio nasce dal lavoro condiviso di Kurogami e Shiawase: insegnamento, pratica, relazione e ricerca nelle corde.",
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
      "Peony Studio non è solo una scuola. È un luogo in cui studiare, praticare, osservare, fare domande e incontrare persone con cui condividere la ricerca nelle corde.",
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
