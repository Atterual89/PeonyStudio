# TASK: Prossime date inline — Pratica Assistita e Classi Tematiche

**Modalità:** Esegui in silenzio. Mostra SOLO il report finale.

---

## Obiettivo

Nel blocco "IN PARALLELO" di `ProgramsProgressPage`, quando l'utente seleziona "Pratica Assistita" o "Classi Tematiche", mostrare le prossime date di quegli eventi inline — esattamente come già fatto per i percorsi (Foundation 1/2, Classe 1/1+).

---

## Pattern di match

Usa questi pattern sul titolo (lowercase) per filtrare da `percorsoEvents`:

```ts
const PARALLELO_PATTERNS: Record<"pratica" | "tematica", string[]> = {
  pratica: ["pratica assistita", "pratica guidata", "guided practice"],
  tematica: ["classe tematica", "classi tematiche", "tematic", "thematic"],
};
```

---

## UI da aggiungere

Nel componente che renderizza il dettaglio di Pratica Assistita e Classi Tematiche (cerca il blocco con "IN PARALLELO AL PERCORSO"), aggiungi dopo la descrizione lo stesso blocco date già usato per i percorsi:

**Se ci sono date:**
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
          <a href={event.bookingUrl} target="_blank" rel="noopener noreferrer"
            className="rounded-full bg-[#211815] px-3 py-1.5 text-xs font-medium text-white">
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

---

## Dati disponibili

`percorsoEvents` è già passato a `ProgramsProgressPage` dal server component. Estendi il filtro anche per category `"pratica"` oltre a `"percorso"`:

In `src/app/programmi/page.tsx`, aggiorna il filtro:
```ts
const percorsoEvents = allEvents.filter(e => 
  e.category === "percorso" || e.category === "pratica"
);
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
- [file]: [cosa cambiato]

ERRORI RESIDUI:
- [errore]: [motivo]
```
