# Gestionale Workshop — FASE 2b: Correzioni dopo la prova di Laura

Leggi prima `docs/gestionale/00-contesto.md` e `docs/gestionale/analisi.md`.
Lavora sul branch `feat/gestionale`. Esegui in silenzio. Mostra solo il report finale.

Le migrazioni 010 e 011 sono **già applicate**: non modificarle. Tutte le modifiche al database vanno in una nuova migrazione `012_gw_correzioni_v2b.sql` (+ `.down.sql`), che termina con `notify pgrst, 'reload schema';`. Non applicarla.

**Prima di tutto aggiorna `00-contesto.md`** con le decisioni sotto (nuove righe D14–D17 nella tabella decisioni, e le sezioni 4.3, 5, 7 e 8 dove cambiano). Il contesto deve restare l'unica fonte di verità per le fasi successive.

---

## D14 — I workshop arrivano da Ticket Tailor

- I workshop gestiti sono gli eventi della tabella esistente `events` (sincronizzata da Ticket Tailor) **il cui nome contiene "LuXuria"** (senza distinzione maiuscole/minuscole), passati, in corso e futuri, pubblici o no.
- Lettura **in sola lettura** con il client admin lato server. Non scrivere mai su `events` né sulle tabelle `ticket_tailor_*`. Prima di scrivere codice, guarda la struttura di `events` (migrazioni e codice di sincronizzazione) per sapere quali colonne contengono nome, date e id.
- `gw_workshops` riceve una colonna `event_id` (stesso tipo della PK di `events`, senza foreign key, unica quando non nulla).
- **Dashboard:** elenca gli eventi LuXuria (Prossimi / In corso / Passati). Il collegamento con `gw_workshops` avviene da solo: aprendo un evento che non ha ancora un `gw_workshops`, la riga viene creata in automatico (funzione Postgres, con storico) con nome e date presi dall'evento.
- **Nome e date si leggono sempre dall'evento** e non si modificano nel gestionale. Nel tab Info restano modificabili solo: capienza, quota standard, percentuali, descrizione/note.
- Nel tab Info, sui workshop senza iscrizioni: pulsante **"Copia impostazioni da un workshop precedente"** (capienza, quota standard, percentuali). Sostituisce "Duplica".
- **Elimina** il pulsante "Nuovo workshop" e la pagina `/gestione/w/nuovo`.
- Se un evento sparisce da `events`, il suo `gw_workshops` resta visibile con l'etichetta "Evento non più su Ticket Tailor".

## D15 — La coppia conta 1

- L'unità di conteggio è la **prenotazione**: una coppia è 1 iscrizione e occupa 1 posto. La capienza si intende in prenotazioni.
- Dashboard e intestazione del workshop: "X iscrizioni / capienza". Ovunque si contavano persone, conta prenotazioni.
- `gw_booking_participants` riceve `is_primary boolean`. Ogni prenotazione attiva ha **esattamente un** partecipante principale (indice unico parziale). Il primo nome inserito è il principale; il partner è sempre secondario.
- "Cambia partner" sostituisce solo il secondario. "Separa" trasforma il partner in una prenotazione autonoma (principale di sé stessa).
- **Tab Partecipanti, elenco per prenotazione:** una riga "Claudia + Francesco" con il principale per primo. Dentro la riga ogni persona ha il proprio badge socio e l'eventuale "email mancante".
- Il riepilogo soci (soci / non soci / da verificare / email mancanti) resta **per persona**, perché la verifica associativa è individuale. Mostralo come "su N persone".

## D16 — Nuovi stati dell'iscrizione

| Valore | Etichetta |
|---|---|
| `interessato` | Interessato |
| `prenotato` | Prenotato a parola |
| `acconto` | Acconto pagato |
| `saldato` | Saldato |
| `lista_attesa` | Lista d'attesa |
| `cancellato` | Cancellato |

- Nella migrazione: rinomina `confermato` in `prenotato` e aggiungi `acconto` e `saldato`. Nel `.down.sql` documenta che i valori aggiunti a un enum Postgres non si possono rimuovere senza ricreare il tipo, e fai la cosa più sicura.
- **"Confermati"** (filtri, riepiloghi, copia email, appello) = `prenotato` + `acconto` + `saldato`.
- Fase 3 (da annotare nel contesto, non da implementare ora): quando si registra un pagamento e la quota è definita, lo stato passa da solo ad `acconto` (primo pagamento) o `saldato` (pagato tutto), ma solo se lo stato attuale è `interessato`, `prenotato` o `acconto`. Resta modificabile a mano.

## D17 — "Ale" al posto di "RedSabbath"

- In **tutta** l'interfaccia del gestionale e negli export la seconda parte si chiama **"Ale"** (es. "Ale: 70%", "Ale deve trasferire…", "Incassato da: Ale").
- Il valore interno dell'enum (`redsabbath`) **non cambia**: cambia solo l'etichetta, definita in un unico punto (`src/lib/gestionale/labels.ts` o equivalente).
- Aggiungi lo script `npm.cmd run gw:rename-operator -- "<vecchio>" "<nuovo>"`, con storico, e documentalo nel README degli script.

---

## Schermata "Aggiungi" (per Ale, da telefono)

Semplificala così, tutto in una schermata:
1. **Cerca:** nickname, email, nome o cognome. Risultati: persone del gestionale, poi "Dal libro soci", poi "Crea nuova: <testo>".
2. La persona scelta compare in alto come scheda compatta, con il badge socio.
3. **Stato:** quattro pulsanti grandi (Interessato · Prenotato a parola · Acconto pagato · Saldato), Interessato preselezionato. Lista d'attesa e Cancellato in un "Altro" più piccolo.
4. **Partner (facoltativo):** "+ Partner" → stessa ricerca → la persona compare sotto la prima, con l'etichetta "partner di <primo nome>".
5. **Note** (facoltative, una riga che si allarga).
6. **Salva.**

**Niente quota** in questa schermata e nel tab Partecipanti: i soldi stanno solo in Pagamenti (Fase 3). Le prenotazioni si creano con quota nulla. La quota standard verrà proposta in Fase 3.

## Completamento da parte di Laura

Nel tab Partecipanti verifica che ci sia, per ogni persona dentro la riga aperta: "Modifica dati" sul posto (nome, cognome, nickname, email, instagram, telefono) e "Cerca nel libro soci". Il filtro "Da verificare" mostra le prenotazioni con almeno una persona da verificare.

---

## Test

Aggiorna i test esistenti e aggiungi:
- evento LuXuria senza `gw_workshops` → creazione automatica all'apertura; un secondo accesso non crea doppioni (anche con accessi simultanei)
- evento non LuXuria → non compare
- coppia → conta 1 in dashboard e intestazione, 2 nel riepilogo soci
- un solo principale per prenotazione; cambia partner; separa
- stati nuovi; "confermati" = prenotato + acconto + saldato
- nessuna etichetta "RedSabbath" visibile nell'interfaccia (cerca nel codice del gestionale)
- nessuna scrittura su `events` e `ticket_tailor_*` (verifica a codice)

Poi `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:gestionale`.

---

## Report finale

```
FILES CREATI/MODIFICATI:
- [file]: [descrizione]

00-CONTESTO AGGIORNATO:
- [sezioni cambiate]

MIGRAZIONE DA APPLICARE:
- 012_gw_correzioni_v2b.sql + .down.sql

EVENTS / TICKET TAILOR:
- [colonne usate, quanti eventi LuXuria trovati]

ORA FUNZIONA:
- ...

TEST:
- [test]: OK/KO

SCELTE FATTE SU CASI AMBIGUI:
- ...

ERRORI RESIDUI:
- ...
```
