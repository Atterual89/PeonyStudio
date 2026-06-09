# TASK: Fix larghezza NetflixCard — layout "1 card + 1/4" su mobile

**Modalità:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Problema

Su mobile il calendario usa `EventsNetflixLayout.tsx` → `CategoryRow` → `NetflixCard`.
`NetflixCard` ha `min-w-[180px]` senza `max-w`, quindi su 375px entrano 2 card affiancate.
Dobbiamo mostrare esattamente **1 card + 1/4 della successiva** (peek).

---

## File da modificare

`src/components/shared/EventsNetflixLayout.tsx`

### 1. NetflixCard — larghezza

Sostituisci `min-w-[180px]` con:
```
w-[calc((100vw-48px)/1.25)] max-w-[300px] shrink-0
```
- `100vw - 48px` = viewport meno padding container (px-4 = 16px per lato) e gap
- `/1.25` = mostra 1 card intera + 1/4 della successiva
- `max-w-[300px]` = cap su schermi più larghi
- `shrink-0` = impedisce che flex comprima le card

### 2. NetflixCard — stile identico a WorkshopCard

Apri `src/components/workshop/WorkshopPageClient.tsx` e copia lo stile della card su `NetflixCard`:
- Sfondo: `bg-white/65`
- Bordo: `border rounded-[8px]`
- Hover: `hover:-translate-y-[3px] transition-transform`
- Immagine: usa `variant="card"` con altezza fissa `h-28` (non `netflix`, non `compact`)
- Badge categoria: `rounded-full bg-[#8b5e4a]/10 px-2.5 py-1 text-[10px] uppercase tracking-wide`
- Titolo: `font-serif text-lg font-medium leading-tight` (leggermente più piccolo perché card più stretta)
- CTA "Prenota": `bg-[#211815] text-white rounded-full px-4 py-2 text-[13px]`

### 3. CategoryRow — scroll snap

Assicurati che il container abbia `snap-x snap-mandatory` e ogni `NetflixCard` abbia `snap-start`.

---

## Non toccare

- Dati, tipi, routing, Supabase, Ticket Tailor
- `EventCard` e `EventRail` (desktop)
- `WorkshopPageClient.tsx`

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

MODIFICHE APPLICATE:
- NetflixCard larghezza: [vecchio] → [nuovo]
- NetflixCard stile: [cosa cambiato]

ERRORI RESIDUI:
- [eventuale errore]
```
