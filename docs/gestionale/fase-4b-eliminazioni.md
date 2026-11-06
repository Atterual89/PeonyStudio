# Gestionale Workshop — FASE 4b: Eliminazioni

Leggi prima `docs/gestionale/00-contesto.md`. Lavora sul branch `feat/gestionale`. Esegui in silenzio. Mostra solo il report finale.

**Database:** nuova migrazione `019_gw_eliminazioni.sql` (+ `.down.sql`), che termina con `notify pgrst, 'reload schema';`. Non applicarla. **Non eseguire mai comandi che scrivono sul database reale**: prove solo in PGlite.

**Prima di scrivere codice, aggiungi a `00-contesto.md` la decisione D22** con le regole qui sotto.

---

## D22 — Eliminare ciò che è stato inserito per errore

Eliminare serve a correggere un **errore di inserimento**. Gli eventi reali hanno già i loro strumenti: ritiro → stato "Cancellato"; soldi restituiti → "Rimborso". Nei messaggi di conferma ricordalo con una riga.

**Come si elimina (vale per tutto):**
- Eliminazione **logica**: colonne `deleted_at timestamptz` e `deleted_by uuid` sulle tabelle interessate. Le righe eliminate non compaiono **da nessuna parte** (elenchi, conteggi, totali, conti, export, ricerca, abbinamenti, copia email) e non contano in nessun calcolo. Aggiorna di conseguenza **tutte** le query, le funzioni Postgres e gli indici unici (es. l'indice "una iscrizione attiva per persona e workshop" deve ignorare le righe eliminate).
- Ogni eliminazione scrive nello storico (`action = delete`) cosa è stato eliminato e da chi. Lo storico resta consultabile dagli admin.
- Conferma **sul posto**, niente finestre del browser: "Eliminare <cosa>? · Elimina · Annulla".
- Dopo l'eliminazione, messaggio "Eliminato · **Annulla**" per 10 secondi: Annulla ripristina (azzera `deleted_at`, con storico). Dopo, non c'è un cestino visibile.
- Il trigger della 010 che vieta `DELETE` e modifiche agli importi su `gw_payments` resta: l'eliminazione logica tocca solo `deleted_at`/`deleted_by`. Adegua il trigger perché permetta esattamente questo e nient'altro.

**Cosa si può eliminare e chi:**

| Elemento | Condizione | Ale (organizzatrice) | Admin |
|---|---|---|---|
| Pagamento | sempre | ✔ | ✔ |
| Iscrizione | solo se **non ha pagamenti validi** (eliminati non contano). Altrimenti: "Ha X € di pagamenti: eliminali o registra un rimborso prima." | ✔ | ✔ |
| Spesa, trasferimento, riporto | sempre | ✔ | ✔ |
| Persona | solo se **non ha iscrizioni** (eliminate non contano). Altrimenti elenca i workshop. | ✘ | ✔ |
| Workshop **non collegato a Ticket Tailor** | elimina il workshop e, insieme, tutto ciò che contiene (iscrizioni, pagamenti, spese, trasferimenti, riporti). Conferma scrivendo il nome del workshop. | ✘ | ✔ |
| Workshop collegato a Ticket Tailor | non eliminabile (arriva da Ticket Tailor) | ✘ | ✘ |

- **Pagamento: conferma sempre obbligatoria**, con i dettagli del movimento: "Eliminare il pagamento di 250 € · PayPal · 28 ott di <nome>? Non conterà più nei totali. · Elimina pagamento · Annulla". Nessuna eliminazione di pagamenti con un solo tocco, nemmeno da tastiera.
- Pagamento eliminato che era stato "modificato": elimina insieme il movimento valido e le sue rettifiche, così il totale torna come se non fosse mai esistito.
- Dopo l'eliminazione di un pagamento o di un'iscrizione si ricalcola lo stato automatico (D16) e il consuntivo (il banner "modificato dopo la verifica" funziona come per ogni altra modifica).
- Persona con iscrizioni tutte eliminate: eliminabile; le iscrizioni eliminate restano collegate solo per lo storico.
- Un riporto collegato a un workshop eliminato viene eliminato insieme.
- Lato server: ogni azione di eliminazione controlla ruolo e condizioni; Ale non vede i pulsanti né può chiamare le azioni riservate agli admin.

**Dove sono i pulsanti:** sempre nel menu "…" della riga (pagamento, spesa, trasferimento, riporto, iscrizione), mai come pulsante grande. Persona: in fondo alla scheda persona, "Elimina persona". Workshop manuale: in fondo al tab Info, "Elimina workshop".

---

## Pulizia richiesta da Laura

Il workshop di prova creato a mano (etichetta "Non collegato a Ticket Tailor") va eliminato **da Laura con il nuovo pulsante** dopo l'applicazione della 019. Non eliminarlo tu.

---

## Test

PGlite e unitari:
- pagamento eliminato: sparisce da elenchi, totali, conti ed export; stato automatico ricalcolato; Annulla lo ripristina;
- pagamento modificato eliminato: spariscono anche le rettifiche;
- iscrizione con pagamenti validi: rifiutata; dopo aver eliminato i pagamenti: consentita; la persona può essere iscritta di nuovo allo stesso workshop;
- persona con iscrizioni: rifiutata; senza: consentita; Ale: rifiutata lato server;
- workshop manuale: eliminato con tutto il contenuto; workshop Ticket Tailor: rifiutato;
- il trigger su `gw_payments` permette solo `deleted_at`/`deleted_by`;
- conteggi dashboard, riepilogo soci, copia email e consuntivo ignorano le righe eliminate;
- rollback e riapplicazione della 019.

Poi `npx.cmd tsc --noEmit`, lint del gestionale, `npm.cmd run build`, `npm.cmd run test:gestionale`, `npm.cmd run test:gestionale:sql`. Commit "gestionale: eliminazioni". Niente push.

---

## Report finale (breve)

```
FILES CREATI/MODIFICATI:
- ...

MIGRAZIONE DA APPLICARE:
- 019_gw_eliminazioni.sql + .down.sql

ORA FUNZIONA:
- ...

TEST:
- ...

SCELTE FATTE SU CASI AMBIGUI:
- ...
```
