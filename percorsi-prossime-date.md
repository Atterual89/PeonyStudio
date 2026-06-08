# TASK: Prossime date inline nei percorsi — Foundation 1/2, Classe 1/1+

**Modalità:** Esegui in silenzio. Mostra SOLO il report finale.

---

## Obiettivo

Nella pagina `/percorsi` (ProgramsProgressPage), quando l'utente seleziona un percorso (Foundation 1, Foundation 2, Classe 1, Classe 1+), invece di un bottone generico "Vedi prossime date → /calendario", mostrare direttamente le prossime date di quel percorso specifiche da Ticket Tailor, con CTA "Prenota" per ciascuna.

Se non ci sono date disponibili, mostrare un messaggio "Nessuna data in programma al momento" e nascondere il bottone o renderlo inattivo.

---

## Architettura

### Step 1 — Fetch eventi nel Server Component

`src/app/percorsi/page.tsx` è un Server Component (o alias di uno). Aggiungi il fetch degli eventi percorso:

```ts
import { getUpcomingEvents } from "@/lib/events";

// Fetch eventi futuri con category "percorso"
const allEvents = await getUpcomingEvents(30); // prendi i prossimi 30
const percorsoEvents = allEvents.filter(e => e.category === "percorso");
```

Passa `percorsoEvents` come prop a `ProgramsProgressPage`.

### Step 2 — Mapping titolo → percorso

In `ProgramsProgressPage` (o in un file utility), crea questa funzione di match:

```ts
function matchPercorso(events: PeonyEvent[], percorsoIndex: number): PeonyEvent[] {
  const patterns: Record<number, string[]> = {
    0: ["foundation 1", "foundation1", "base 1"],          // Foundation 1
    1: ["foundation 2", "foundation2", "base 2"],          // Foundation 2
    2: ["classe 1", "class 1", "classe #1"],               // Classe 1 (escludi "1+")
    3: ["classe 1+", "classe 1 +", "class 1+", "classe1+"] // Classe 1+
  };
  const keywords = patterns[percorsoIndex] ?? [];
  return events.filter(e => {
    const title = e.title.toLowerCase();
    // Per index 2 (Classe 1), escludi titoli che contengono "1+"
    if (percorsoIndex === 2 && (title.includes("1+") || title.includes("1 +"))) return false;
    return keywords.some(k => title.includes(k));
  });
}
```

### Step 3 — UI prossime date nel ProgramDetail

Nel componente `ProgramDetail` (dentro ProgramsProgressPage), sostituisci il bottone "Vedi prossime date → /calendario" con questo blocco:

**Se ci sono date:**
```
┌─────────────────────────────────────────┐
│ PROSSIME DATE                           │  ← eyebrow label, 10px uppercase
│                                         │
│  • 7 giu  →  Prenota                   │  ← ogni evento: data + CTA prenota
│  • 28 giu →  Prenota                   │
│  • 12 lug →  In programma              │  ← se no bookingUrl
└─────────────────────────────────────────┘
```

Struttura JSX:
```tsx
<div className="mt-4 rounded-[10px] border border-[#211815]/10 bg-[#f4efe8]/50 p-4">
  <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-[#8b5e4a]">
    Prossime date
  </p>
  <div className="flex flex-col gap-2">
    {matchedEvents.slice(0, 4).map(event => (
      <div key={event.id} className="flex items-center justify-between">
        <span className="text-sm text-[#211815]">
          {event.dateLabel ?? event.date}
          {event.timeLabel ? ` · ${event.timeLabel}` : ""}
        </span>
        {event.bookingUrl ? (
          <a
            href={event.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#211815] px-3 py-1.5 text-xs font-medium text-white"
          >
            Prenota
          </a>
        ) : (
          <span className="rounded-full border border-[#211815]/20 px-3 py-1.5 text-xs text-[#6b5c52]">
            In programma
          </span>
        )}
      </div>
    ))}
  </div>
</div>
```

**Se non ci sono date:**
```tsx
<p className="mt-4 text-sm text-[#6b5c52]">
  Nessuna data in programma al momento.
</p>
```

Rimuovi il bottone `<Link href="/calendario">Vedi prossime date</Link>` esistente — non serve più.

---

## Gestione tipi

`ProgramsProgressPage` attualmente non riceve eventi come prop. Aggiorna la sua firma:

```ts
type Props = {
  // props esistenti...
  percorsoEvents?: PeonyEvent[];
}
```

Il campo è opzionale (`?`) così se il fetch fallisce o è vuoto il componente non si rompe.

---

## Dopo le modifiche

```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale

```
FILES MODIFICATI:
- [file]: [cosa cambiato]

PERCORSI CON DATE TROVATE (da log/build):
- Foundation 1: [sì/no]
- Foundation 2: [sì/no]
- Classe 1: [sì/no]
- Classe 1+: [sì/no]

ERRORI RESIDUI:
- [errore]: [motivo]
```
