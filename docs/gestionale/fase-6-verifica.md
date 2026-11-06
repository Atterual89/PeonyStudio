# Gestionale Workshop — FASE 6: Verifica finale e preparazione alla messa online

Leggi prima `docs/gestionale/00-contesto.md` (fonte di verità, decisioni fino all'ultima), `revisione.md` e `revisione-ale.md`.
Prerequisito: Fasi 1–5 completate e tutte le migrazioni applicate da Laura.
Lavora sul branch `feat/gestionale`. Esegui in silenzio. Mostra solo il report finale.

**In questa fase correggi solo i problemi trovati. Nessuna funzionalità nuova. Nessuna scrittura sul database reale** (eccetto le letture di sola verifica indicate al punto 3, dichiarate nel report). **Niente merge, niente push**: li fa Laura alla fine, seguendo le tue istruzioni.

---

## 1. Coerenza con le decisioni

Per ogni decisione D1–D28 (e successive) di `00-contesto.md`: implementata / modificata da una decisione successiva / non implementata, con il file principale. Segnala decisioni in contraddizione tra loro o con il codice.

## 2. Audit di sicurezza

1. Ogni server action e route handler sotto `/gestione` chiama `requireOperator()` (e `requireAdmin()` dove serve) come prima istruzione. Elenco completo, eccezioni motivate.
2. Ruolo organizzatrice: per ogni loader e azione usati da Ale, nessun campo di `gw_people`, `association_members`, email salvate, stato socio, storico riservato, note fiscali altrui. Test sulle chiavi restituite per ognuno.
3. Ogni tabella `gw_` ha RLS attiva, zero policy, `REVOKE` per `anon` e `authenticated`; ogni funzione `gw_*` ha `REVOKE EXECUTE` per `public`, `anon`, `authenticated`. Verifica sui file di migrazione **e** con una sola query di sola lettura sul database reale (dichiarala).
4. `association_members`: RLS attiva e nessun privilegio per `anon`/`authenticated` (era stata chiusa a mano: verifica che sia ancora così e che nessuna migrazione la riapra).
5. Nessun import di `src/lib/gestionale/server/*` o di `src/lib/association/*` con scritture raggiunge un client component.
6. Service role key e salt mai nel bundle client (cerca i nomi delle variabili in `.next/static`); nessuna `NEXT_PUBLIC_` con segreti.
7. Cookie `gw_session`: HttpOnly, Secure (in produzione), SameSite=Lax, Path=/gestione.
8. `console.*` nel gestionale: nessun dato personale, PIN o token. Rimuovi i log di debug.
9. Export Excel e stampa rifiutano richieste senza sessione valida e non contengono dati anagrafici né note fiscali.
10. `/gestione` ha `noindex`, è esclusa da sitemap e robots.
11. Errori: non rivelano se un operatore esiste o è bloccato; i messaggi del database sono tradotti (`errors.ts`).
12. Bozza del testo incollato (localStorage): solo testo scritto dall'operatore, chiave per workshop e operatore, scadenza 7 giorni, cancellata al logout.
13. `npm audit`: elenca le vulnerabilità **nelle dipendenze aggiunte dal gestionale** (exceljs, vitest, pglite) e quelle già presenti nel sito. Non lanciare `audit fix`: proponi le azioni.

## 3. Regressioni sul sito pubblico

- `git diff --name-only main...feat/gestionale`: elenca **tutti** i file modificati fuori da `src/app/gestione`, `src/components/gestionale`, `src/lib/gestionale`, `scripts/gestionale`, `docs/gestionale`, `supabase/migrations` e test. Per ognuno: motivo e rischio (basso/medio/alto). Attenzione in particolare a: `src/lib/association/*` (stato soci, periodi, validazione manuale), `members-book.ts` e `sheets.ts` (lettura colonne), route `manual-validate` e nuova route di revoca, `src/app/admin/ticket-tailor/page.tsx`, `BottomNav`, `GlobalFooter`, `robots.ts`, `proxy.ts`, `package.json`.
- Test di confronto della pagina admin (stato soci con e senza `referenceDate`, validazione manuale): ancora verdi.
- `npm.cmd run build`: confronta l'elenco delle rotte con `main` (solo aggiunte sotto `/gestione` e la nuova route admin di revoca).
- Conferma che middleware/proxy, layout radice, sitemap e robots si comportano come prima per tutte le rotte non `/gestione`.
- Lint dell'intero progetto: i 2 errori già presenti (`ticket-tailor/page.tsx`, `ProgramsProgressPage.tsx`) — verifica che **non** facciano fallire il build su Netlify; se sì, proponi la correzione minima.

## 4. Responsive e usabilità

Verifica a 360 px, 768 px e 1280 px, per **admin** e per **Ale**: login, home con recap, tab Iscrizioni (Ale), Partecipanti (admin), Conti, Email (admin), Info, Aggiungi, box di testo e anteprima, scheda persona, Persone, Cerca, Altro, Storico. Nessuno scroll orizzontale, nessun testo troncato, menu non tagliati. Riporta i problemi trovati e corretti.

## 5. Pulizia

- Il workshop di prova "Non collegato a Ticket Tailor": verifica in sola lettura se esiste ancora; se sì, dillo a Laura (lo elimina lei).
- Codice morto: componenti, funzioni e colonne non più usati (es. vecchio tab Pagamenti, `attendance` per persona, `gw_membership_overrides`, StatusPicker a bottoni). Rimuovi il codice; per le colonne/tabelle **non** scrivere migrazioni di eliminazione, elencale soltanto.
- `.gitignore`: `docs/gestionale/specifica.md` escluso; nessun file con dati reali nel repository (cerca nomi ed email reali nei test, nella documentazione e nei fixture).

## 6. Documentazione

`docs/gestionale/README.md`, in italiano, breve:
- cos'è, dove si trova (`/gestione`), chi lo usa e con quale ruolo;
- elenco delle migrazioni in ordine, con una riga ciascuna, e come applicarle;
- variabili d'ambiente (locale e Netlify): `SUPABASE_SERVICE_ROLE_KEY`, `GW_IP_HASH_SALT`, eventuali altre;
- script operatori (crea PIN, cambia PIN, ruolo, rinomina, sblocca, revoca sessioni, elenco) per Windows;
- cosa fare se un PIN viene compromesso;
- backup: come esportare le tabelle `gw_` da Supabase (verifica cosa offre il piano attuale);
- **promemoria gennaio 2027**: aggiornare il caricatore del libro soci (`members-book.ts`) per la colonna dell'anno sociale 2027 e verificare i periodi in `membership-periods.ts`;
- come eseguire i test.

Più una **guida d'uso per Ale** (`docs/gestionale/guida-ale.md`), una pagina, linguaggio semplice: entrare con il PIN, impostare il prezzo, aggiungere una persona, incollare dagli appunti, registrare un pagamento, correggerlo, restituire soldi, aggiungere una spesa, leggere "Devi dare X € a Peony".

## 7. Controlli finali

```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:gestionale
npm.cmd run test:gestionale:sql
npm.cmd run build
```

Commit "gestionale: verifica finale". Niente push.

---

## Report finale

```
DECISIONI: implementate N · superate N · non implementate N (quali)

AUDIT SICUREZZA:
- 1..13: OK / CORRETTO / PROBLEMA [dettaglio]

FILE DEL SITO MODIFICATI SUL BRANCH:
- [file]: [motivo] — rischio [basso/medio/alto]

RESPONSIVE: [problemi corretti]

PULIZIA: [codice rimosso] · [colonne/tabelle inutilizzate, da non toccare ora]

PRONTO PER LA MESSA ONLINE: SÌ / NO — [cosa manca]

PASSI PER ANDARE ONLINE (li esegue Laura, uno alla volta, con cosa controllare dopo ognuno):
1. Variabili d'ambiente su Netlify: ...
2. Verifica che tutte le migrazioni siano applicate: [query di controllo]
3. Merge di feat/gestionale in main: [comandi esatti]
4. Push → Netlify pubblica: cosa controllare (sito pubblico, area personale, admin, /gestione)
5. Creare/verificare i PIN in produzione
6. Come tornare indietro se qualcosa non va: [comandi esatti]

ERRORI RESIDUI:
- ...
```
