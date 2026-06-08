# TASK: Fix NetflixCard — ripristina object-contain, riduci altezza immagine

**Modalità:** Esegui in silenzio. Mostra SOLO il report finale.

## Contesto

Le NetflixCard usano immagini landscape 3:1 da Ticket Tailor. Con `object-cover` l'immagine viene tagliata. Bisogna tornare a `object-contain` ma con card e immagine più compatte.

## File da modificare

`src/components/shared/EventsNetflixLayout.tsx` — solo `NetflixCard`
`src/components/shared/EventImage.tsx` — solo se necessario per aggiungere variant

---

## Modifiche

### 1. Dimensioni card
- Larghezza: `min-w-[180px]`
- Altezza totale: **non fissa** — lascia che sia la somma di immagine + testo

### 2. Immagine
Usa un aspect ratio che mostri l'immagine landscape intera senza tagliarla:
- aspect ratio: `aspect-[16/7]` oppure `aspect-[3/1]` — proporzionale alle immagini Ticket Tailor
- `object-contain` con sfondo `#efe4d7`
- Niente padding interno (rimuovi `p-2` se presente)

Se serve, aggiungi variant `"netflix"` in `EventImage.tsx`:
```ts
netflix: {
  variantClass: "aspect-[16/7]",
  imageClass: "object-contain",
  sizes: "180px"
}
```

### 3. Struttura card

```
┌──────────────────────────┐  ← 180px wide
│                          │
│  [immagine 16/7, contain]│  ← immagine landscape intera su sfondo crema
│                          │
├──────────────────────────┤  ← separazione visiva (bg gradient o bordo)
│ [BADGE]  12 giu          │  ← badge categoria + data sulla stessa riga
│ Titolo evento      Prenota│ ← titolo + badge prenota
└──────────────────────────┘
```

Il badge categoria va spostato **sotto** l'immagine (non sopra), nella sezione testo — inline con la data. Rimuovi il badge dall'overlay sull'immagine.

Il testo (badge + data + titolo + prenota) va in un div separato con `bg-[#1a1510]` o `bg-white/90` e padding `p-3`.

### 4. Colori testo
- Sfondo testo: `#f5ede2` (crema chiaro, coerente col sito) oppure bianco
- Badge categoria: `bg-[#8b5e4a]/10 text-[#8b5e4a]`, font-size 10px
- Data: `text-[#6b5c52]`, 10px
- Titolo: `font-serif text-[#211815]`, 13px, max 2 righe
- Badge Prenota: `bg-[#211815] text-white`, 10px, pill

---

## Dopo le modifiche

```
npx.cmd tsc --noEmit
npm.cmd run lint
```

---

## Report finale

```
FILES MODIFICATI:
- [file]: [cosa cambiato]

ERRORI RESIDUI:
- [errore]: [motivo]
```
