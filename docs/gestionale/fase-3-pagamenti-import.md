# Gestionale Workshop — FASE 3: Ruoli, iscrizioni di Ale e pagamenti

Leggi prima `docs/gestionale/00-contesto.md` (fonte di verità, aggiornata in Fase 2b).
Prerequisito: migrazioni 010, 011 e 012 applicate; operatrice già rinominata in "Ale".

Lavora sul branch `feat/gestionale`. Esegui in silenzio. Mostra solo il report finale.

**Prima di iniziare:** `git status`. Se ci sono modifiche della Fase 2b non committate, committale con messaggio "gestionale: fase 2 e 2b".

**Database:** nuova migrazione `013_gw_ruoli_pagamenti_v3.sql` (+ `.down.sql`), che termina con `notify pgrst, 'reload schema';`. Non applicarla. **Non eseguire mai comandi che scrivono sul database reale** (script `gw:*`, rpc, insert/update/delete), nemmeno per prova: usa PGlite.

**Prima di scrivere codice, aggiorna `00-contesto.md`** con le decisioni D18–D21 qui sotto. La frase "tutti gli operatori hanno gli stessi permessi" non vale più.

---

## D18 — Ruoli

| Ruolo | Chi | Cosa vede e fa |
|---|---|---|
| `admin` | Laura, Andrea | Tutto. |
| `organizzatrice` | Ale | Dashboard workshop; nel workshop i tab **Iscrizioni**, **Conti**, **Info**. **Non vede**: libro soci, stato socio, anagrafica (schede persona, email/instagram/telefono salvati, persone di altri workshop), Cerca, Persone, storico. Vede le persone **solo come le ha scritte lei**. |

- Colonna `gw_operators.role` (enum `gw_operator_role`), default `organizzatrice` (privilegio minimo). La migrazione imposta `admin` a tutti gli operatori esistenti **tranne** quello con nome "Ale" (senza distinzione maiuscole/minuscole), che resta `organizzatrice`.
- Nuovo script `npm.cmd run gw:set-role -- "<nome>" admin|organizzatrice`; `gw:list-operators` mostra il ruolo.
- **Applicazione lato server, non solo UI:** `requireOperator()` restituisce il ruolo; nuovo `requireAdmin()`. Ogni server action, route handler e loader di dati riservati agli admin lo chiama. Le pagine `/gestione/persone`, `/gestione/cerca`, `/gestione/p/*`, `/gestione/altro/storico` e i soci restituiscono 404 a un'organizzatrice.
- I loader usati da Ale **non selezionano** mai campi di `gw_people` né dati di `association_members`: costruiscono le righe da `entered_as` (D20) e dai dati economici. Verificalo con un test che controlla le chiavi restituite.
- Barra in basso per Ale: **Workshop · Altro**.

## D19 — Quota del workshop e quota della prenotazione

- La quota è **per prenotazione**: singolo o coppia pagano la stessa quota (es. 450 €).
- **Primo passo di Ale:** se il workshop non ha quota standard, il tab Iscrizioni mostra solo il riquadro "Imposta la quota del workshop" (campo importo + Salva). Finché manca, "Aggiungi" e il box di testo non sono disponibili.
- Ogni nuova prenotazione nasce con `agreed_fee_cents` = quota standard del workshop. Modificabile nella riga (tariffa dedicata), con storico; la riga mostra "tariffa dedicata" quando differisce dalla quota standard.
- Se la quota standard cambia: le prenotazioni con la quota vecchia **non** cambiano da sole; compare "Applica la nuova quota a N iscrizioni con la quota precedente" (conferma esplicita). Le tariffe dedicate non si toccano mai.
- Le prenotazioni già esistenti con quota nulla (create in Fase 2b): la migrazione **non** le modifica; quando Ale imposta la quota standard compare "Applica a N iscrizioni senza quota".

## D20 — Iscrizione senza ricerca (Ale) e abbinamento automatico

**Schermata "Aggiungi" di Ale**, una schermata:
1. **Nome, nickname o email** — campo di testo libero. Nessun suggerimento, nessuna ricerca visibile.
2. **Partner** (facoltativo) — secondo campo di testo libero, "partner di <primo nome>".
3. **Stato** — Interessato · Prenotato a parola · Acconto pagato · Saldato (+ "Altro…" per Lista d'attesa e Cancellato). Preselezionato: Prenotato a parola.
4. **Quota** — precompilata con la quota standard, modificabile.
5. **Note**.
6. **Salva.**

- Il testo scritto da Ale si salva in `gw_booking_participants.entered_as` (nuova colonna). È **l'unica** cosa che Ale vede di quella persona, ovunque.
- **Abbinamento automatico** dentro la stessa funzione Postgres, invisibile ad Ale. Normalizzazione: minuscole, senza accenti, spazi compressi. Se il testo contiene `@` è un'email.
  1. Persone del gestionale (non unite): corrispondenza **esatta** su email, oppure nickname, oppure nome + cognome. Se c'è **esattamente una** persona → collega.
  2. Altrimenti libro soci (`association_members`, sola lettura, stesse regole di priorità già usate): email esatta oppure nome + cognome esatti, **esattamente un** socio → crea la persona copiando solo nome, cognome, email e collega `association_member_id`.
  3. Altrimenti, oppure se le corrispondenze sono più di una → crea una persona nuova dal testo (una parola → nickname; email → email; più parole → nome + cognome) e segna `match_status = da_abbinare`.
- `gw_booking_participants.match_status`: `automatico` | `da_abbinare` | `confermato` (enum `gw_match_status`).
- Se la persona abbinata è già iscritta allo stesso workshop: **non** errore per Ale. Salva comunque la riga con persona nuova `da_abbinare` e un avviso per l'admin "possibile doppia iscrizione". Ad Ale non si mostra nulla.

**Vista admin (tab Partecipanti):**
- Badge "abbinato automaticamente" (`automatico`) e "da abbinare" (`da_abbinare`), con chip di filtro.
- Riga aperta: "Scritto da Ale: <entered_as>"; per `automatico` → **Conferma** / **Non è questa persona** (scollega e torna `da_abbinare`); per `da_abbinare` → corrispondenze proposte (gestionale e libro soci, anche parziali) + "Crea nuova" / "Collega" / "Unisci".
- Lo scollegamento non cancella la persona creata in automatico se è usata altrove; se non è usata da nessuna parte, viene rimossa (con storico).
- L'aggiunta rapida dell'admin (Fase 2b, con ricerca) resta invariata per gli admin.

## D21 — Pagamenti

- Ogni movimento ha un **tipo** visibile: `acconto` | `saldo` | `altro` (nuova colonna `gw_payments.payment_type`, enum `gw_payment_type`), separato dal `kind` tecnico (pagamento / rimborso / rettifica).
- **Vista Ale** (riga aperta nel tab Iscrizioni): righe di pagamento con **importo** (campo testo con tastiera numerica, "200" o "200,50") · **tipo** (Acconto · Saldo · Altro) · **metodo** (PayPal · Contanti · Bonifico · Altro) · **note**. Data predefinita oggi (modificabile da un piccolo link "cambia data"). Incassato da predefinito **Ale**.
- "Rimborso" e "Correggi" come in precedenza (movimenti in sola aggiunta, rettifiche collegate, originale barrato).
- **Vista admin (tab Pagamenti):** sola lettura. Una riga per prenotazione: "Claudia + Francesco — pagato 300 € su 450 €" (tariffa dedicata segnalata). Tocco → elenco movimenti in sola lettura. **In fondo alla lista:** Totale concordato · Totale ricevuto · **Ancora da pagare** (somma dei residui positivi, prenotazioni non cancellate) · eventuali eccedenze. Gli admin non registrano pagamenti dall'interfaccia (lo fa Ale), ma possono vedere tutto.
- **Stato automatico (D16)** nella stessa funzione che registra il movimento o cambia la quota: solo se lo stato è `interessato`, `prenotato` o `acconto`: pagato > 0 e < quota → `acconto`; pagato ≥ quota → `saldato`; vale anche al contrario dopo rimborsi o correzioni. `lista_attesa` e `cancellato` non cambiano mai da soli. Storico con nota "aggiornato dal pagamento". Sempre modificabile a mano.
- Cancellazione con pagamenti: avviso "Questa iscrizione ha X € pagati: registra un rimborso se restituisci i soldi."

---

## Schermate

**Tab Iscrizioni** (solo Ale; gli admin hanno Partecipanti + Pagamenti). In ordine:
1. Riquadro quota del workshop (se manca, è l'unica cosa visibile; se c'è, una riga piccola "Quota: 450 € · modifica").
2. Box di testo "Scrivi o incolla dagli appunti" + Interpreta (sezione sotto).
3. Elenco per prenotazione: `entered_as` del principale (+ partner), stato, "pagato X / quota Y", badge (Saldato · Residuo X € · Eccesso X € · Cancellata). Tocco → riga aperta con stato, quota, note, righe di pagamento, "+ Pagamento".
4. In fondo: "+ Aggiungi" e i totali: concordato · ricevuto · ancora da pagare.

**Tab per ruolo**
- Ale: Iscrizioni · Conti · Info (Info: solo quota standard e note; percentuali in sola lettura).
- Admin: Partecipanti · Pagamenti · Conti · Info.
Il parametro `?tab=` non permette ad Ale di aprire tab da admin (verifica lato server).

## Box di testo (tab Iscrizioni di Ale)

Parser della sezione 6 del contesto, con queste regole aggiuntive:
- **Coppie:** `Nome1 + Nome2` o `Nome1 & Nome2` (dopo `+` un nome, non un numero o `€`) → prenotazione di coppia; il primo è il principale. `+200€` resta un pagamento.
- **Stato:** `cancellat*`/`annullat*`/`disdett*` → cancellato; `attesa`/`waiting` → lista d'attesa; `interessat*`/`forse` → interessato; altrimenti con pagamenti → acconto o saldato (regola automatica), senza pagamenti → prenotato.
- **Tipo pagamento:** `saldo`/`saldato` vicino all'importo → saldo; `acconto`/`anticipo` → acconto; il primo importo senza indicazioni → acconto; i successivi `+X€` senza indicazioni → altro, con avviso.
- **Quota:** `X€/ Y€` → quota X come tariffa dedicata. Senza quota esplicita → quota standard del workshop.
- **Fattura (D9, provvisoria):** "fattura ok" → Emessa; "fattura" da sola → Richiesta + avviso; regola in un unico punto, la confermerà Ale.
- **Persone:** ogni nome diventa `entered_as` e passa dall'abbinamento automatico D20. L'anteprima di Ale **non** mostra abbinamenti né dati anagrafici.
- Una riga che corrisponde a una prenotazione già presente (stesso `entered_as` normalizzato del principale) propone "Aggiorna l'iscrizione esistente" e aggiunge solo i pagamenti nuovi; un pagamento uguale a uno già registrato (importo, metodo, data) è "possibile doppione", non selezionato.

**Anteprima** sul posto: una card per riga, campi modificabili, testo originale visibile, avvisi come **punti da chiarire** con risposta a un tocco ("Metodo?" → PayPal · Contanti · Bonifico · Altro · Non so). In cima: data dei pagamenti (obbligatoria, vuota), contatore "N punti da chiarire". Ogni riga escludibile. "Salva" bloccato solo se manca la data. Una sola funzione Postgres, tutto o niente; storico "importazione testo". Il testo non viene conservato.

Aggiorna la tabella attesa della fixture nella sezione 6 del contesto con queste regole prima di scrivere i test.

---

## Test

- **Ruoli (sicurezza):** con sessione organizzatrice, ogni action/loader admin restituisce errore o 404; le risposte dei loader di Ale non contengono campi di `gw_people` (email, instagram, telefono, nome/cognome salvati) né dati del libro soci; `?tab=partecipanti` rifiutato; Cerca/Persone/schede persona 404.
- **Abbinamento automatico (PGlite):** email esatta → collegata; nickname esatto unico → collegata; due omonimi → `da_abbinare`; socio unico per email → persona creata dal libro soci senza codice fiscale/data di nascita/tessera; nessuna corrispondenza → nuova `da_abbinare`; già iscritta → nessun errore, avviso admin; "Non è questa persona" → scollega.
- **Quota:** nuova prenotazione = quota standard; tariffa dedicata; cambio quota standard non tocca le prenotazioni senza conferma; "applica a N".
- **Pagamenti e stato automatico:** prenotato → acconto → saldato; rimborso riporta ad acconto; lista d'attesa e cancellato invariati; totale "ancora da pagare" corretto con coppie, tariffe dedicate, cancellate ed eccedenze.
- **Parser:** fixture + coppia con `+` e `&`, `+200€` non partner, "interessata", "in attesa", acconto/saldo espliciti, quota dedicata, importo con virgola, `€` prima e dopo, accenti.

Dati inventati. Poi `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:gestionale`, `npm.cmd run test:gestionale:sql`.

---

## Report finale

```
COMMIT FASE 2b: [fatto ora / era già fatto]

00-CONTESTO AGGIORNATO:
- [sezioni]

FILES CREATI/MODIFICATI:
- [file]: [descrizione]

MIGRAZIONE DA APPLICARE:
- 013_gw_ruoli_pagamenti_v3.sql + .down.sql
- Ruoli dopo la migrazione: [chi sarà admin, chi organizzatrice]

SICUREZZA RUOLI VERIFICATA:
- ...

ORA FUNZIONA:
- ...

PARSER — RISULTATO SULLA FIXTURE:
- [riga]: [corrisponde / differisce: perché]

TEST:
- [test]: OK/KO

SCELTE FATTE SU CASI AMBIGUI:
- ...

ERRORI RESIDUI:
- ...
```
