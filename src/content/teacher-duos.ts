export type TeacherDuo = {
  id: string;
  name: string;
  role: string;
  shortBio: string;
  fullBio: string;
  image: string;
  imageAlt: string;
  links?: {
    label: string;
    href: string;
  }[];
  tags?: string[];
  workshopLinks?: {
    label: string;
    href: string;
  }[];
};

export const teacherDuos = [
  {
    id: "kurogami-shiawase",
    name: "Kurogami & Shiawase",
    role: "Resident teachers / founders di Peony Studio",
    shortBio:
      "La coppia residente di Peony Studio: tecnica, relazione, estetica e ricerca nel Kinbaku LuXuria style.",
    fullBio:
      "Kurogami e Shiawase sono resident teachers e founders di Peony Studio. Sono insieme dal 2014 e iniziano a studiare kinbaku nel settembre 2016. Nel novembre dello stesso anno partecipano al primo corso con Riccardo Wildties. Nel febbraio 2018 Andrea Kurogami diventa educatore certificato Kinbaku LuXuria. Negli anni partecipano a eventi in Italia e in Europa come studenti, performer ed educatori. Nel 2019 legano al 25° Nawa Naka Kai a Tokyo insieme a Riccardo, Red Sabbath e Naka-san.",
    image: "/images/teachers/kurogami-shiawase.jpg",
    imageAlt: "Kurogami e Shiawase, resident teachers di Peony Studio",
    tags: ["Resident teachers", "Kinbaku LuXuria", "Peony Studio"],
    workshopLinks: [
      { label: "Guarda i percorsi", href: "/percorsi" },
      { label: "Guarda il calendario", href: "/calendario" },
    ],
  },
  {
    id: "riccardo-wildties-redsabbath",
    name: "Riccardo Wildties & RedSabbath",
    role: "Guest teachers / Kinbaku LuXuria",
    shortBio:
      "Workshop, ricerca e trasmissione legata al percorso Kinbaku LuXuria.",
    fullBio:
      "Riccardo Wildties e RedSabbath sono ospiti di riferimento per workshop, approfondimenti e momenti di trasmissione legati al percorso Kinbaku LuXuria. A Peony Studio vengono presentati come coppia di insegnanti ospiti, senza trasformare questa scheda in una bio individuale estesa.",
    image: "/images/teachers/riccardo-wildties-redsabbath.jpg",
    imageAlt: "Riccardo Wildties e RedSabbath",
    tags: ["Guest teachers", "Kinbaku LuXuria", "Workshop"],
    workshopLinks: [{ label: "Vedi workshop", href: "/workshop" }],
  },
  {
    id: "peter-soptik-sansei",
    name: "Peter Soptik & Sansei",
    role: "Guest teachers / workshop internazionali",
    shortBio:
      "Ospiti internazionali per studio tecnico, pratica e ricerca condivisa.",
    fullBio:
      "Peter Soptik e Sansei sono presentati come coppia di insegnanti ospiti per workshop internazionali, approfondimenti tecnici e progetti speciali. La scheda resta volutamente sintetica e potrà essere ampliata quando saranno disponibili contenuti biografici più specifici.",
    image: "/images/teachers/peter-soptik-sansei.jpg",
    imageAlt: "Peter Soptik e Sansei",
    tags: ["Guest teachers", "Workshop", "International"],
    workshopLinks: [{ label: "Vedi workshop", href: "/workshop" }],
  },
] satisfies TeacherDuo[];
