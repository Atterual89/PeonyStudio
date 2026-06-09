# TASK: Fix aspect ratio immagine NetflixCard — 3:1 come workshop

**Modalità:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Problema

In `src/components/shared/EventsNetflixLayout.tsx`, il contenitore immagine della `NetflixCard` ha altezza fissa `h-40` che taglia le immagini verticalmente. Le immagini degli eventi sono in formato 3:1 (2344×746px), quindi il contenitore deve rispettare questo ratio.

## Fix da applicare

Nel contenitore immagine di `NetflixCard`:

Sostituisci l'altezza fissa con aspect ratio dinamico:
- Rimuovi `h-40` (o qualsiasi altezza fissa presente)
- Aggiungi `aspect-[3/1]` al contenitore
- Mantieni `w-full relative overflow-hidden`
- Mantieni `object-cover` sull'immagine

Risultato atteso: il contenitore immagine sarà sempre proporzionale 3:1, identico alle card workshop, senza tagliare le immagini.

## Verifica

Apri anche `src/components/workshop/WorkshopPageClient.tsx` e controlla come è impostato il contenitore immagine nella `WorkshopCard`. Se usa `aspect-[3/1]` o una classe simile, applica esattamente lo stesso approccio alla `NetflixCard`.

## Non toccare

Tutto il resto: testo, badge, bottoni, larghezza card, routing, dati.

---

## Controllo qualità

```
npx.cmd tsc --noEmit
npm.cmd run lint
```

---

## Report finale

```
FILES MODIFICATI:
- [file]: [descrizione]

FIX APPLICATO:
- contenitore immagine prima: [classi]
- contenitore immagine dopo: [classi]
- WorkshopCard usa: [classi per riferimento]

ERRORI RESIDUI:
- [eventuale errore]
```
