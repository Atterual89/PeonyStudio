# TASK: Completare migrazione i18n — pagine pubbliche rimanenti

**Modalità di lavoro:** Esegui tutto in silenzio. NON mostrare codice intermedio, NON descrivere ogni modifica. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche ai file.

---

## Contesto

La migrazione i18n della home è già completata. Usa SOLO la struttura esistente:
- `useLanguage()`
- `dictionary`
- `src/i18n/dictionaries/it.ts`
- `src/i18n/dictionaries/en.ts`

Non introdurre librerie esterne. Non cambiare routing né layout grafico. Non toccare Ticket Tailor, calendario, Supabase, login, area admin.

---

## File da migrare

### 1. `src/components/home/Marquee.tsx`
- Sposta l'array di testi hardcoded IT nel dizionario (`it.ts` e `en.ts`)
- Usa `useLanguage()` per scegliere la versione corretta
- Il componente deve restare graficamente identico

### 2. `src/app/workshop/page.tsx`
Migra almeno:
- "Prossimi workshop"
- "Vedi calendario completo"
- "Nessun workshop in programma"
- "Internazionale"
- "Solo coppie"
- "In programma — biglietti non ancora disponibili"
- Eventuali CTA e label visibili hardcoded

Non tradurre titoli di eventi che arrivano da dati/contenuti esterni, a meno che non esista già una struttura bilingue.
Se la pagina è Server Component, crea un client wrapper leggero (come fatto per la home).

### 3. `src/app/peony/page.tsx`
Migra almeno:
- "Come arrivare"
- "Vai alla sezione"
- "Vedi workshop"
- Eventuali heading e CTA brevi hardcoded

Se ci sono testi editoriali lunghi hardcoded e la migrazione è complessa, segnalali nel report senza migrare.
Se la pagina è Server Component, crea un client wrapper leggero.

### 4. `src/components/how-to-start/HowToStartPage.tsx`
Migra:
- "Poche domande"
- "Domanda X / Y"
- "Indietro"
- "Avanti"
- "Il tuo risultato"
- "Percorso consigliato"
- "Rifai il quiz"
- "Chiudi quiz"
- CTA e stati del quiz

Se le domande e risposte del quiz sono solo italiane, crea struttura bilingue nel dizionario oppure aggiungi versione EN.

### 5. `src/components/practice/PracticeSocialPage.tsx`
Migra:
- Eyebrow "Calendario"
- "Ramo"
- Eventuali CTA e label hardcoded visibili

Non cambiare layout.

### 6. `src/app/shop/page.tsx`
Migra:
- "Vai direttamente allo shop su Ticket Tailor"
- Eventuali altri testi brevi hardcoded visibili

---

## Controllo qualità

Dopo tutte le modifiche:
1. Cerca ancora stringhe italiane hardcoded visibili all'utente nei file modificati (escludi commenti, nomi variabili, dati tecnici)
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

ORA BILINGUE:
- [componente/sezione]

STRINGHE/PAGINE RIMASTE DA MIGRARE:
- [file]: [cosa resta e perché]

ERRORI RESIDUI:
- [errore]: [motivo]
```
