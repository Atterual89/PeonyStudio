# TASK: Fix rifiniture desktop/laptop + accenti mancanti

**Modalità di lavoro:** Esegui tutto in silenzio. NON mostrare codice intermedio, NON descrivere ogni modifica. Mostra SOLO il report finale in fondo a questo file. Conferma automaticamente tutte le modifiche ai file.

---

## Contesto

Da una verifica visiva su `/` e `/calendario` (desktop largo, laptop medio, tablet, mobile) sono emersi alcuni fix minori, non bloccanti. Vanno sistemati senza toccare la struttura generale, il routing, Ticket Tailor, Supabase, login/area admin, né il lavoro già fatto sul mobile (BottomNav, header mobile, area personale).

File coinvolti (verifica se sono effettivamente questi prima di modificare):
- `src/components/HomeContentClient.tsx`
- `src/components/home/EntryDoorsSection.tsx`
- `src/components/home/FeaturedEventsSection.tsx`
- `src/components/calendar/CalendarExplorer.tsx`
- `src/components/site/SiteHeader.tsx`

---

## Fix 1 — Spazio vuoto tra hero/marquee e sezione "Orientamento" (desktop/laptop)

Su desktop e laptop largo, dopo hero + marquee c'è una fascia vuota troppo ampia prima che entri la sezione "Orientamento/Appuntamenti" (probabilmente `EntryDoorsSection.tsx` o l'ordine in `HomeContentClient.tsx`). Riduci il margine/padding verticale tra le due sezioni finché il passaggio non sembra un respiro intenzionale invece che un buco editoriale. Non toccare il layout mobile, che va già bene.

## Fix 2 — Chip filtri calendario tagliate (desktop/tablet)

In `CalendarExplorer.tsx`, su desktop/tablet le chip dei filtri scorrono come rail orizzontale anche quando c'è spazio a sufficienza, e alcune label vengono tagliate a destra (es. "Wo…", "Sta…"). Su questi breakpoint, fai wrappare le chip su più righe invece di forzare lo scroll orizzontale. Se per qualche motivo il rail va mantenuto anche su desktop/tablet, aggiungi una maschera/fade o un indicatore di scroll più esplicito ai bordi — ma la soluzione preferita è il wrap.
Il comportamento mobile (rail orizzontale) va mantenuto invariato.

## Fix 3 — Breakpoint header troppo "mobile" su laptop medio

In `SiteHeader.tsx`, intorno a ~1180px l'header passa già al comportamento mobile con bottone "Menu", risultando percettivamente troppo mobile per un laptop medio. Valuta di alzare leggermente il breakpoint a cui scatta la versione mobile dell'header, oppure di rendere la versione "laptop" più intenzionale (es. mostrare comunque i link principali invece del solo bottone Menu, se c'è spazio). Prima di cambiare il breakpoint, verifica che non rompa nulla sul mobile reale.

## Fix 4 — Accenti mancanti nei testi UI (tutti i breakpoint, tutto il sito)

Cerca nel progetto stringhe visibili all'utente con vocali che dovrebbero avere l'accento e non ce l'hanno (es. "piu" → "più", "continuita" → "continuità", "perche" → "perché", "puo" → "può", "gia" → "già", "cosi" → "così", ecc.). Includi sia stringhe hardcoded sia quelle già nei dizionari `src/i18n/dictionaries/it.ts`. Non toccare l'inglese (`en.ts`), non toccare nomi propri, URL, slug o chiavi tecniche. Correggi solo l'italiano visibile nell'interfaccia.

---

## Controllo qualità

Dopo tutte le modifiche:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILE MODIFICATI:
- [file]: [descrizione breve del fix applicato]

FIX APPLICATI:
- Fix 1 (spazio hero/orientamento): [fatto / non applicabile, perché]
- Fix 2 (chip filtri calendario): [fatto / non applicabile, perché]
- Fix 3 (breakpoint header): [fatto / non applicabile, perché]
- Fix 4 (accenti mancanti): [elenco stringhe corrette, file per file]

ERRORI RESIDUI:
- [errore]: [motivo]
```
