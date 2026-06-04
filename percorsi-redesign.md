# TASK: Redesign pagina /percorsi

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## Contesto

La pagina `/percorsi` esiste già con timeline interattiva e accordion. Va migliorata graficamente e semplificata. Non toccare routing, Supabase, auth, admin.
Usa la struttura i18n esistente: `useLanguage()`, dizionari `it.ts` e `en.ts`.

---

## 1. Tab Percorsi / Workshop — stile browser

I tab Percorsi e Workshop devono sembrare tab di un browser:
- Forma con angoli arrotondati in alto (border-radius solo su top-left e top-right)
- Tab attivo: sfondo bianco/chiaro, bordo in alto e ai lati, nessun bordo in basso — si fonde col contenuto sotto
- Tab inattivo: sfondo leggermente grigio/beige, meno contrasto
- Linea orizzontale sotto i tab che si estende a tutta larghezza — il tab attivo la "interrompe"
- Effetto: il tab attivo sembra aperto e il contenuto sotto fa parte del tab

---

## 2. Corda con nodi — timeline responsiva

Sostituisci la timeline esistente con una corda progressiva:

**Struttura visiva:**
- Linea orizzontale che occupa il 100% della larghezza disponibile
- 4 nodi distribuiti equamente: F1, F2, C1, C1+ — sempre tutti visibili, nessuno scroll orizzontale
- I nodi sono cerchi con bordo, leggermente più grandi della linea
- La linea a sinistra del nodo selezionato diventa più spessa e colorata (colore accent del sito)
- La linea a destra resta sottile e muted
- Tutti e 4 i nodi adattano la loro posizione alla larghezza dello schermo (`justify-between` o `grid grid-cols-4`)

**Label nodi:**
- Sotto ogni nodo: nome per esteso — `Foundation 1`, `Foundation 2`, `Classe 1`, `Classe 1+`
- Font piccolo, centrato sotto il nodo
- Se lo spazio è troppo stretto su mobile, usa abbreviazioni: `F1`, `F2`, `C1`, `C1+`

**Stato default:** nessun nodo attivo — mostra testo discreto sotto la corda:
IT: `Seleziona un percorso per scoprire cosa si lavora`
EN: `Select a program to learn more`

---

## 3. Attività parallele — binario secondario

Pratica Assistita e Classi Tematiche non devono sembrare allo stesso livello dei percorsi principali.

Mostrali come **binario secondario visivamente separato**:
- Sotto la corda principale, una linea tratteggiata più sottile
- Label `IN PARALLELO` / `IN PARALLEL` come eyebrow
- Due pill/badge cliccabili: `Pratica Assistita` e `Classi Tematiche`
- Cliccando su uno, si espande il dettaglio inline (stesso pattern dei nodi principali)
- Connessione visiva alla corda principale: una piccola linea verticale tratteggiata che scende dalla corda ai due badge

---

## 4. Dettaglio nodo — inline + modal

Quando si clicca un nodo della corda:
- Si espande una sezione **inline sotto la corda** con:
  - Nome percorso + sottotitolo colorato
  - Descrizione breve
  - Sezione `COSA SI LAVORA` con lista
  - Sezione `PER CHI È`
  - Bottone `Vedi prossime date →`
  - Link discreto `Dettagli aggiuntivi →` che apre una **modal** con info extra
- Animazione smooth di apertura (transition height o fade-in)
- Un solo nodo aperto alla volta

**Rimuovi:**
- L'accordion "SCOPRI TUTTO IL PERCORSO" — è ridondante con la timeline
- La card "Area personale / Il tuo percorso quando accedi" — fuori posto qui
- Il testo "Clicca su uno dei nodi per approfondire" — sostituito dal testo default sopra

---

## 5. CTA finale — link ai Workshop

Aggiungi in fondo alla pagina (sotto tutto il contenuto dei percorsi) una sezione CTA:

IT:
- Eyebrow: `VUOI ANDARE OLTRE?`
- Testo: `Esplora i workshop internazionali ospitati da Peony Studio.`
- Bottone: `Vai ai workshop →` → link a `/workshop`

EN:
- Eyebrow: `WANT TO GO FURTHER?`
- Testo: `Explore the international workshops hosted at Peony Studio.`
- Bottone: `View workshops →` → link a `/workshop`

---

## 6. Testo sottotitolo

Correggi il sottotitolo della pagina — rimuovi "studio" se presente nel contesto di "scuola" (ma "studio" come luogo va bene):
- Attuale: `Una progressione chiara, costruita per farti crescere nello studio del Kinbaku LuXuria, un passo alla volta.`
- Nuovo IT: `Una progressione chiara, un passo alla volta, nel Kinbaku LuXuria.`
- Nuovo EN: `A clear progression, one step at a time, in Kinbaku LuXuria.`

---

## 7. i18n

Aggiorna `it.ts` e `en.ts` con tutte le stringhe nuove nella sezione `programs`:
- Label nodi, testo default, eyebrow parallelo, CTA workshop
- Tutti i testi nuovi

---

## Controllo qualità

1. Verifica che tutti e 4 i nodi siano visibili senza scroll su mobile (320px) e desktop
2. Verifica che la progress line si colori correttamente al click
3. Verifica che l'accordion ridondante sia rimosso
4. Verifica che la CTA workshop in fondo sia presente
5. Esegui:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI/CREATI:
- [file]: [descrizione breve]

FUNZIONA:
- [feature]

BILINGUE:
- [sezione]

PROBLEMI O LIMITI:
- [problema]: [motivo]

ERRORI RESIDUI:
- [errore]: [motivo]
```
