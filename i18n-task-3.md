# TASK: Fix i18n — pagine pubbliche ancora in italiano

**Modalità di lavoro:** Esegui tutto in silenzio. NON mostrare codice intermedio, NON descrivere ogni modifica. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche ai file.

---

## Contesto

Home e Workshop già funzionano. Queste pagine restano in italiano e vanno corrette:
- `/come-iniziare`
- `/percorsi`
- `/pratica`
- `/peony`
- `/shop`

Usa SOLO la struttura esistente: `useLanguage()`, `dictionary`, `src/i18n/dictionaries/it.ts`, `src/i18n/dictionaries/en.ts`.
Non introdurre librerie esterne. Non cambiare routing, layout, Ticket Tailor, Supabase, auth, calendario, admin.

---

## Step 1 — Audit (silenzioso)

Controlla questi file e annota internamente i problemi:
- `src/components/how-to-start/HowToStartPage.tsx`
- `src/app/percorsi/page.tsx`
- `src/components/programs/` (tutti i file)
- `src/components/practice/PracticeSocialPage.tsx`
- `src/app/peony/page.tsx`
- `src/app/shop/page.tsx`
- `src/content/*.ts`

Per ciascuno verifica:
- stringhe italiane hardcoded visibili all'utente
- import da `src/content/*` con contenuti solo italiani
- se è Server Component senza client wrapper
- se usa `useLanguage()` o no

---

## Step 2 — Correzioni (in questo ordine di priorità)

### A. `/come-iniziare` → `src/components/how-to-start/HowToStartPage.tsx`
- Se è Client Component: aggiungi `useLanguage()` direttamente
- Se è Server Component: crea client wrapper leggero
- Migra nel dizionario: "Poche domande", "Domanda X / Y", "Indietro", "Avanti", "Il tuo risultato", "Percorso consigliato", "Rifai il quiz", "Chiudi quiz", tutte le CTA e stati del quiz
- Se domande/risposte sono solo IT: aggiungi versione EN nel dizionario

### B. `/pratica` → `src/components/practice/PracticeSocialPage.tsx` e pagina associata
- Migra: eyebrow "Calendario", "Ramo", titoli sezione, CTA, label hardcoded visibili
- Se usa content file italiano: crea selezione it/en

### C. `/shop` → `src/app/shop/page.tsx`
- Migra: "Vai direttamente allo shop su Ticket Tailor" e tutti i testi brevi visibili

### D. `/peony` → `src/app/peony/page.tsx`
- Se Server Component: crea client wrapper leggero
- Migra almeno: "Come arrivare", "Vai alla sezione", "Vedi workshop", heading e CTA principali
- Testi editoriali lunghi: migra se semplice, altrimenti segnala nel report

### E. `/percorsi` → `src/app/percorsi/page.tsx` + `src/components/programs/`
- Migra: heading, descrizioni brevi, CTA, badge, label delle card
- Se usa content file italiano: crea selezione it/en o aggiungi chiavi EN nel dizionario
- Testi editoriali lunghi: migra se semplice, altrimenti segnala nel report

---

## Criterio di accettazione

Dopo aver selezionato EN dal menu, ogni pagina deve mostrare in inglese almeno:
- Titoli e sottotitoli principali
- CTA (bottoni, link testuali)
- Label, badge, stati vuoti
- Testi sopra la fold

---

## Step 3 — Controllo qualità

1. Cerca stringhe italiane hardcoded ancora presenti nei file modificati (escludi commenti, variabili, dati tecnici)
2. Esegui in sequenza e correggi tutti gli errori:
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

PAGINE ORA BILINGUE:
- [pagina]: [cosa cambia in EN]

ANCORA PARZIALMENTE IN ITALIANO:
- [pagina/file]: [cosa resta e perché]

ERRORI RESIDUI:
- [errore]: [motivo]
```
