# Gestionale Workshop — FASE 2: Workshop, persone e iscrizioni

Leggi prima `docs/gestionale/00-contesto.md` e `docs/gestionale/analisi.md`.
Prerequisito: la migrazione `gw_schema_v1` è stata applicata e il login funziona.

Lavora sul branch `feat/gestionale`. Esegui in silenzio. Mostra solo il report finale.

---

## Regole di questa fase

- Ogni scrittura passa da `requireOperator()` e scrive in `gw_audit_log`.
- Le operazioni su più tabelle sono funzioni Postgres `gw_*` in una **nuova** migrazione `gw_functions_v2` (con `.down.sql`), non applicata.
- Aggiornamenti con controllo `version` (sezione 4.1 del contesto).
- Niente pagamenti in questa fase: la quota concordata si può inserire, i pagamenti arrivano in Fase 3.
- Struttura delle schermate: **sezione 8 del contesto** (vincolante).

---

## 1. Dashboard workshop — `/gestione`

- Tre gruppi richiudibili: **Prossimi**, **In corso**, **Passati**. Prossimi e In corso aperti, Passati chiuso. Lo stato si calcola dalle date nel fuso Europe/Rome.
- Card workshop: nome, date, confermati / capienza (es. "9 / 12"), lista d'attesa, cancellati.
- I conteggi sono **persone attive**, non prenotazioni: una coppia confermata conta 2.
- Pulsante grande "Nuovo workshop".

## 2. Creazione e duplicazione

- Form: nome (obbligatorio), data inizio (obbligatoria), data fine (predefinita = inizio), descrizione, capienza, quota standard, percentuale Peony (predefinita 30; mostra la percentuale RedSabbath calcolata accanto).
- "Duplica" dal dettaglio workshop: copia nome (con suffisso " (copia)"), descrizione, capienza, quota standard, percentuale. Le date restano vuote e vanno inserite. Nient'altro viene copiato.

## 3. Dettaglio workshop — `/gestione/w/[id]`

Struttura a tab della **sezione 8 del contesto**. In questa fase costruisci la cornice con tutti e 4 i tab:
- **Partecipanti** e **Info**: complete (sotto).
- **Pagamenti** e **Conti**: solo un segnaposto "Disponibile nella prossima versione". Arrivano in Fase 3 e 4.

**Intestazione** (sopra i tab): nome, date, "confermati / capienza".

**Tab Partecipanti**
- Spazio riservato in cima per il box di testo (Fase 3): per ora non mostrare nulla.
- Riepilogo: soci in regola · non soci · da verificare · email mancanti (solo partecipanti confermati).
- Elenco **per persona**: nome visualizzato, email o "email mancante", "in coppia con X" se applicabile, **badge stato socio** (sezione 1 bis sotto), stato iscrizione se diverso da confermato.
- Filtri a chip: Confermati (predefinito) · Lista d'attesa · Interessati · Cancellati · Da verificare · Non soci.
- Tocco su una persona → si apre sul posto: stato iscrizione, quota concordata della prenotazione, note, partner, link "Apri scheda".
- Azioni in fondo: **+ Aggiungi** (vedi sezione 4).
- Su desktop: tabella ordinabile al posto delle righe.

**Tab Info:** modifica dei dati del workshop (stesso form della creazione) + "Duplica".

## 3 bis. Stato socio (anticipato dalla Fase 5)

Implementa qui **la parte di lettura** della sezione 1 di `fase-5-associazione-operativita.md`: modulo `membership.ts` in sola lettura su `association_members`, regola dello stato della sezione 4.3 del contesto, badge.
- Il collegamento persona ↔ socio si crea già dall'aggiunta rapida (sezione 4) e, per le persone senza collegamento, con un pulsante "Cerca nel libro soci" nella riga aperta: mostra i soci con email o nome simili e collega con un tocco di conferma.
- Correzioni manuali (`gw_membership_overrides`) e la pagina di abbinamento in blocco restano in Fase 5.

## 4. Aggiunta rapida

Flusso in **una schermata**:
1. Campo di ricerca: mentre si scrive mostra le persone esistenti (nickname, nome, cognome, email, instagram; senza distinzione di maiuscole e accenti).
   Sotto, in un gruppo separato **"Dal libro soci"**, mostra le righe di `association_members` (sola lettura, client admin lato server) che corrispondono per nome, cognome o email e che non sono già collegate a una persona del gestionale. Seleziona solo id, nome, cognome, email e scadenza: mai codice fiscale, data di nascita o numero di tessera.
2. Tocco su una persona → selezionata. Tocco su un socio → crea una nuova persona con nome, cognome ed email precompilati e `association_member_id` collegato. Oppure "Crea nuova: <testo>": il testo diventa nickname (una parola) o nome + cognome (più parole).
3. Facoltativo: "+ Partner" con la stessa ricerca.
4. Stato (predefinito Confermato), quota (precompilata con la quota standard), note.
5. "Salva" → la prenotazione appare in lista. Messaggio di conferma.

Se la persona ha già un'iscrizione attiva al workshop: errore chiaro, nessun salvataggio.

## 5. Coppie

- Una prenotazione può avere 1 o 2 partecipanti attivi. La quota è della prenotazione.
- "Cambia partner": `removed_at` sul vecchio partecipante + nuova riga. Il vecchio partner resta visibile nello storico della prenotazione ("Partner precedente: X, rimosso il …").
- "Separa": la persona diventa una prenotazione autonoma senza quota (la quota resta sulla prenotazione originale), con avviso da rivedere.

## 6. Anagrafica — `/gestione/persone` e `/gestione/p/[id]`

- Elenco con ricerca. Ogni riga mostra nome visualizzato (nickname, oppure nome e cognome), email o "Email mancante".
- Scheda persona: tutti i campi modificabili + **storico workshop** (workshop, data, stato, presenza).
- Avviso non bloccante se l'email è già usata da un'altra persona.
- **Possibili duplicati:** nella scheda mostra le persone con nickname, nome+cognome o email uguali (normalizzati). Pulsante "Unisci" → schermata di confronto campo per campo, con scelta del valore da tenere → conferma esplicita. L'unione sposta le iscrizioni sulla persona principale e imposta `merged_into` sull'altra. Se entrambe sono iscritte allo stesso workshop, l'unione si blocca con un messaggio chiaro.
- Le persone unite non compaiono nelle ricerche.

## 7. Ricerca globale — `/gestione/cerca`

- Un campo, risultati mentre si scrive (debounce 250ms, minimo 2 caratteri).
- Ogni risultato: nome, email, instagram, workshop collegati (ultimi 3).
- Tocco → scheda persona.

## 8. Test

Test unitari o di integrazione sulle funzioni Postgres, se il progetto lo permette; altrimenti test sulle funzioni TypeScript che le chiamano, con il client mockato. Copri i casi di specifica sez. 18, gruppi "Anagrafica" e "Prenotazioni":
- persona con solo nickname, completata dopo
- duplicato riconosciuto, unione, unione bloccata
- stessa persona in due workshop
- singolo, coppia con quota complessiva, cambio partner
- iscrizione duplicata nello stesso workshop rifiutata
- lista d'attesa → confermato
- conflitto di versione

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

TEST:
- [test]: OK/KO

SCELTE FATTE SU CASI AMBIGUI:
- ...

ERRORI RESIDUI:
- ...
```
