# TASK: Fix link EntryDoors + verifica immagini NetflixCard

**Modalità:** Esegui in silenzio. Mostra SOLO il report finale.

---

## Fix 1 — Link errato in EntryDoorsSection

Nel componente `src/components/home/EntryDoorsSection.tsx` e nel dictionary (`src/i18n/dictionaries/it.ts` e `en.ts`), una delle 4 door ha il link (`href`) che punta a `/percorsi` invece che a `/socialita` (o equivalente per la sezione community/socialità).

### Cosa fare

1. Leggi `src/components/home/EntryDoorsSection.tsx`
2. Leggi `src/i18n/dictionaries/it.ts` — cerca la sezione `home.doors` e trova la door con `href` sbagliato
3. La door "Voglio conoscere la community" (tag: Rope Jam + Open Day + Aperibottom) deve puntare alla pagina socialità. Cerca quale route esiste nel progetto per questa sezione (`/socialita`, `/community`, `/pratica-sociale` o simile — cerca in `src/app/`)
4. Correggi l'`href` nel dictionary (it.ts e en.ts) o nel componente, ovunque sia definito

---

## Fix 2 — Verifica variant immagine in NetflixCard

Nel componente `src/components/shared/EventsNetflixLayout.tsx`, la `NetflixCard` usa `<EventImage>` con `variant="mobile"` che ha `aspect-[10/11]` e `object-contain`.

### Problema attuale
`object-contain` con padding lascia spazio vuoto intorno all'immagine su sfondo crema `#efe4d7` — l'effetto è che le card sembrano avere bordi vuoti invece di riempire lo spazio.

### Cosa fare
Nella `NetflixCard`, cambia il variant da `"mobile"` a `"hero"` — così usa `object-cover` che riempie tutta la card senza bordi vuoti, più adatto per card visivamente dense come il Netflix layout.

Verifica che la dimensione della card (200×240px, `aspect-[10/11]`) sia ancora corretta dopo il cambio.

Se `variant="hero"` non è compatibile per dimensione, crea un nuovo variant `"netflix"` in `EventImage.tsx`:
```ts
netflix: {
  variantClass: "aspect-[5/6]",
  imageClass: "object-cover",
  sizes: "200px"
}
```

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
- [file]: [cosa è cambiato]

LINK CORRETTO:
- door "community" ora punta a: [route trovata]

IMMAGINI:
- variant usato: [hero / netflix / altro]
- object-cover attivo: [sì/no]

ERRORI RESIDUI:
- [errore]: [motivo]
```
