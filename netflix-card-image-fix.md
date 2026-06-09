# TASK: Fix immagine NetflixCard — riempie tutta la larghezza della card

**Modalità:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Problema

In `src/components/shared/EventsNetflixLayout.tsx`, la `NetflixCard` mostra l'immagine solo nella metà sinistra della card — la parte destra è bianca/vuota.

## Causa probabile

`EventImage` con `variant="card"` usa `object-fit: contain` con padding interno, quindi l'immagine non riempie il contenitore. Serve `object-fit: cover` senza padding.

## Fix da applicare

In `NetflixCard`, per il blocco immagine:

1. Imposta il contenitore immagine a larghezza piena: `w-full h-40 relative overflow-hidden`
2. Passa `variant="hero"` a `EventImage` invece di `variant="card"` — la variante `hero` usa `object-fit: cover` e riempie tutto
3. Se `variant="hero"` non è disponibile su `EventImage`, aggiungi direttamente un `<div>` con `style` inline:
   ```jsx
   <div className="w-full h-40 relative overflow-hidden rounded-t-[8px]">
     <Image
       src={imageUrl}
       alt={title}
       fill
       className="object-cover"
     />
   </div>
   ```
   Adatta usando i prop disponibili nella `NetflixCard` (cerca come viene passata l'immagine — potrebbe essere `imageUrl`, `image`, `coverImage` o simile).

4. Altezza immagine: `h-40` (160px) — abbastanza alta da essere leggibile come banner.

## Non toccare

Dati, routing, altri componenti, stile del testo sotto l'immagine.

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
- variant precedente: [valore]
- fix applicato: [cosa cambiato]

ERRORI RESIDUI:
- [eventuale errore]
```
