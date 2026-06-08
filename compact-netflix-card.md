# TASK: Compatta NetflixCard nel calendario mobile

**Modalità:** Esegui in silenzio. Mostra SOLO il report finale.

## File da modificare

`src/components/shared/EventsNetflixLayout.tsx` — solo il componente `NetflixCard`

---

## Modifiche da apportare

### 1. Riduci dimensioni card
- Altezza totale: da `h-[240px]` a `h-[200px]`
- Larghezza minima: da `min-w-[200px]` a `min-w-[160px]`

### 2. Badge categoria sull'immagine
Il badge categoria (attualmente `absolute left-3 top-3`) è già sull'immagine — va bene, mantienilo lì. Assicurati che sia visibile anche con `object-cover`.

### 3. Immagine object-cover
L'immagine deve usare `object-cover` per riempire tutta la card senza spazi vuoti.

Nella `NetflixCard`, l'`<EventImage>` usa `variant="mobile"` che ha `object-contain`. Cambia a `variant="hero"` oppure aggiungi `className` con override diretto:
- In `EventImage.tsx`, aggiungi variant `"netflix"`:
  ```ts
  netflix: {
    variantClass: "aspect-[4/5]",   // proporzionale a 160×200
    imageClass: "object-cover",
    sizes: "160px"
  }
  ```
- Poi usa `variant="netflix"` nella NetflixCard

### 4. Struttura finale della card

```
┌──────────────────────────┐  ← 160px wide, 200px tall, rounded-[12px]
│                          │
│   [immagine object-cover]│  ← ~120px di altezza (60% della card)
│   [BADGE categoria]      │  ← absolute top-3 left-3, sopra l'immagine
│                          │
├──────────────────────────┤
│  12 giu                  │  ← data, 10px, opacity 70%
│  Titolo evento           │  ← font-serif, 13px, 2 righe max
│                    Prenota│ ← badge piccolo in basso a destra se bookingUrl
└──────────────────────────┘
```

Il testo data + titolo + badge Prenota resta nell'overlay in basso (già così), solo ridimensionato proporzionalmente alla card più piccola.

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
