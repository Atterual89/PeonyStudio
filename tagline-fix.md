# TASK: Aggiorna tagline del sito

**Modalità di lavoro:** Esegui in silenzio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## Obiettivo

Sostituisci ovunque nel sito la tagline attuale con quella nuova.

**Vecchia tagline** (in tutte le varianti trovate):
- "Kinbaku, pratica e community a Torino"
- "Kinbaku, pratica e community a Torino."
- "Scuola, venue e community di kinbaku a Torino"
- "Scuola, venue e community di kinbaku a Torino."
- Qualsiasi variante simile con "community", "pratica", "scuola" riferita allo studio

**Nuova tagline:**
- IT: `Peony Studio — Kinbaku venue · Torino`
- EN: `Peony Studio — Kinbaku venue · Turin`

---

## Dove cercare

Cerca in tutto il progetto (src/, public/, content file, dizionari, metadata):
- `src/content/`
- `src/i18n/dictionaries/it.ts` e `en.ts`
- `src/app/layout.tsx` (metadata SEO)
- `src/app/page.tsx`
- `src/components/`
- Footer, SiteHeader, hero sections
- Qualsiasi file `.ts`, `.tsx`, `.json` che contenga le stringhe elencate sopra

---

## Regole

- Sostituisci solo le occorrenze visibili all'utente o usate come metadata/SEO
- Non toccare commenti, nomi variabili, log tecnici
- Non cambiare layout, routing, logica esistente

---

## Controllo qualità

Dopo le modifiche cerca ancora: `"community a Torino"`, `"pratica e community"`, `"scuola"` (nel contesto tagline) e verifica che non ci siano occorrenze rimaste.

Poi esegui:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [occorrenze sostituite]

ERRORI RESIDUI:
- [errore]: [motivo]
```
