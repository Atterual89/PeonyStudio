# TASK: Adeguare le card del calendario allo stile workshop

**Modalità:** Esegui tutto in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Obiettivo

Le card degli eventi nel calendario (`CalendarExplorer.tsx`) devono diventare **identiche** nello stile alle card workshop (`WorkshopPageClient.tsx` → `WorkshopCard`).

L'unica differenza ammessa è il **contenuto** (il calendario ha categoria, tags, descrizione; il workshop ha teachers, international, coupleOnly) — ma forma, dimensioni, sfondo, immagine, badge e CTA devono essere visivamente identici.

---

## Stile di riferimento — WorkshopCard

Prendi questi valori ESATTI da `WorkshopPageClient.tsx` e applicali alla EventCard del calendario:

- **Larghezza card:** `w-[min(84vw,380px)]`
- **Bordo/sfondo:** `rounded-[8px] border bg-white/65`
- **Hover:** `hover:-translate-y-[3px] transition-transform`
- **Immagine:** `h-28`, `variant="card"` sempre (mai "compact")
- **Badge:** `rounded-full bg-[#8b5e4a]/10 px-2.5 py-1 text-[10px] uppercase tracking-wide`
- **Titolo:** `font-serif text-2xl font-medium`
- **CTA principale:** `bg-[#211815] text-white` (stessa pill del workshop)
- **CTA preview/non disponibile:** `bg-[#f4efe8]/70 text-[#211815]`

---

## Pattern scroll "1 card e mezza"

Nel container dello scroll orizzontale del calendario, imposta:
- `px-4` sul container esterno
- `scroll-px-4` per allineare lo snap
- La larghezza `w-[min(84vw,380px)]` già produce il peek della card successiva su mobile

Verifica che si veda esattamente **1 card + metà della seconda** su viewport mobile (375px).

---

## File da modificare

- `src/components/calendar/CalendarExplorer.tsx` → componente interno `EventCard`
  - Aggiorna larghezza, sfondo, bordo, hover, immagine, badge, CTA
  - Mantieni tutti i dati esistenti (categoria, data, titolo, tags, descrizione, bottoni)
  - Rimuovi il layout `compact` (grid orizzontale) se presente — usa solo layout verticale come workshop
  - Rimuovi `variant="compact"` da EventImage, usa sempre `variant="card"`

Non toccare: `WorkshopPageClient.tsx`, `EventImage.tsx`, tipi dati, routing, Supabase, Ticket Tailor.

---

## Controllo qualità

```
npx.cmd tsc --noEmit
npm.cmd run lint
```

Se ci sono errori, correggili prima di mostrare il report.

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [descrizione]

MODIFICHE STILE APPLICATE:
- [proprietà]: [vecchio valore] → [nuovo valore]

ERRORI RESIDUI:
- [eventuale errore e motivo]
```
