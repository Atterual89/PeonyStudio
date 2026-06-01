type PeonyCard = {
  title: string;
  text: string;
};

type PeonyLink = {
  label: string;
  href: string;
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
      "Il progetto Peony Studio nasce da Kurogami e Shiawase nel luglio 2023. Lo studio apre a Torino nel luglio 2024 come luogo dedicato a classi, workshop, rope jam e momenti di ricerca condivisa.",
    cards: [
      {
        title: "Main workshop area",
        text:
          "Una sala principale di circa 100 m² per classi, workshop, eventi e rope jam, con setup pensato per ospitare fino a 16 coppie che legano.",
      },
      {
        title: "Lounge & kitchen",
        text:
          "Una zona lounge separata con cucina e divani, per respirare, parlare e vivere lo studio anche fuori dalla pratica.",
      },
      {
        title: "Practice setup",
        text:
          "Uno spazio luminoso, con grandi finestre e luce naturale, progettato per sostenere pratica, studio tecnico e lavoro in sicurezza.",
      },
      {
        title: "Comfort",
        text:
          "Due bagni, area per cambio ed effetti personali, e un ambiente accogliente, curato e professionale.",
      },
    ] satisfies PeonyCard[],
  },
  location: {
    eyebrow: "Dove siamo",
    title: "Torino, a pochi minuti dalla metro Marche.",
    intro:
      "Peony Studio si trova in una zona servita da mezzi pubblici, negozi, ristoranti e servizi. L’indirizzo completo viene condiviso nei canali di prenotazione e nelle comunicazioni operative.",
    routes: [
      "Metro Linea 1, fermata Marche",
      "Bus 33, fermata Eritrea",
      "Bus 40, 62, 90, VE1, fermata Vandalino",
    ],
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
      "Per noi il kinbaku non è solo tecnica: è una comunicazione silenziosa che coinvolge corpo, respiro, estetica e intenzione. L’approccio di Peony Studio è ispirato al Kinbaku LuXuria style, dove la corda diventa strumento di ascolto, relazione, ritmo, presenza, tensione, abbandono, controllo e fiducia.",
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
    title: "Kurogami & Shiawase",
    bio:
      "Kurogami e Shiawase sono resident teachers e founders di Peony Studio. Sono insieme dal 2014 e iniziano a studiare kinbaku nel settembre 2016. Nel novembre dello stesso anno partecipano al primo corso con Riccardo Wildties. Nel febbraio 2018 Andrea Kurogami diventa educatore certificato Kinbaku LuXuria. Negli anni partecipano a eventi in Italia e in Europa come studenti, performer ed educatori. Nel 2019 legano al 25° Nawa Naka Kai a Tokyo insieme a Riccardo, Red Sabbath e Naka-san.",
    profiles: [
      {
        title: "Kurogami",
        text: "Resident teacher / Kinbaku LuXuria educator",
      },
      {
        title: "Shiawase",
        text: "Resident teacher / co-founder / bottoming research",
      },
    ] satisfies PeonyCard[],
  },
  guestTeachers: {
    eyebrow: "Guest teachers",
    title: "Ospiti e collaborazioni",
    intro:
      "Peony Studio ospita periodicamente insegnanti italiani e internazionali per workshop, approfondimenti e progetti speciali.",
    cards: [
      {
        title: "Riccardo Wildties & Red Sabbath",
        text: "Workshop, ricerca e trasmissione legata al percorso Kinbaku LuXuria.",
      },
      {
        title: "Peter Soptick",
        text: "Ospite internazionale per approfondimenti tecnici e workshop intensivi.",
      },
      {
        title: "Sansei",
        text: "Ospite internazionale per studio tecnico, pratica e ricerca.",
      },
      {
        title: "Future guests",
        text: "Nuove collaborazioni e workshop speciali saranno annunciati nel calendario.",
      },
    ] satisfies PeonyCard[],
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
        text: "Momenti dedicati a chi vuole esplorare il ruolo di bottom e lo stare nelle corde.",
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
