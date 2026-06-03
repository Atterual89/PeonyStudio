# TASK: i18n — Collegare le pagine pubbliche al sistema di traduzione esistente

**Modalità di lavoro:** Esegui tutti gli step in silenzio. NON mostrare il codice mentre lavori, NON descrivere ogni singola modifica. Mostra SOLO il report finale (Step 7). Se hai bisogno di conferma per modificare file, rispondi automaticamente yes.

---

## Step 1 — Analisi preliminare

Leggi questi file senza mostrare nulla:
- `src/providers/LanguageProvider.tsx`
- `src/hooks/useLanguage.ts`
- `src/lib/getDictionary.ts`
- `src/dictionaries/it.ts` e `src/dictionaries/en.ts`
- `src/content/home.ts`
- `src/app/page.tsx`

---

## Step 2 — Fix Home Page

- `src/app/page.tsx` resta Server Component — mantieni i fetch: `getFeaturedEvent()`, `getUpcomingEvents()`, `toEventCard()`
- Crea `src/components/HomeContentClient.tsx` come Client Component (`"use client"`)
- `HomeContentClient` usa `useLanguage()` e legge i testi dai dizionari in base alla lingua attiva
- `src/app/page.tsx` passa solo i dati degli eventi come props a `HomeContentClient`
- Aggiungi sezione `home` in `it.ts` e `en.ts` con tutti i contenuti di `src/content/home.ts`
- Elimina tutte le stringhe hardcoded italiane da `src/app/page.tsx`: `"Vedi calendario →"`, `"Voglio iniziare"`, `"Guarda il calendario"`, qualsiasi `ctaLabel` o prop con testo italiano

---

## Step 3 — Ricerca stringhe hardcoded

Cerca in tutto il progetto (senza mostrare nulla) queste stringhe:
`"Vedi calendario"`, `"Voglio iniziare"`, `"Guarda il calendario"`, `"Scopri di più"`, `"Pronto"`, `"Pronta"`, `"Come iniziare"`, `"Percorsi"`, `"Pratica"`, `"Prossimi"`, `"biglietti"`, `"non disponibili"`

Pagine da controllare: `src/app/come-iniziare/`, `src/app/percorsi/`, `src/app/pratica/`, `src/app/workshop/`, `src/app/peony/`, `src/app/shop/`, header, footer, navbar.

---

## Step 4 — Fix pagine pubbliche

Per ogni file con stringhe hardcoded trovato nello Step 3:
- Se è Server Component → crea `*ContentClient.tsx` con `useLanguage()`
- Aggiungi traduzioni IT/EN nei dizionari
- Non rompere funzionalità esistenti

Se le pagine da migrare sono più di 4, sistema home + footer + CTA principali e documenta il resto nel report.

---

## Step 5 — Menu e footer

- Verifica che le label di navigazione siano nei dizionari
- Elimina eventuali stringhe italiane hardcoded da footer e bottoni condivisi

---

## Step 6 — Test

Esegui in sequenza e correggi tutti gli errori:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Step 7 — Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI/CREATI:
- [file]: [descrizione breve]

FUNZIONA CON EN:
- [sezione/pagina]

DA MIGRARE:
- [pagina]: [cosa manca]

ERRORI RESIDUI:
- [errore]: [motivo]
```
