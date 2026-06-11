export type TeacherDuo = {
  id: string;
  name: string;
  role: string;
  roleEn?: string;
  shortBio: string;
  shortBioEn?: string;
  fullBio: string;
  fullBioEn?: string;
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
    role: "Fondatori di Peony Studio",
    roleEn: "Founders of Peony Studio",
    shortBio:
      "Resident Teachers di Peony Studio: tecnica, relazione, estetica e ricerca nel Kinbaku LuXuria style.",
    fullBio:
      "Insieme dal 2014, nel settembre 2016 iniziano a dedicarsi allo studio del kinbaku. A novembre dello stesso anno partecipano al loro primo corso tenuto da Riccardo Wildties. Questo incontro segna l'inizio di un viaggio ancora in corso, tra approfondimenti, ispirazione e ricerca continua.\n\nNel febbraio 2018 Andrea Kurogami diviene un educatore certificato di KinbakuLuXuria, sposando definitivamente i valori educativi di Wildties.\n\nDurante gli anni Kurogami e Shiawase prendono attivamente parte a svariati eventi inerenti al kinbaku in Italia e in diverse città europee, sia come partecipanti durante le Jam che come studenti durante i corsi avanzati tenuti da Riccardo, nonché come performers ed educatori in eventi dedicati.\n\nNel 2019 Kurogami e Shiawase hanno avuto l'onore di legare al 25° Nawa Naka Kai a Tokyo, insieme a Riccardo e Red Sabbath e a Naka-san.",
    fullBioEn:
      "Together since 2014, in September 2016 they began dedicating themselves to the study of kinbaku. That November they attended their first course with Riccardo Wildties — the beginning of an ongoing journey of deepening, inspiration and continuous research.\n\nIn February 2018, Andrea Kurogami became a certified KinbakuLuXuria educator, fully embracing the educational values of Wildties.\n\nOver the years, Kurogami and Shiawase have actively participated in kinbaku events across Italy and several European cities — as practitioners at jams, students in advanced courses with Riccardo, and as performers and educators at dedicated events.\n\nIn 2019, they had the honour of tying at the 25th Nawa Naka Kai in Tokyo, alongside Riccardo, Red Sabbath and Naka-san.",
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
      "Ricerca, passione e trasmissione legate al percorso nel Kinbaku LuXuria style",
    shortBioEn:
      "Research, passion and transmission linked to the Kinbaku LuXuria style path",
    fullBio:
      "\"Tormenting rope is made for souls that have that sadness within, that turmoil, that need for surrender regardless of who ties and who is tied. It's not about sadism and masochism, it's about a pilgrimage, it's about climbing a mountain together, it's about the journey not the destination.\"\n\nKinbaku LuXuria è uno stile tradizionale che discende direttamente dal Naka-ryu. Riccardo (aka Wildties) ha introdotto una rielaborazione tecnica per adattare lo stile ai fisici occidentali senza tradire lo spirito originale. Semenawa — la corda che tormenta — è la parola che meglio riassume il mood di questo stile.\n\nRiccardo è l'ichi-ban deshi di Naka-san e, per volontà del suo sensei, è colui designato a trasmettere lo stile. Oltre a numerosi workshop e spettacoli in Europa e Nord America con la sua partner Red Sabbath, si è esibito in importanti eventi giapponesi a Tokyo tra cui il Maniac Festival e il Nawa Naka Kai.",
    fullBioEn:
      "\"Tormenting rope is made for souls that have that sadness within, that turmoil, that need for surrender regardless of who ties and who is tied. It's not about sadism and masochism, it's about a pilgrimage, it's about climbing a mountain together, it's about the journey not the destination.\"\n\nKinbaku LuXuria is a traditional style which directly descends from Naka-ryu. Riccardo (aka Wildties) introduced a technical re-engineering to make the style fit with Western body types without undermining its original spirit. Semenawa — the tormenting rope — is the word that best captures the mood of this style.\n\nRiccardo is Naka-san's ichi-ban deshi and, according to the will of his sensei, he is designated to convey the style. Alongside numerous workshops and shows across Europe and North America with his partner Red Sabbath, he has performed at major Japanese events in Tokyo including Maniac Festival and Nawa Naka Kai.",
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
      "L'approccio di Peter Soptik e Sansei alla corda è incentrato sulla connessione profonda tra due persone, radicato nel kinbaku tradizionale e nello stile Kinbaku LuXuria. Il loro legare e insegnare include pattern classici, una forte estetica e una resa profonda alle emozioni fondamentali del semenawa. Tra i temi che esplorano e insegnano vi sono l'oggettivazione e l'esposizione, dalla vergogna all'umiliazione, così come argomenti di nicchia come la corda al collo e i binder per le braccia. Peter ha studiato il bondage giapponese con diversi insegnanti rinomati ed è istruttore certificato del Kinbaku LuXuria Style. Sansei porta la sua esperienza sia come modella che come rigger, offrendo prospettive formate da una resa profonda e dall'esperienza vissuta nelle corde.",
    fullBioEn:
      "Peter Soptik and Sansei's approach to rope focuses on deep connection between two people, rooted in traditional kinbaku and the Kinbaku LuXuria Style. Their tying and teaching include classical patterns, strong aesthetics, and deep surrender to core emotions found in semenawa. Among the themes they explore and teach are objectification and exposure, from shame to humiliation, as well as niche topics such as neck rope and arm binders. Peter has studied Japanese bondage with several renowned teachers and is a certified instructor of the Kinbaku LuXuria Style. Sansei brings her experience as both model and rigger, offering insights shaped by deep surrender and embodied experience in the ropes.",
    image: "/images/teachers/peter-soptik-sansei.jpg",
    imageAlt: "Peter Soptik e Sansei",
    tags: ["Guest teachers", "Workshop", "International"],
    workshopLinks: [{ label: "Vedi workshop", href: "/workshop" }],
  },
] satisfies TeacherDuo[];
