# TASK: Redesign EntryDoorsSection — mobile accordion

**Modalità:** Esegui tutto in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Contesto

Il componente `src/components/home/EntryDoorsSection.tsx` mostra 4 "porte d'ingresso" alla home. Il layout mobile attuale usa un collage di card piccole dove il testo viene troncato e il pannello espanso perde i colori della card. Va sostituito con un accordion verticale più leggibile e coerente col resto del sito.

Il componente è già `"use client"`, usa `useLanguage()` / `dictionary.home.doors`, e ha 4 icone SVG inline (IconCompass, IconCircles, IconStar, IconPeople). **Non cambiare la struttura dati del dictionary né il layout desktop (md:grid).** Intervieni SOLO sul layout mobile (sotto `md:`).

---

## Design da implementare (mobile)

Sostituisci il collage mobile con una **lista accordion verticale** a tutta larghezza. Ogni voce è una card con colore di sfondo proprio che si espande inline al tap.

### Struttura visiva di ogni card

```
┌─────────────────────────────────────────────┐
│  01   [icona cerchio]   Titolo card          │
│                         TAG + SUBTAG     [+] │
└─────────────────────────────────────────────┘
      ↓ quando aperta ↓
┌─────────────────────────────────────────────┐  ← stessa card, stesso colore
│  01   [icona]   Titolo card                  │
│                 TAG + SUBTAG             [×] │
│                                              │
│         Testo descrittivo breve.             │
│         [  CTA button  →  ]                  │
└─────────────────────────────────────────────┘
```

### Comportamento
- Un solo item aperto alla volta (aprire uno chiude l'altro)
- Transizione fluida: `max-height` da 0 a auto + `opacity` fade
- Il `+` ruota a `×` quando aperto (o usa rotazione 45°)
- Tap sulla card aperta → si richiude

### Colori (mantenere esatti)
```
card 1: background #3a2e24  → testi warm cream  → accent #f0c070
card 2: background #2e3828  → testi warm white  → accent #a0d060
card 3: background #2a2838  → testi lavender    → accent #a088d8
card 4: background #382030  → testi rose cream  → accent #d880a8
```

Ogni card usa il proprio colore accent per:
- Icona (dentro un cerchio `bg-accent/15`)
- CTA button (border + testo accent, bg accent/8)
- Numero (`01`, `02`...) opaco 35%

### Tipografia mobile
- Numero: 11px, opacity 35%, tabular-nums
- Titolo: 15–16px, font-weight 400, colore testo principale card
- Tags: 9–10px, uppercase, letter-spacing, opacity 60%
- Descrizione (pannello): 13px, line-height 1.6, opacity 80%
- CTA: 12px, pill shape (border-radius 100px), padding 8px 16px

### Spaziatura
- Padding header: 16px 14px
- Gap tra icona e testi: 14px
- Margine tra card: 6px
- Border-radius card: 12px
- Pannello body: padding 0 14px 18px, con indent sinistro allineato al testo del titolo (~66px)

### Sezione wrapper (sopra le card)
Mantieni o aggiungi:
- Eyebrow label: testo piccolo uppercase, colore warm muted (es. `#a08060`)
- Titolo sezione: font serif, ~22px, colore `#f0e8d8`, es. "Ogni percorso ha una porta."
- Background sezione: `#1a1410` o il colore scuro già usato

---

## CTA per ogni door

Leggi le CTA già nel dictionary. Se non ci sono, aggiungile solo in `it.ts` e `en.ts` (struttura: `dictionary.home.doors[n].cta`):

```ts
// it.ts
cta: "Trova il punto di partenza →"   // door 0
cta: "Guarda i percorsi →"            // door 1
cta: "Vedi workshop →"                // door 2
cta: "Scopri gli eventi →"            // door 3

// en.ts
cta: "Find your starting point →"
cta: "Explore the paths →"
cta: "See workshops →"
cta: "Discover events →"
```

---

## Vincoli

- NON modificare il layout desktop (`md:` classi e grid)
- NON modificare `dictionary.home.doors` se non per aggiungere `cta`
- NON cambiare routing né href delle card
- NON introdurre librerie nuove (no Framer Motion per questo accordion — usa CSS transitions)
- Mantieni le icone SVG esistenti (IconCompass, IconCircles, IconStar, IconPeople)
- Il componente resta `"use client"`

---

## Dopo le modifiche

Esegui in sequenza e correggi tutti gli errori:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [descrizione]

ERRORI RESIDUI:
- [errore]: [motivo se non risolvibile]
```
