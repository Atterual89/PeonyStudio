# TASK: Fix layout card calendario — identico a workshop, peek 1/4

**Modalità:** Esegui tutto in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Problema

Le card del calendario sono ancora in griglia 2 colonne. Devono diventare uno scroll orizzontale a singola colonna, identico al layout della pagina workshop.

---

## Riferimento esatto

Apri `src/components/workshop/WorkshopPageClient.tsx` e copia ESATTAMENTE:
- Il container dello scroll orizzontale (flex, overflow-x-auto, gap, padding)
- La larghezza delle card
- Qualsiasi `snap-*` o `scroll-*` applicato

---

## Obiettivo peek "1 card + 1/4"

La card successiva deve essere visibile per circa 1/4 della sua larghezza.

Formula larghezza card da applicare:
- Container ha `px-4` (16px per lato) → spazio utile = `100vw - 32px`
- Per mostrare 1.25 card: larghezza = `(100vw - 32px) / 1.25`
- Valore approssimato: `w-[calc((100vw-32px)/1.25)]` con max `w-[340px]`

Applica questa larghezza alle card del calendario al posto di `w-[min(84vw,380px)]`.

---

## File da modificare

`src/components/calendar/CalendarExplorer.tsx`

Nel componente `EventCard` e nel suo container di scroll:
1. Rimuovi qualsiasi griglia (`grid`, `grid-cols-*`) dal container delle card
2. Sostituisci con layout flex orizzontale identico al workshop
3. Applica la nuova larghezza card `w-[calc((100vw-32px)/1.25)]` con cap a `w-[340px]`
4. Assicurati che `overflow-x-auto` sia sul container e non sul wrapper esterno
5. Mantieni `snap-x snap-mandatory` e `snap-start` sulle card se già presenti, altrimenti aggiungili
6. Aggiungi `pb-2` al container per non tagliare l'ombra hover

Non toccare stile delle card (già aggiornato nel task precedente), routing, dati, Supabase, Ticket Tailor.

---

## Controllo qualità

```
npx.cmd tsc --noEmit
npm.cmd run lint
```

Correggi eventuali errori prima del report.

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [descrizione]

LAYOUT APPLICATO:
- [proprietà container]: [valore]
- [proprietà card]: [valore]

ERRORI RESIDUI:
- [eventuale errore e motivo]
```
