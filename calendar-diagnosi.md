# TASK: Diagnosi — perché le card del calendario sono ancora a 2 colonne

**Modalità:** Solo analisi. NON modificare nulla. Mostra SOLO il report.

---

## Problema

Le card della sezione PERCORSO (e COMMUNITY, WORKSHOP) nel calendario appaiono ancora in griglia a 2 colonne su mobile, nonostante le modifiche precedenti.

## Cosa fare

1. Apri `src/components/calendar/CalendarExplorer.tsx`
2. Cerca TUTTI i punti dove vengono renderizzate le card degli eventi (cerca: `EventCard`, `grid`, `grid-cols`, `flex`, `map(`, `event.map`, `events.map`)
3. Per ogni sezione (PERCORSO, COMMUNITY, WORKSHOP) trova il container diretto che wrappa le card
4. Riporta ESATTAMENTE il JSX del container (le classi CSS applicate) per ciascuna sezione
5. Se le card sono renderizzate in un componente separato (es. `EventRail`, `DayPanel`, o simili), riporta anche quello

## Report finale

```
COMPONENTE CHE RENDERIZZA LE CARD PER SEZIONE:
- PERCORSO: [nome componente o elemento JSX + classi container]
- COMMUNITY: [nome componente o elemento JSX + classi container]
- WORKSHOP: [nome componente o elemento JSX + classi container]

ELEMENTO DIRETTO PADRE DELLE CARD (con classi CSS):
- [jsx esatto del wrapper]

ALTRI FILE COINVOLTI:
- [eventuali componenti annidati che gestiscono il layout]
```
