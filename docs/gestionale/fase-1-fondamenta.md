# Gestionale Workshop — FASE 1: Fondamenta

Leggi prima `docs/gestionale/00-contesto.md` e `docs/gestionale/analisi.md`.
Rispetta tutte le regole della sezione 1 del contesto.

Crea il branch `feat/gestionale` (se non esiste) e lavora lì. Esegui in silenzio. Mostra solo il report finale.

---

## Obiettivo

Alla fine di questa fase devono funzionare:
- lo schema completo del database (come file di migrazione, **non applicato**);
- l'accesso con solo PIN e la sessione persistente;
- il layout vuoto di `/gestione`, protetto;
- gli script da terminale per gestire gli operatori.

Nessuna funzionalità di workshop, persone o pagamenti.

---

## 1. Migrazione schema

Un'unica migrazione `gw_schema_v1` con **tutte** le tabelle della sezione 4.3 del contesto (anche quelle usate in fasi successive), enum, vincoli, indici e indice unico parziale su `gw_booking_participants`.

Per ogni tabella:
- RLS attiva senza policy
- `REVOKE ALL ON ... FROM anon, authenticated`
- trigger `updated_at`

Indici per la ricerca: `lower()` su `nickname`, `first_name`, `last_name`, `email`, `instagram`.

File di rollback `gw_schema_v1.down.sql` che elimina **solo** gli oggetti `gw_`.

In testa alla migrazione aggiungi un controllo che fallisce se trova già tabelle con prefisso `gw_` non create da questa migrazione.

## 2. Autenticazione

Implementa la sezione 4.2 del contesto.

- `src/lib/gestionale/server/auth.ts`: `hashPin`, `verifyPin`, `createSession`, `requireOperator`, `revokeSession`, limitazione dei tentativi
- Login tramite route handler o server action in runtime **Node** (non Edge)
- Il salt per l'hash degli IP viene dalla nuova variabile `GW_IP_HASH_SALT`: aggiungila a `.env.example` (senza valore reale) e spiega nel report come generarla
- Controllo d'accesso: crea `src/proxy.ts` (Next 16) con matcher **solo** `/gestione/:path*`: redirect a `/gestione/accesso` se il cookie `gw_session` manca (escludi `/gestione/accesso` stessa). Nessun effetto su altre rotte
- Tutte le route handler del gestionale sotto `/gestione/` (D13)
- Header/BottomNav: applica la guardia descritta nella sezione 7 del contesto
- Migrazioni numerate secondo la convenzione del repository: `010_gw_schema_v1.sql` + `010_gw_schema_v1.down.sql` (e le fasi successive proseguono la numerazione)

## 3. Pagine

- `/gestione/accesso`: solo il tastierino PIN a 6 cifre con pulsanti grandi, invio automatico alla sesta cifra, messaggio d'errore generico. **Nessun nome di operatore visibile** prima dell'accesso. Dopo l'accesso: "Ciao, <nome>".
- `/gestione`: layout con la barra inferiore (Workshop · Cerca · Persone · Altro) e un segnaposto "In costruzione" per ogni voce
- `/gestione/altro`: nome dell'operatore connesso + pulsante "Esci"
- `noindex` su tutto `/gestione`; esclusione da sitemap e robots
- Nessun header, footer o BottomNav pubblici su `/gestione` (vedi analisi)

## 4. Script operatori

I quattro script della sezione 4.2 in `scripts/gestionale/`, più `scripts/gestionale/README.md` con le istruzioni in italiano per Windows (`npm.cmd`, `node`).

## 5. Test

Se non esiste un test runner, installa `vitest` come devDependency e aggiungi lo script `test:gestionale`.

Test unitari:
- hash e verifica PIN (corretto, errato, formato salvato); il PIN di ogni operatore porta all'operatore giusto
- il confronto avviene sempre con tutti gli hash attivi (nessuna uscita anticipata)
- `set-pin` rifiuta un PIN già in uso e i PIN banali
- logica di blocco: 5 errori dallo stesso IP → blocco; raddoppio della durata; azzeramento dopo un successo; limite globale; le sessioni attive restano valide durante il blocco globale
- validazione della sessione: valida, scaduta, revocata, operatore disattivato

Inoltre verifica **a codice** (descrivi nel report) che:
- nessun file sotto `src/app` o `src/components` importi `src/lib/gestionale/server/*` da un client component;
- la service role key non compaia in nessun file con `'use client'` o in variabili `NEXT_PUBLIC_`.

## 6. Controllo regressioni

- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:gestionale`
- Conferma che le rotte pubbliche, `/admin` e l'area personale non sono state toccate (elenca i file modificati fuori da `/gestione` e `src/lib/gestionale`)

---

## Report finale

```
FILES CREATI/MODIFICATI:
- [file]: [descrizione]

FILE MODIFICATI FUORI DAL GESTIONALE (devono essere pochissimi):
- [file]: [perché]

MIGRAZIONE DA APPLICARE (la applico io):
- File: [percorso]
- Rollback: [percorso]
- Istruzioni: [come applicarla con il metodo individuato in Fase 0]

NUOVE VARIABILI D'AMBIENTE:
- [nome]: [a cosa serve, dove impostarla (locale + Netlify)]

COME CREARE I PIN (passo passo, Windows):
1. ...

TEST:
- [nome test]: OK/KO

SICUREZZA VERIFICATA:
- ...

SCELTE FATTE SU CASI AMBIGUI:
- ...

ERRORI RESIDUI:
- ...
```
