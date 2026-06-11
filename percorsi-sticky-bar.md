# TASK: Percorsi — barra sticky + leggibilità elementi cliccabili

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## File da leggere prima di modificare

- `src/components/programs/ProgramsProgressPage.tsx`

---

## Modifica 1 — Barra cerchi F1/F2/C1/C1+ sticky

La barra con i cerchi di navigazione (F1, F2, C1, C1+) deve rimanere visibile quando l'utente clicca su un elemento.

- Aggiungi `sticky top-0 z-10` al contenitore della barra
- Aggiungi sfondo `bg-[#f4efe8]` (stesso colore della pagina) al contenitore sticky così non è trasparente
- Aggiungi `py-4` o padding adeguato per non sembrare schiacciata
- Quando l'utente clicca un cerchio, il contenuto deve cambiare **senza scroll automatico** verso il basso — rimuovi qualsiasi `scrollIntoView`, `scrollTo` o comportamento di scroll automatico collegato al click sui cerchi

---

## Modifica 2 — Cerchi F1/F2/C1/C1+: migliorare leggibilità come elementi cliccabili

I cerchi devono essere chiaramente riconoscibili come bottoni cliccabili:

- Aggiungi `cursor-pointer` a ciascun cerchio
- Aggiungi effetto hover: `hover:border-[#8b5e4a]` o `hover:opacity-80` o simile coerente con lo stile esistente
- Aggiungi `transition-all duration-150` per smoothness
- Il cerchio attivo deve avere un bordo o riempimento più marcato rispetto agli inattivi (controlla lo stile attuale e amplificalo se necessario)

---

## Modifica 3 — Tab "PRATICA ASSISTITA" e "CLASSI TEMATICHE": renderli riconoscibili come tab

I due tab in fondo alla barra devono sembrare cliccabili:

- Aggiungi `cursor-pointer` 
- Aggiungi bordo sottile `border border-[#8b5e4a]/30` o sfondo `bg-white/40` al contenitore dei tab
- Tab attivo: sfondo leggermente più scuro o bordo più marcato rispetto all'inattivo
- Aggiungi `hover:bg-[#8b5e4a]/10` per feedback visivo al hover
- Aggiungi `transition-colors duration-150`

---

## Modifica 4 — Testo hint "Clicca su un ⊙ per scoprire cosa si lavora"

Se presente, assicurati che sia visibile e posizionato sopra i cerchi, non nascosto. Se non è presente, aggiungilo come testo piccolo `text-xs text-[#8b5e4a]/70` centrato sopra la barra cerchi.

---

## Controllo qualità

```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [descrizione]

ERRORI RESIDUI:
- [errore]: [motivo]
```
