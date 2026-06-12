export type PeonyCardVariant = {
  variant: "Platinum" | "Gold" | "Silver" | "Bronze";
  description: string;
  value: string;
  benefits: string[];
};

export type RopeProduct = {
  producer: "Europa" | "Ogawa / Giappone";
  diameter: string;
  rawPrice: string;
  treatedPrice: string;
  floorwork: boolean;
  suspensionHarness: boolean;
  suspensionUpline: boolean;
};

export const shopContent = {
  slug: "shop",
  title: "Shop",
  navigationLabel: "Shop",
  status: "ready",
  sourceNotes: [
    "Shop collegato allo store prodotti Ticket Tailor.",
    "Alcuni prodotti possono essere disponibili solo per i soci o con ritiro in studio.",
  ],
  hero: {
    eyebrow: "Shop",
    title: "Materiali e risorse Peony Studio.",
    intro:
      "Gift card, Peony Card, materiali e risorse selezionate per accompagnare la pratica dentro e fuori dallo studio. Gli acquisti sono gestiti tramite Ticket Tailor; alcuni prodotti possono essere disponibili solo per i soci o con ritiro in studio.",
  },
  ticketTailorCta: {
    eyebrow: "Store Ticket Tailor",
    it:
      "Libri, journal, preorder e prodotti selezionati di Peony Studio. Acquisto e pagamento sono gestiti tramite Ticket Tailor.",
    en:
      "Books, journals, preorders and selected Peony Studio products. Purchases and payments are managed through Ticket Tailor.",
    buttonIt: "Apri lo shop",
    buttonEn: "Open the shop",
    unavailable: "Lo shop Ticket Tailor sarà disponibile a breve.",
  },
  products: {
    eyebrow: "Prodotti",
    title: "Disponibili nello shop",
  },
  peonyCards: {
    eyebrow: "Peony Card",
    title: "Peony Card 2027",
    intro: [
      "Le Peony Card accompagnano la stagione Peony Studio settembre 2026 – agosto 2027 con accessi, priorità, sconti e benefit dedicati.",
      "Tutti i dettagli sulle nuove Peony Card!",
      "Riceverai la tua card e i codici via email",
    ],
    variants: [
      {
        variant: "Platinum",
        description:
          "Pensata per chi ha già iniziato a studiare con noi, partecipa regolarmente agli eventi e vuole il massimo",
        value: "VALORE 1440€ → COSTO 865€ – Sconto del 40%",
        benefits: [
          "Una lezione privata di 3h con Kurogami & Shiawase",
          "Una sessione privata di coaching di 3h con Kurogami",
          "Ingressi inclusi alle sessioni di Pratica Assistita e Classe Tematica per sé e per il proprio partner",
          "Ingressi inclusi Rope Jam, Open Day",
          "Sconto 10% sulla partecipazione ai workshop*",
          "Sconto 10% sull'acquisto delle corde da Peony Studio",
          "48h di priorità prenotazione",
          "Quota associativa 2027",
        ],
      },
      {
        variant: "Gold",
        description:
          "Pensata per chi partecipa regolarmente a eventi, pratiche e workshop",
        value: "VALORE 990€ → COSTO 645€ – Sconto del 35%",
        benefits: [
          "Una sessione privata di coaching di 3h con Kurogami",
          "Ingressi inclusi alle sessioni di Pratica Assistita e Classe Tematica per sé e per il proprio partner",
          "Ingressi inclusi Rope Jam, Open Day",
          "Sconto 10% sulla partecipazione ai workshop*",
          "Sconto 10% sull'acquisto delle corde da Peony Studio",
          "48h di priorità prenotazione",
          "Quota associativa 2027",
        ],
      },
      {
        variant: "Silver",
        description:
          "Ideale per chi è all'inizio del percorso e vuole scoprire di più",
        value: "VALORE 765€ → COSTO 499€ – Sconto del 35%",
        benefits: [
          "Ingressi inclusi alle sessioni di Pratica Assistita e Classe Tematica per sé e per il proprio partner",
          "Ingressi inclusi Rope Jam, Open Day",
          "Sconto 5% sulla partecipazione ai workshop*",
          "Sconto 5% sull'acquisto delle corde da Peony Studio",
          "48h di priorità prenotazione",
          "Quota associativa 2027",
        ],
      },
      {
        variant: "Bronze",
        description: "Per chi è all'inizio o partecipa saltuariamente",
        value: "VALORE 240€ → COSTO 165€ – Sconto del 30%",
        benefits: [
          "Ingresso incluso Rope Jam e Open Day",
          "Sconto 5% su tutti i workshop*",
          "Sconto 5% sull'acquisto delle corde da Peony Studio",
          "Tote bag Peony in omaggio",
          "48h di priorità prenotazione",
          "Quota associativa 2027",
        ],
      },
    ] satisfies PeonyCardVariant[],
    howItWorks: {
      title: "Come funziona",
      intro: [
        "Una volta prenotata la tua Card, dovrai solo attendere il primo settembre.",
        "Dopo l'acquisto completo, a partire dal 1° settembre, riceverai via email:",
      ],
      items: [
        "Codici di priorità per prenotare in anticipo i tuoi eventi",
        "Codici sconto validi per i workshop della stagione 2026/2027, anche cumulabili",
      ],
    },
    important: {
      title: "Importante",
      items: [
        "La card include la quota associativa valida per tutta la stagione.",
        "La card fisica ti verrà consegnata appena sarà possibile.",
        "Tutte le card sono nominali.",
        "Le card valgono per la stagione settembre 2026 – agosto 2027, non sono rimborsabili.",
        "I vantaggi sono utilizzabili solo dalla persona intestataria della card.",
        "Per le serate di coppia, le card Gold e Silver coprono l'ingresso come coppia.",
        "Gli sconti per i workshop sono cumulabili se partecipi con un'altra persona tesserata Gold, Silver o Bronze.",
        "* Tutti i workshop esclusivamente di Kurogami e Shiawase.",
        "Per domande: peony.studio.turin@gmail.com",
      ],
    },
  },
  giftCards: {
    eyebrow: "Gift Card / Voucher",
    title: "Gift Card e voucher",
    intro:
      "Voucher e gift card Peony Studio da acquistare tramite Ticket Tailor.",
  },
  ropes: {
    eyebrow: "Corde",
    title: "Corde",
    intro:
      "Corde in iuta da 8m, disponibili in sede Peony Studio con consegna e pagamento di persona.",
    producers: [
      {
        title: "Europa",
        text:
          "Più morbida, beginner friendly, adatta soprattutto a legature a terra, non per sospensioni.",
      },
      {
        title: "Ogawa / Giappone",
        text: "Corda classica, adatta a ogni tipo di legatura.",
      },
    ],
    items: [
      {
        producer: "Europa",
        diameter: "4,5 mm",
        rawPrice: "€20,00",
        treatedPrice: "€35,00",
        floorwork: true,
        suspensionHarness: false,
        suspensionUpline: false,
      },
      {
        producer: "Europa",
        diameter: "5,5 mm",
        rawPrice: "€15,00",
        treatedPrice: "€30,00",
        floorwork: true,
        suspensionHarness: false,
        suspensionUpline: false,
      },
      {
        producer: "Europa",
        diameter: "6 mm",
        rawPrice: "€15,00",
        treatedPrice: "€30,00",
        floorwork: true,
        suspensionHarness: false,
        suspensionUpline: false,
      },
      {
        producer: "Ogawa / Giappone",
        diameter: "5 mm",
        rawPrice: "€25,00",
        treatedPrice: "€40,00",
        floorwork: true,
        suspensionHarness: true,
        suspensionUpline: false,
      },
      {
        producer: "Ogawa / Giappone",
        diameter: "6 mm",
        rawPrice: "€20,00",
        treatedPrice: "€35,00",
        floorwork: true,
        suspensionHarness: true,
        suspensionUpline: true,
      },
    ] satisfies RopeProduct[],
    inquiry: {
      cta: "Richiedi corde",
      email: "peony.studio.turin@gmail.com",
      subject: "Richiesta corde Peony Studio",
    },
  },
};

export const shopContentEn = {
  hero: {
    eyebrow: "Shop",
    title: "Peony Studio materials and resources.",
    intro:
      "Gift cards, Peony Cards, materials and selected resources to support your practice inside and outside the studio. Purchases are managed through Ticket Tailor; some products may only be available for members or with studio pickup.",
  },
  products: {
    eyebrow: "Products",
    title: "Available in the shop",
  },
  peonyCards: {
    eyebrow: "Peony Card",
    title: "Peony Card 2027",
    intro: [
      "Peony Cards accompany the Peony Studio season September 2026 – August 2027 with access, priority, discounts and dedicated benefits.",
      "All details about the new Peony Cards!",
      "You will receive your card and codes by email",
    ],
  },
  giftCards: {
    eyebrow: "Gift Card / Voucher",
    title: "Gift Cards and vouchers",
    intro: "Peony Studio vouchers and gift cards available on Ticket Tailor.",
  },
  ropes: {
    eyebrow: "Ropes",
    title: "Ropes",
    intro:
      "8m jute ropes, available at Peony Studio with in-person delivery and payment.",
  },
};

export const shopBilingual = {
  it: {
    hero: shopContent.hero,
    products: shopContent.products,
    peonyCards: { eyebrow: shopContent.peonyCards.eyebrow, title: shopContent.peonyCards.title, intro: shopContent.peonyCards.intro },
    giftCards: { eyebrow: shopContent.giftCards.eyebrow, title: shopContent.giftCards.title, intro: shopContent.giftCards.intro },
    ropes: { eyebrow: shopContent.ropes.eyebrow, title: shopContent.ropes.title, intro: shopContent.ropes.intro },
  },
  en: shopContentEn,
};
