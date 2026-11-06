# Gestionale Workshop — FASE 5: Associazione, presenze, email, storico

Leggi prima `docs/gestionale/00-contesto.md` e `docs/gestionale/analisi.md` (sezione dati riutilizzabili).
Prerequisito: Fase 4 applicata e verificata.

Lavora sul branch `feat/gestionale`. Esegui in silenzio. Mostra solo il report finale.

Nuove funzioni Postgres in una nuova migrazione `gw_functions_v5` (+ `.down.sql`), non applicata.

---

## 1. Stato associativo (UR Expression APS)

**La lettura, la regola dello stato, i badge e il collegamento singolo sono già stati fatti in Fase 2** (sezione 3 bis). In questa fase verifica che funzionino e aggiungi: pagina di collegamento in blocco, collegamento/scollegamento dalla scheda persona, correzioni manuali.

Fonte: tabella esistente `association_members`, **sola lettura** (D11). Niente import CSV, niente TeamArtist. Il gestionale non scrive mai su `association_members` e non ne modifica la struttura.

**Lettura**
- Solo dal client admin lato server (`src/lib/supabase/admin.ts`), in un modulo `src/lib/gestionale/server/membership.ts`.
- Leggi solo le colonne necessarie: id, nome, cognome, email, inizio e scadenza associazione. **Non** selezionare codice fiscale, data di nascita o numero di tessera.
- Tieni conto delle righe con `source = manual_override` come fa già il resto del sito (verifica come vengono usate in `analisi.md` e nel codice esistente, e replica la stessa logica di priorità).

**Collegamento persone — `/gestione/altro/soci`**
- Elenco delle persone del gestionale non ancora collegate, con la corrispondenza proposta: prima per email (normalizzata), poi per nome + cognome. Il collegamento per sola email è proposto preselezionato; quello per nome + cognome richiede conferma esplicita. Pulsante "Conferma selezionati".
- Nella scheda persona: campo "Libro soci" con ricerca per collegare o scollegare manualmente.
- Il collegamento scrive solo `gw_people.association_member_id`, con storico.

**Stato associativo**
- Applica la regola della sezione 4.3 del contesto (override → periodo di associazione → da verificare).
- Badge nel tab Partecipanti e nella scheda persona: **Socio fino al [scadenza]** / **Non socio** / **Da verificare**.
- Nella scheda persona: correzione manuale per un anno (`gw_membership_overrides`), con nota e storico. Serve quando il libro soci non è aggiornato.

**Già collegato in Fase 2:** se in Fase 2 una persona è stata creata dal libro soci, è già collegata. Non serve rifare l'abbinamento.

## 2. Presenze

Tutto dentro il **tab Partecipanti** (sezione 8 del contesto), nessuna pagina separata.

- Pulsante **Appello** nel tab Partecipanti: attiva una modalità compatta (solo confermati, pulsanti grandi **Presente** / **Assente** su ogni persona, contatore "presenti X / Y" in alto). "Fine appello" torna alla vista normale. Un tocco sul pulsante già attivo torna a "non registrata".
- La presenza è per persona, non per prenotazione: in una coppia ognuno ha la sua.
- La presenza non cambia lo stato dell'iscrizione e non tocca i dati associativi.
- Filtri a chip aggiuntivi nel tab: Presenti · Assenti.

## 3. Copia email

Nel tab Partecipanti, pulsante **"Copia email"** con tre opzioni:
- tutti i confermati (escluse lista d'attesa, interessati e cancellati)
- solo i presenti
- selezione manuale: casella di selezione sulle righe, poi "Copia email selezionati"

Comportamento:
- Formato pronto per il campo Ccn di Gmail: indirizzi separati da `, `, senza duplicati (confronto senza distinzione maiuscole/minuscole), persone unite escluse.
- Dopo la copia: "Copiate X email. Mancano Y persone senza email:" + nomi, ognuno con il link alla scheda per completarla.
- Copia negli appunti con l'API Clipboard. Se non disponibile, mostra il testo selezionabile.

## 4. Storico modifiche — `/gestione/altro/storico`

- Elenco cronologico, dal più recente: data e ora, operatore, cosa (es. "Pagamento 250 € — Corvo — Level 2+"), azione.
- Tocco → dettaglio con **prima / dopo** campo per campo, solo per i campi cambiati.
- Filtri: operatore, workshop, tipo (anagrafica, iscrizioni, pagamenti, spese, consuntivo, accessi).
- Paginazione a 50 righe.
- Dalla scheda persona e dal tab Conti: link "Storico" già filtrato.
- Verifica che nessuna riga di storico contenga PIN, hash o token.

## 5. Rifinitura mobile

Rivedi tutte le schermate del gestionale a 360px di larghezza:
- nessuno scroll orizzontale
- nessun testo tagliato senza modo di leggerlo
- pulsanti principali raggiungibili con il pollice (parte bassa dello schermo)
- tastiera numerica su tutti i campi importo, PIN e telefono
- stati di caricamento visibili per le azioni oltre i 300ms

Elenca nel report le correzioni fatte.

## 6. Test

- Abbinamento al libro soci: per email, per nome (da confermare), nessuna corrispondenza.
- Stato associativo per data del workshop: associazione valida fino al 31/12/2026 → workshop di novembre 2026 "Socio", workshop di febbraio 2027 "Non socio"; persona non collegata → "Da verificare"; override che prevale sul libro soci.
- Nessuna query su `association_members` seleziona codice fiscale, data di nascita o numero di tessera (verifica a codice).
- Nessuna scrittura su `association_members` (verifica a codice).
- Copia email: duplicati rimossi, filtri corretti, mancanti elencati.
- Storico: nessun campo sensibile presente.

Dati inventati.

---

## Report finale

```
FILES CREATI/MODIFICATI:
- [file]: [descrizione]

MIGRAZIONE DA APPLICARE:
- [file] + [rollback]

ORA FUNZIONA:
- ...

LIBRO SOCI:
- [persone collegate automaticamente / da confermare / non trovate, se ci sono dati]

RIFINITURE MOBILE:
- ...

TEST:
- [test]: OK/KO

SCELTE FATTE SU CASI AMBIGUI:
- ...

ERRORI RESIDUI:
- ...
```
