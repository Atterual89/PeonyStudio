# Gestionale Workshop — Contesto permanente

**Leggi questo file all'inizio di OGNI fase.**
La specifica funzionale completa è in `docs/gestionale/specifica.md`.
Se questo file e la specifica divergono, vale questo file, perché contiene le decisioni già prese.
L'analisi del repository (prodotta in Fase 0) è in `docs/gestionale/analisi.md`.

---

## 1. Regole di lavoro (sempre valide)

- Lavora sul branch `feat/gestionale`. **Mai commit su `main`, mai push, mai deploy.** Netlify pubblica automaticamente da `main`.
- Non eseguire mai comandi che scrivono sul database reale (script gw:*, rpc, insert/update/delete), nemmeno per prova. Letture solo se indispensabili e dichiarate nel report.
- Esegui in silenzio. Mostra solo il report finale nel formato richiesto dalla fase.
- **Migrazioni:** scrivi i file SQL nella cartella migrazioni del progetto (quella individuata in Fase 0) ma **NON applicarli** al database. Li applico io. Ogni migrazione ha accanto il proprio file di rollback (`<nome>.down.sql`).
- **Solo migrazioni additive:** nessun `ALTER`, `DROP` o `UPDATE` su tabelle esistenti del sito.
- Non toccare: sito pubblico, Ticket Tailor, area personale, area admin esistente, autenticazione Supabase esistente, dizionari i18n.
- **Eccezione i18n:** il gestionale è solo in italiano. Le stringhe italiane hardcoded sono ammesse SOLO dentro le cartelle del gestionale e non passano da `useLanguage()`.
- **Dipendenze:** solo quelle pre-approvate (sezione 3). Qualsiasi altra va proposta nel report, non installata.
- **Dati di test:** solo nomi e dati inventati. Mai i nomi presenti nella specifica.
- Se un passo richiede una scelta non coperta da questo file, scegli l'opzione più conservativa e segnalala nel report.
- Prima del report esegui sempre: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` e i test del gestionale.

---

## 2. Decisioni prese

| # | Tema | Decisione |
|---|---|---|
| D1 | Rotta | `/gestione`, fuori da `/admin`, così non eredita il controllo di accesso Supabase dell'admin esistente. `noindex`, esclusa da sitemap, robots e navigazione pubblica. |
| D2 | Login | **Solo PIN** di 6 cifre: il PIN identifica l'operatore, senza scegliere il nome. Due operatori non possono avere lo stesso PIN. |
| D3 | Gestione PIN | Solo tramite script da terminale (Laura). Nessuna interfaccia di gestione operatori nella prima versione. |
| D4 | Database | Stesso progetto Supabase di produzione, solo tabelle nuove con prefisso `gw_`. |
| D5 | Parti economiche | Due: `peony` e `redsabbath` (nell'interfaccia "Ale", D17). Wildties sta dal lato di Ale. |
| D6 | Utile negativo | **Caso per caso.** Le percentuali si applicano solo all'utile positivo. Se il workshop chiude in perdita, il consuntivo non ripartisce nulla in automatico: un operatore indica quanta perdita sostiene Peony (vedi sezione 5). |
| D7 | Note fiscali di Ale | Campo di testo separato, mai usato nei calcoli. **Visibile e modificabile solo dall'organizzatrice** (Fase 4, migrazione 018): agli admin non compare, i loader comuni non lo selezionano (`getTaxNotes` risponde 404 agli admin) e lo storico non ne contiene il testo. |
| D8 | Esportazioni | `.xlsx` con `exceljs`. PDF tramite pagina di stampa dedicata + "Salva come PDF" del browser (nessuna dipendenza). |
| D9 | Import testo | "fattura ok" → stato fattura **Emessa**. "fattura" senza "ok" → **Richiesta**, con segnalazione. |
| D10 | Quota standard | Campo del workshop (`default_fee_cents`). Ogni nuova prenotazione nasce con questa quota (D19); finché manca, Ale non può aggiungere iscrizioni. Viene copiato da "Copia impostazioni da un workshop precedente" (D14). |
| D11 | Stato soci | **Coincide con la pagina admin** (migrazione 016): stesse fonti — Google Sheet **live** per modulo (`google_sheet`) e libro soci (`official_members_book`), con i caricatori esistenti `readAssociationMembersFromGoogleSheet` / `readOfficialMembersBookFromGoogleSheet`, più le righe `manual_override` della tabella `association_members` (sola lettura) — e stessa logica, `deriveMembershipState` (`src/lib/association/membership-state.ts`). **Periodi associativi**, definiti in un unico punto (`src/lib/association/membership-periods.ts`, data inizio pagamenti e data fine validità): primo periodo quote pagate dal **01/09/2025**, valide fino al **31/12/2026**; dal **2027 anno solare** (pagate dal 01/01, valide fino al 31/12). Il gestionale sceglie il periodo che contiene la data di inizio del workshop e passa a `deriveMembershipState` l'inizio pagamenti (`paymentsFrom`) e la fine validità (`paymentsUntil`) di quel periodo: una quota del periodo dopo non vale per quello prima. Opzioni facoltative: senza, la pagina admin resta com'era (usa il primo periodo, `CURRENT_MEMBERSHIP_START` / `CURRENT_MEMBERSHIP_EXPIRY`, ora presi da `membership-periods.ts` con gli stessi valori; un test di confronto lo verifica). Workshop prima del 01/09/2025: nessuna quota conta. Etichette (017, uniformate in 4e): "In regola", "Quota non registrata dal 1 set 2025" (data del periodo giusto, es. "dal 1 gen 2027"), "Modulo non trovato", "Non collegata"; **validazione manuale "Quota ok" (rivista, migrazione 022):** è una sola per sito e gestionale, le righe `manual_override` di `association_members`, scritte SOLO dalla funzione condivisa `src/lib/association/manual-validation.ts` (route admin `manual-validate` / `manual-revoke` e azioni admin del gestionale, con il periodo associativo del workshop); annullare = `membership_status = 'revoked'` sulla sola riga manuale (deriveMembershipState conta solo `verified`). Badge "In regola (manuale)"; nel gestionale l'azione si chiama "Segna quota associativa pagata" e l'annullamento "Revoca validazione" (4e). `gw_membership_overrides` non si usa più (022 converte le correzioni "in regola"; al 29/10/2026 la tabella era vuota). Letture dai Google Sheet con cache lato server di 5 minuti. Niente import CSV, niente chiamate a TeamArtist; il gestionale scrive su `association_members` solo le validazioni manuali, con la funzione condivisa; codice fiscale, data di nascita e tessera non arrivano mai al browser né ad Ale. Dettagli in sezione 4.3. |
| D12 | Font | Gli stessi del sito (Cormorant Garamond per i titoli, DM Sans per il testo), già caricati. Nessun font aggiunto. |
| D13 | Rotte | Tutte le route handler del gestionale stanno sotto `/gestione/` (non `/api/`), perché il cookie di sessione ha `Path=/gestione`. Il controllo d'accesso usa `src/proxy.ts` (Next 16) con matcher `/gestione/:path*`. |
| D14 | Workshop da Ticket Tailor | I workshop sono gli eventi della tabella esistente `events` (sincronizzata da Ticket Tailor) il cui `title` contiene "LuXuria" (senza distinzione maiuscole/minuscole), passati, in corso e futuri, pubblici o no. Lettura **in sola lettura** con il client admin lato server: mai scritture su `events` né su `ticket_tailor_*`. `gw_workshops.event_id` collega la riga gestionale all'evento; la riga si crea da sola alla prima apertura dell'evento. **Nome e date si leggono sempre dall'evento** e non si modificano nel gestionale. Niente "Nuovo workshop" né "Duplica": sui workshop senza iscrizioni c'è "Copia impostazioni da un workshop precedente". |
| D15 | La coppia conta 1 | L'unità di conteggio è la **prenotazione**: una coppia è 1 iscrizione e occupa 1 posto; la capienza è in prenotazioni. Ogni prenotazione attiva ha esattamente un partecipante principale (`is_primary`); il partner è secondario. Il riepilogo soci resta per persona. |
| D16 | Stati dell'iscrizione | `interessato` · `prenotato` (Prenotato a parola) · `acconto` (Acconto pagato) · `saldato` · `lista_attesa` · `cancellato`. **"Confermati"** = `prenotato` + `acconto` + `saldato`. |
| D17 | Nome della seconda parte | In tutta l'interfaccia e negli export la parte `redsabbath` si chiama **"Ale"**. Il valore interno dell'enum non cambia; l'etichetta è definita solo in `src/lib/gestionale/labels.ts`. |
| D18 | Ruoli | Due ruoli (`gw_operators.role`, enum `gw_operator_role`, default `organizzatrice`): **`admin`** (Laura, Andrea) vede e fa tutto; **`organizzatrice`** (Ale) vede la dashboard workshop e nel workshop solo i tab **Iscrizioni · Conti · Info**. L'organizzatrice **non vede** libro soci, stato socio, anagrafica (schede persona, email/instagram/telefono/nome e cognome salvati, persone di altri workshop), Cerca, Persone, lo storico completo (dalla Fase 5 ne vede una versione filtrata, D27): vede le persone **solo come le ha scritte lei** (`entered_as`). La frase della specifica "tutti gli operatori hanno gli stessi permessi" **non vale più**. Dettagli in sezione 9. |
| D19 | Quota per prenotazione | La quota è **per prenotazione** (singolo o coppia pagano la stessa). Ogni prenotazione **segue la quota del workshop**, salvo **tariffa dedicata** (`fee_custom = true`), impostata solo con la matita (nella riga o in "Aggiungi") o dal testo importato (`X€/ Y€`). Quando la quota del workshop cambia, tutte le prenotazioni non dedicate e non cancellate si aggiornano subito (stessa transazione, storico, stato automatico); se qualcuna non è più saldata, avviso "N iscrizioni non sono più saldate". Rivista dopo la Fase 3 (migrazione 015): sostituisce "le prenotazioni esistenti non cambiano da sole" e "Applica la nuova quota a N iscrizioni". Dettagli in sezione 9.2. |
| D20 | Iscrizione senza ricerca | Ale scrive un testo libero (nome, nickname o email) senza ricerca né suggerimenti; il testo si salva in `gw_booking_participants.entered_as` ed è l'unica cosa che lei vede di quella persona. L'abbinamento alla persona del gestionale (o al libro soci) è **automatico**, nella stessa funzione Postgres, invisibile ad Ale; gli admin lo confermano o lo correggono nel tab Partecipanti. Dettagli in sezione 9. |
| D21 | Pagamenti | Ogni movimento ha un **tipo** visibile (`gw_payments.payment_type`: `acconto` · `saldo` · `altro`), separato dal `kind` tecnico. I pagamenti li registra Ale nel tab Iscrizioni; gli admin li vedono in sola lettura nel tab Conti (il tab Pagamenti non c'è più, D23). Lo stato della prenotazione si aggiorna da solo dai pagamenti (D16, regola in sezione 9). |
| D22 | Eliminazioni | Eliminare serve **solo a correggere un errore di inserimento**: un ritiro resta "Cancellato", soldi restituiti restano "Rimborso" (i messaggi di conferma lo ricordano). Eliminazione **logica** (`deleted_at`, `deleted_by`, migrazione 020): le righe eliminate non compaiono da nessuna parte e non contano in nessun calcolo; storico `delete` per ogni eliminazione; conferma sul posto (mai finestre del browser) e "Eliminato · Annulla" per almeno 30 secondi, poi finché non si tocca altro, al massimo 10 minuti (4g, sezione 13), poi nessun cestino. Chi elimina cosa e regole in sezione 10. |
| D23 | Recap economico | Definizioni uniche, calcolate sempre con `computeSettlement` e `paymentTotals` (`recap.ts`): **Entrate** = movimenti validi dei partecipanti (pagamenti − rimborsi ± rettifiche, senza gli eliminati, cancellati compresi) = Ricavi; **Uscite** = spese valide; **Rimane** = Entrate − Uscite = Utile; **Da incassare** = residui positivi delle iscrizioni non cancellate e non in lista d'attesa, con quota. Home con mini dashboard (anno selezionabile) e riga economica su ogni workshop; tab Conti riorganizzato; il tab Pagamenti degli admin non c'è più (`?tab=pagamenti` → `?tab=conti`). Dettagli in sezione 8. |
| D24 | Saldato automatico (4e, migrazione 024) | "Saldato" = residuo del conguaglio (**Da trasferire**) uguale a 0, calcolato sempre dai numeri (trasferimenti eseguiti compresi, `isSettled` in `settlement.ts`). Se gli importi cambiano dopo (es. uno sconto dell'ultimo momento) il workshop torna **da solo** "Aperto · da trasferire X €". Stati manuali del consuntivo solo **Provvisorio** / **Verificato** (snapshot e avviso di modifica come prima); `da_conguagliare` e `conguagliato` restano nell'enum ma `gw_set_settlement_status` non li accetta, la 024 li converte in `verificato` (con storico) e il codice li legge come verificato (`settlementStatusOf`). Nella Divisione Peony / Ale, se il residuo non è 0: "Registra trasferimento di X € (Ale → Peony)" con conferma sul posto (`settleResidualAction`: residuo ricalcolato sul server e confrontato con quello confermato), registrato come eseguito oggi. Home: workshop senza movimenti senza badge; badge "Da ricontrollare" se un consuntivo verificato è cambiato (`gw_economic_overview` restituisce anche `verified_snapshot`). |
| D25 | Permessi del tab Conti (4e) | Invariati: spese modificabili da tutti, consuntivo verificabile da chiunque. Trasparenza: ogni spesa mostra "inserita da Peony/Ale", lo stato Verificato "da Peony/Ale il <data>" (solo il ruolo, mai il nome: `partyOfRole`, `verifiedByLabel`). |
| D26 | Richieste di associazione (4e) | Gruppi del tab Partecipanti: **Da contattare** = collegata al libro soci, non in regola, senza contatti nel periodo; **Richiesta inviata** = con almeno un contatto; le non collegate vanno in **Da verificare nel libro soci**, senza Copia email né Registra come inviata (anche lato server, `isRequestGroup`). Contano le iscrizioni confermate; interruttore "Includi interessati" spento di default. Nei gruppi delle richieste caselle di spunta (tutte attive): Copia email e Registra come inviata valgono solo per le persone spuntate. |
| D27 | Fase 5, versione ridotta (migrazione 027) | **Presenze:** una sola spunta "Presente" per **iscrizione** (una coppia = 1, `gw_bookings.present`, `gw_set_present` con versione e storico), solo sulle iscrizioni confermate, sulla riga chiusa del tab Iscrizioni di Ale e del tab Partecipanti, dal giorno di inizio; "Presenti X / Y" nell'intestazione dal giorno di inizio. Niente Appello, niente presenza per persona (`gw_booking_participants.attendance` resta inutilizzata). **Email:** tab "Email" solo admin (Partecipanti · Conti · Email · Info), per persona: Confermati (Acconto pagato o Saldato) selezionati, Interessati e Prenotati a parola in grigio non selezionati, lista d'attesa e cancellati esclusi; "Copia email (N)" per il Ccn. Nel tab Partecipanti resta solo la Copia email dei gruppi "Da contattare" / "Richiesta inviata". **Storico:** anche per Ale, filtrato lato server (`gw_audit_list` con il ruolo della sessione): solo iscrizioni, pagamenti, spese, trasferimenti, riporti, stato dei conti; persone solo come `entered_as`; chi ha fatto la modifica solo come Peony/Ale; ultima voce di Altro. **Libro soci:** pagina "Collega al libro soci" e "Scollega" dalla scheda (solo admin). |
| D28 | Semplificazioni per Ale (4g) | Approvate tutte le 43 proposte di `revisione-ale.md` e le ipotesi 1, 2, 4–8 (versione "migliorabile" dove indicata). **Eccezione: ipotesi 3 non approvata**: Acconto pagato e Saldato restano sceglibili a mano (6 stati nel menu, scegliendoli si apre il modulo pagamento, lo stato segue anche i pagamenti come prima); di #14, #22 e #27 si applica solo la chiarezza ("Registra il pagamento per confermare lo stato" / "Stato non cambiato: nessun pagamento registrato"; "Quanto ha già pagato?"; "Nel testo: Prenotato. Ha già pagato 300 €: segno Acconto pagato? · Sì · No, lascia Prenotato"). Le parole nuove valgono anche per gli admin (Guadagno, Spese, Totale prezzi, Pagato in più, Pagata da, Prezzo / Prezzo speciale), salvo le viste "solo admin". Nessuna migrazione. Dettagli in sezione 13. |

---

## 3. Dipendenze pre-approvate

- `exceljs` (Fase 4, export xlsx)
- `vitest` come devDependency, **solo se** il progetto non ha già un test runner
- Nient'altro. Hash PIN con `crypto.scrypt` di Node (incluso, nessuna dipendenza).

---

## 4. Architettura vincolante

### 4.1 Accesso ai dati

- Tabelle in schema `public` con prefisso `gw_`.
- Su ogni tabella `gw_`: RLS attiva **senza policy** + `REVOKE ALL ... FROM anon, authenticated`. Il risultato: nessun utente del sito, loggato o no, può leggerle.
- Il server accede con la service role key, letta da variabile d'ambiente **senza** prefisso `NEXT_PUBLIC_`, solo da moduli in `src/lib/gestionale/server/` che iniziano con `import 'server-only'`.
- **Le operazioni che toccano più tabelle sono funzioni Postgres** (`gw_*`, invocate via `rpc`), perché supabase-js non gestisce transazioni. Ogni funzione riceve `p_operator_id` e scrive lo storico (`gw_audit_log`) nella stessa transazione.
- Ogni funzione `gw_*`: `REVOKE EXECUTE ... FROM public, anon, authenticated`. Per default Postgres le rende eseguibili da tutti.
- Ogni server action e route handler del gestionale chiama per prima cosa `requireOperator()`, che valida la sessione sul database e restituisce anche il **ruolo** (D18). Quelli riservati agli admin chiamano `requireAdmin()` (404 per l'organizzatrice), e lo chiamano anche i loader di dati riservati (anagrafica, libro soci, stato socio). Il middleware fa solo il redirect quando il cookie manca; non è un controllo di sicurezza.
- **Concorrenza:** le tabelle modificabili hanno una colonna `version int`. Ogni update usa `WHERE id = $1 AND version = $2`. Se c'è un conflitto, la UI mostra "Modificato da un altro operatore, ricarica".

### 4.2 Autenticazione

**Tabelle**
- `gw_operators`: `id`, `display_name`, `pin_hash`, `active`, `pin_updated_at`, `role` (`admin` | `organizzatrice`, default `organizzatrice`, D18)
- `gw_sessions`: `id`, `operator_id`, `token_hash`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`, `user_agent`
- `gw_login_attempts`: `id`, `operator_id` (nullable), `ip_hash`, `success`, `created_at`

**Hash PIN**
- `crypto.scrypt` con salt casuale di 16 byte e parametri espliciti (N=2^15, r=8, p=1).
- Il formato memorizzato contiene i parametri: `scrypt$N$r$p$salt$hash`.
- Confronto con `timingSafeEqual`.

**Verifica del PIN (solo PIN, D2)**
- Il PIN inserito si confronta con l'hash di **ogni** operatore attivo (sono pochi). Il tempo di risposta deve essere lo stesso sia che il PIN corrisponda sia che no: confronta sempre con tutti gli hash, senza fermarti al primo che corrisponde.
- `set-pin.mjs` rifiuta un PIN già usato da un altro operatore, e anche PIN banali (`000000`, `123456`, sei cifre uguali, sequenze crescenti o decrescenti).

**Limitazione tentativi** (tutto salvato su DB, perché su Netlify non esiste memoria condivisa)

Con il solo PIN il sistema non sa a quale operatore si riferisce un tentativo sbagliato: i limiti sono quindi per dispositivo/IP e globali.
- Per IP (hash SHA-256 con salt da env): 5 errori → blocco di 15 minuti. Ogni blocco successivo dallo stesso IP raddoppia la durata, fino a un massimo di 24 ore. Un login riuscito da quell'IP azzera il contatore.
- Globale: oltre 30 errori nell'ultima ora (da qualsiasi IP) si bloccano i nuovi login per 1 ora. Le sessioni già attive continuano a funzionare.
- Lo script `unlock.mjs` (senza argomenti) azzera tutti i blocchi.
- Messaggio d'errore sempre generico: "PIN non valido o accesso temporaneamente bloccato".

**Sessione**
- Token di 32 byte casuali. Sul DB si salva solo l'hash SHA-256 del token.
- Cookie `gw_session`: HttpOnly, Secure, SameSite=Lax, Path=/gestione.
- Scadenza scorrevole di 30 giorni dall'ultima attività, con massimo assoluto di 90 giorni.
- Logout = `revoked_at`. Cambio PIN = revoca di tutte le sessioni di quell'operatore.

**Script** in `scripts/gestionale/`, file `.mjs` eseguibili con `node --env-file=.env.local`:
- `set-pin.mjs <nome>`: crea l'operatore se non esiste. Il PIN si chiede in input nascosto, mai come argomento, così non finisce nella cronologia della shell. Revoca le sessioni esistenti.
- `revoke-sessions.mjs <nome>`
- `unlock.mjs`: azzera tutti i blocchi (per IP e globale).
- `list-operators.mjs`: elenca nome, ruolo, stato, ultimo accesso, sessioni attive.
- `set-role.mjs <nome> admin|organizzatrice` (D18).
- `rename-operator.mjs "<vecchio>" "<nuovo>"`: cambia il nome visualizzato (migrazione 012); PIN e sessioni non cambiano, storico.

### 4.3 Modello dati

**Regole generali**
- Importi in **centesimi, `bigint`**. Mai `float` o `numeric` nel codice JS.
- Date in `date`, timestamp in `timestamptz`. Calcoli di "oggi" nel fuso Europe/Rome.
- Enum Postgres con prefisso `gw_`.

**`gw_workshops`**
- `event_id` (null): id dell'evento in `events` (uuid, **senza foreign key**, unico quando non nullo). La riga si crea in automatico alla prima apertura dell'evento (`gw_ensure_workshop_for_event`, con storico).
- `name`, `starts_on`, `ends_on`: **copia** dei dati dell'evento (aggiornata a ogni apertura), usata se l'evento sparisce da `events` ("Evento non più su Ticket Tailor"). Per i workshop collegati nome e date si mostrano sempre dall'evento; le date di `events.starts_at`/`ends_at` si convertono in data nel fuso Europe/Rome.
- `description`, `capacity` (null; in **prenotazioni**, D15)
- `default_fee_cents` (null)
- `peony_pct numeric(5,2)` default 30, CHECK tra 0 e 100. La quota di Ale è sempre `100 − peony_pct`: per costruzione la somma non può essere diversa da 100.
- `loss_peony_cents bigint` (null, ≥ 0): quanta perdita sostiene Peony, usato solo se l'utile è negativo (D6). Non viene copiato da "Copia impostazioni".
- `settlement_status` (`provvisorio` | `verificato`; `da_conguagliare` e `conguagliato` non si usano più dalla 024, D24)
- `verified_snapshot jsonb`, `verified_at`, `verified_by`
- `personal_tax_notes text` (D7)
- `version`, timestamp
- Lo stato temporale (prossimo / in corso / passato) **non si salva**: si calcola dalle date.

**`gw_people`**
- `first_name`, `last_name`, `nickname`, `email`, `instagram`, `phone`, `teamartist_id`, `notes`
- `association_member_id` (null): collegamento a una riga **`manual_override`** di `association_members` (D11, 016: solo le validazioni manuali). Stesso tipo della sua chiave primaria, **senza foreign key**: la tabella esistente non si tocca.
- `membership_email` (null, 016): collegamento a un socio del libro soci o del modulo (Google Sheet) con la chiave che usa la pagina admin, l'email (minuscola). Un trigger (`gw_people_membership_link`) mantiene la regola: un id di una riga non manuale diventa la sua email. Le persone collegate prima della 016 a righe non manuali sono state convertite.
- **Stato socio (D11):** `deriveMembershipState` con le fonti della pagina admin e l'identità della persona: il socio collegato (validazione manuale per id, oppure `membership_email`), altrimenti email, nome e cognome della persona. Abbinamento come l'admin: email (normalizzata, es. Gmail senza punti), oppure nome e cognome solo se c'è **un'unica** riga nel libro ufficiale. Riferimento: il periodo associativo (D11, `membership-periods.ts`) che contiene l'inizio del workshop; conta solo un pagamento `verified` iniziato tra l'inizio pagamenti e la fine validità di quel periodo. Esempio: quota pagata a ottobre 2025 → in regola per un workshop di novembre 2026, non per uno di febbraio 2027. Il libro soci live conosce solo il periodo corrente (colonna "Anno sociale 2026"): per i workshop di altri periodi valgono le righe con le loro date (validazioni manuali) e le correzioni del gestionale. Chiavi del socio nel gestionale (`member-key.ts`): `m:<id>` validazione manuale, `e:<email>` / `n:<nome cognome>` libro soci o modulo.
- Da `association_members` si copiano solo nome, cognome ed email. **Mai** codice fiscale, data di nascita o numero di tessera.
- `merged_into` (null): la persona unita non si cancella, punta alla persona principale.
- `version`, timestamp
- CHECK: `first_name` oppure `nickname` non nulli.
- L'email **non** è unica: la UI segnala come avviso le email condivise.

**`gw_bookings`** (una prenotazione = singolo o coppia)
- `workshop_id`
- `status` (`interessato` | `prenotato` | `acconto` | `saldato` | `lista_attesa` | `cancellato`, D16). "Confermati" = `prenotato` + `acconto` + `saldato`.
- **Stato automatico (D21):** vedi la regola in sezione 9. Resta modificabile a mano.
- `agreed_fee_cents` (null = quota non definita): è la quota **complessiva** della prenotazione, quindi della coppia se è una coppia (D19). Se non è dedicata è sempre uguale alla quota del workshop (nulla solo finché il workshop non ha quota).
- `fee_custom boolean` (D19): `true` = tariffa dedicata, impostata con la matita o dal testo importato (`X€/ Y€`). Le tariffe dedicate non cambiano mai quando cambia la quota del workshop; "Ripristina quota del workshop" rimette `false`.
- `invoice_status` (`non_richiesta` | `richiesta` | `emessa`)
- `notes`, `version`, timestamp

**`gw_booking_participants`**
- `booking_id`, `workshop_id` (denormalizzato, per il vincolo sotto), `person_id`
- `attendance` (`non_registrata` | `presente` | `assente`)
- `entered_as text` (D20): il testo scritto da Ale; per le iscrizioni degli admin, il nickname o il solo nome di battesimo al momento dell'inserimento (sezione 9.1). È l'unica cosa che l'organizzatrice vede della persona.
- `match_status` (`automatico` | `da_abbinare` | `confermato`, enum `gw_match_status`, default `confermato`) (D20). Le righe inserite dagli admin con la ricerca sono `confermato`.
- `auto_created_person boolean`: la persona è stata creata dall'abbinamento automatico (dal testo o dal libro soci); se viene scollegata e non è usata altrove, si rimuove (con storico).
- `possible_duplicate_person_id` (null): persona già iscritta allo stesso workshop a cui il testo corrispondeva → avviso "possibile doppia iscrizione" per gli admin.
- `is_primary boolean` (D15): ogni prenotazione attiva ha esattamente un principale (indice unico parziale). Il primo nome inserito è il principale; il partner è sempre secondario. "Cambia partner" sostituisce solo il secondario; "Separa" trasforma il partner in una prenotazione autonoma (principale di sé stessa).
- `added_at`, `removed_at`
- Indice unico `(workshop_id, person_id) WHERE removed_at IS NULL`: una persona non può avere due iscrizioni attive allo stesso workshop.
- Cambio partner = `removed_at` sul vecchio + nuova riga. Lo storico resta.

**`gw_payments`** (append-only: mai `UPDATE` sugli importi, mai `DELETE`)
- `booking_id`
- `kind` (`pagamento` | `rimborso` | `rettifica`)
- `amount_cents`: positivo per pagamento, negativo per rimborso, segno libero per rettifica
- `payment_type` (`acconto` | `saldo` | `altro`, enum `gw_payment_type`, D21): il tipo visibile, separato dal `kind` tecnico. Una rettifica eredita il tipo del movimento che corregge; un rimborso è `altro`.
- `paid_on` (date), `method` (`contanti` | `paypal` | `bonifico` | `altro` | null)
- `received_by` (`peony` | `redsabbath`): per un rimborso è chi ha restituito i soldi
- `description`, `created_by`, `created_at`
- "Annullare" un pagamento sbagliato = inserire una rettifica di importo opposto, collegata tramite `corrects_payment_id`.

**`gw_expenses`**
- `workshop_id`, `description`, `amount_cents > 0`, `advanced_by` (party), `spent_on`, `created_by`, `version`
- Modificabili, con storico.

**`gw_transfers`** (soldi passati da una parte all'altra per il conguaglio di un workshop)
- `workshop_id`, `from_party`, `to_party`, `amount_cents > 0`
- `status` (`da_eseguire` | `eseguito`), `executed_on`, `notes`, `created_by`

**`gw_carryovers`** (riporti)
- `origin_workshop_id`, `destination_workshop_id` (diversi tra loro)
- `debtor`, `creditor`, `amount_cents > 0`
- `status` (`aperto` | `chiuso`), `notes`, `created_by`
- Una riga di riporto conta in uscita sul workshop di origine e in entrata su quello di destinazione: mai due volte sullo stesso workshop.

**`gw_membership_overrides`** (Fase 5, **non più usata dalla 022**: al suo posto la validazione manuale "Quota ok" condivisa con il sito, D11): solo le correzioni manuali, quando il libro soci è incompleto
- `person_id`, `year int`, `status` (`in_regola` | `non_associato`), `notes`, `created_by`, `created_at`
- Unico su `(person_id, year)`.

**`gw_membership_contacts`** (4d, migrazione 023): richieste di associazione e solleciti per persona e periodo associativo (`period_key`), `kind`/`number` (0 = richiesta), `sent_on`, `note`, `created_by`, `deleted_at`/`deleted_by`. Dettagli in sezione 9.

**`gw_person_aliases`** (4d, B2, migrazione 023): altri nomi di una persona (`alias`, `alias_normalized` = `gw_norm`), eliminazione logica, storico; unico tra gli alias attivi (indice) e i nickname delle altre persone non unite (controllo in `gw_add_person_alias`, errore "«X» è già usato da <persona>"). Il controllo non scatta al cambio di un nickname, così l'abbinamento automatico non si blocca quando crea una persona dal testo di Ale.

**`gw_booking_participants.entered_email`** (4d, B2): email scritta da Ale (validata), l'unica che lei vede.

**Regola dello stato associativo** per una persona e un workshop (D11, 016, 017, 022; sostituisce la regola della Fase 2 con gli override per anno):
1. Periodo associativo = quello di `membership-periods.ts` che contiene la data di inizio del workshop (workshop prima del 01/09/2025: nessuna quota conta).
2. Stato = `deriveMembershipState` con le fonti della pagina admin (Google Sheet live del modulo e del libro soci, righe `manual_override` di `association_members`) e l'identità della persona (socio collegato, altrimenti email, nome e cognome), contando solo i pagamenti `verified` iniziati tra l'inizio pagamenti e la fine validità del periodo.
3. Etichette: **In regola** (con "(manuale)" se viene da una validazione manuale) · **Quota non registrata dal …** (data del periodo) · **Modulo non trovato** · **Non collegata** (nessun collegamento esplicito e nessuna riga trovata dall'abbinamento della pagina admin).
4. La correzione manuale è la validazione "Quota ok" condivisa con il sito (`manual-validation.ts`); `gw_membership_overrides` non si usa più.

**`gw_audit_log`**
- `operator_id`, `entity`, `entity_id`, `action` (`insert` | `update` | `delete` | `merge` | `login` | `logout`)
- `before jsonb`, `after jsonb`, `created_at`
- Non registra mai PIN, hash o token.

---

## 5. Formule del consuntivo (vincolanti)

Implementate come funzione TypeScript pura `computeSettlement()` in `src/lib/gestionale/settlement.ts`, coperta da test. Tutti i valori sono in centesimi.

Per ogni parte X ∈ {P = Peony, R = Ale (valore interno `redsabbath`, D17)}:

```
Incassato_X  = Σ gw_payments.amount_cents con received_by = X
               (tutti i kind; include pagamenti di iscrizioni cancellate)
Anticipato_X = Σ gw_expenses.amount_cents con advanced_by = X

Ricavi       = Incassato_P + Incassato_R
Spese        = Anticipato_P + Anticipato_R
Utile        = Ricavi − Spese

Se Utile ≥ 0:
  Quota_P    = round(Utile × peony_pct / 100)  (arrotondamento al centesimo)
  Quota_R    = Utile − Quota_P                 (così nessun centesimo si perde)

Se Utile < 0 (D6, perdita decisa caso per caso):
  se loss_peony_cents è null → NESSUN residuo calcolato. Mostra
      "Perdita di € |Utile| da ripartire: indica quanta ne sostiene Peony"
      con un campo importo (0 … |Utile|) e l'anteprima della ripartizione.
  altrimenti:
  Quota_P    = −loss_peony_cents               (CHECK: loss_peony_cents ≤ |Utile|)
  Quota_R    = Utile − Quota_P
  Se le spese o gli incassi cambiano e |Utile| diventa minore di
  loss_peony_cents, oppure l'utile torna positivo, mostra un avviso
  e non calcolare il residuo finché non si corregge.

Spettanza_X  = Quota_X + Anticipato_X
Posizione_P  = Spettanza_P − Incassato_P
Posizione_R  = −Posizione_P                    (assert: Spettanza_R − Incassato_R = −Posizione_P)
```

Poi, su Posizione_P (positivo = a Peony spettano soldi):
- **Riporto in entrata** (destinazione = questo workshop): +importo se il creditore è P, −importo se il creditore è R.
- **Riporto in uscita** (origine = questo workshop): l'opposto. Chiude il residuo qui perché è stato spostato altrove.
- **Trasferimento eseguito** R→P: −importo. Trasferimento eseguito P→R: +importo.

```
Residuo > 0  → "Ale deve trasferire € Residuo a Peony"
Residuo < 0  → "Peony deve trasferire € |Residuo| a Ale"
Residuo = 0  → "Saldato"
```

**Utile ripartito e rimborso spese** si mostrano sempre su righe separate.

**Verifica:** quando un operatore segna il consuntivo come "verificato", si salvano in `verified_snapshot` i totali calcolati. Se i totali attuali differiscono dallo snapshot, la pagina mostra "Consuntivo modificato dopo la verifica — da ricontrollare". Nessuno stato blocca le modifiche.

**Casi di test obbligatori:**

1. Specifica: Ricavi 3.000 € (tutti incassati da R), spese 500 € (200 € P, 300 € R), 30/70 → Quota_P 750 €, Spettanza_P 950 €, **R deve 950 € a P**.
2. Perdita: Ricavi 1.000 € (R), spese 1.200 € (tutte P) → Utile −200 €.
   a) `loss_peony_cents` null → nessun residuo, richiesta di ripartizione.
   b) Peony sostiene 0 € → Quota_P 0, Quota_R −200 €, Spettanza_P 1.200 €, **R deve 1.200 € a P**; R chiude a −200 €.
   c) Peony sostiene 100 € → Quota_P −100 €, Spettanza_P 1.100 €, **R deve 1.100 € a P**.
   d) Peony sostiene 250 € → rifiutato (oltre la perdita).
   e) Dopo (c) gli incassi salgono a 1.300 € → utile positivo, avviso, nessun residuo finché non si corregge.
3. Ripartizione 40/60.
4. Incassi divisi tra P e R.
5. Rimborso a un partecipante pagato da R.
6. Riporto in entrata e in uscita: lo stesso importo non compare due volte.
7. Trasferimento parziale già eseguito.
8. Arrotondamento: Utile 100,01 € con 30/70 → la somma delle quote è esattamente 100,01 €.
   Utile esattamente 0 → quote 0, nessuna richiesta di ripartizione.
9. Le note fiscali personali non influenzano alcun valore.

---

## 6. Parser del testo incollato (Fase 3)

Funzione pura `parseRoster(text, { standardFeeCents })` in `src/lib/gestionale/parse-roster.ts`. **Non salva nulla:** produce righe per l'anteprima, ognuna con i campi riconosciuti e un elenco di **punti da chiarire**. Il box di testo sta nel tab **Iscrizioni** di Ale (D18).

**Regole**
- Righe vuote ignorate.
- Una prima riga senza numerazione né importi è il titolo: ignorata.
- Numerazione iniziale (`1.`, `1)`, `-`, `•`) rimossa.
- **Persone (D20):** il nome è il testo prima del primo `(`, importo o parola chiave, e diventa `entered_as` così com'è scritto. Nessuna divisione in nome/cognome nell'anteprima: l'abbinamento è automatico al salvataggio (sezione 9) e Ale non lo vede.
- **Coppie:** `Nome1 + Nome2` o `Nome1 & Nome2` (dopo `+`/`&` un nome, non un numero o `€`) → prenotazione di coppia; il primo è il principale. `+200€` resta un pagamento.
- **Importi:** `250€`, `€250`, `250 €`, `€ 250`, `250 euro`, `250,50€`.
- **Metodi:** `cash`/`contanti` → contanti; `paypal`/`pp` → paypal; `bonifico`/`bon`/`iban` → bonifico. Importo senza metodo → `method = null`, punto da chiarire "Metodo?".
- `(X€ [metodo])` oppure primo importo libero → primo pagamento. `+X€ [metodo]` → pagamento aggiuntivo.
- **Tipo pagamento (D21):** `saldo`/`saldato` subito prima o dopo l'importo → saldo; `acconto`/`anticipo` → acconto; il primo importo senza indicazioni → acconto; i successivi `+X€` senza indicazioni → altro, con punto da chiarire "Tipo?".
- **Quota (D19):** `X€/ Y€` → quota X come **tariffa dedicata**, pagamento Y. `X€/` senza secondo numero → pagamento X e punto da chiarire "formato ambiguo". Senza quota esplicita, o con la stessa quota del workshop → **segue la quota del workshop** (non dedicata).
- `fattura ok` → Emessa; `fattura` da sola → Richiesta + punto da chiarire (D9, **provvisoria**: regola in un unico punto, `invoiceFromText`, da confermare con Ale).
- **Stato:** `cancellat*`/`annullat*`/`disdett*` → cancellato; `attesa`/`waiting` → lista d'attesa; `interessat*`/`forse` → interessato; altrimenti prenotato. Poi si applica la regola automatica dei pagamenti (sezione 9.4): con pagamenti → acconto o saldato.
- `(IG)` → avviso "contatto Instagram, handle non indicato". Nessun campo anagrafico si compila.
- Tutto il testo non consumato → note dell'iscrizione.
- **Già presente:** una riga il cui principale ha lo stesso `entered_as` normalizzato di una prenotazione esistente propone "Aggiorna l'iscrizione esistente" e aggiunge solo i pagamenti nuovi; un pagamento uguale a uno già registrato (importo, metodo, data) è "possibile doppione", non selezionato.

**Anteprima** (sul posto, nel tab Iscrizioni)
- Una card per riga, campi modificabili, testo originale visibile, ogni riga escludibile.
- In cima: **data dei pagamenti** (obbligatoria, vuota), "Incassato da" (predefinito Ale), contatore "N punti da chiarire".
- Punti da chiarire con risposta a un tocco ("Metodo?" → PayPal · Contanti · Bonifico · Altro · Non so; "Tipo?" → Acconto · Saldo · Altro).
- "Salva" bloccato solo se manca la data. L'anteprima non mostra abbinamenti né dati anagrafici.
- **Moduli compatti:** un solo stato per riga, quello calcolato dai pagamenti (regola automatica). Se il testo indicava uno stato diverso è un punto da chiarire ("Il testo dice Prenotato a parola, i pagamenti indicano Saldato · Usa Saldato / Usa Prenotato a parola"); tenere lo stato del testo vale solo per Interessato e Prenotato a parola, e il database lo applica dopo la regola automatica (`forced_status` di `gw_import_roster`, migrazione 023, solo righe nuove; D21: la scelta a mano vale). "Togli questo pagamento" sta nel menu "…" della riga di pagamento.
- Tutto si salva in **un'unica funzione Postgres** (`gw_import_roster`): o va tutto a buon fine o non si salva niente. Storico "importazione testo". Il testo incollato non viene conservato.

**Fixture di test** (nomi inventati; quota standard del workshop nei test: 500 €):

```text
Level 2+ November

1. Aster (300€) ex Masterclass +200€ cash
2. Bruma Vale (225€) ex Level 2 ok cancellata ma ha pagato anticipo
3. Corvo (250€ paypal) fattura ok +250€ cash
4. Dalia €250 fattura ok +250€ cash
5. Elio €250 fattura ok +250€ cash
6. Fiamma (IG) 580€/ 180€ fattura ok +400€ cash
7. Gaia Monti (IG) 180€/ fattura ok +400€ cash
```

| # | entered_as | Stato | Quota | Pagamenti (tipo) | Fattura | Note / punti da chiarire |
|---|---|---|---|---|---|---|
| 1 | Aster | saldato | 500 standard | 300 acconto (metodo ?), 200 contanti altro | non richiesta | note "ex Masterclass"; Metodo?; Tipo? |
| 2 | Bruma Vale | cancellato | 500 standard | 225 acconto (metodo ?) | non richiesta | note "ex Level 2 ok ma ha pagato anticipo"; Metodo? |
| 3 | Corvo | saldato | 500 standard | 250 paypal acconto, 250 contanti altro | emessa | Tipo? |
| 4 | Dalia | saldato | 500 standard | 250 acconto (metodo ?), 250 contanti altro | emessa | Metodo?; Tipo? |
| 5 | Elio | saldato | 500 standard | 250 acconto (metodo ?), 250 contanti altro | emessa | Metodo?; Tipo? |
| 6 | Fiamma | saldato | 580 dedicata | 180 acconto (metodo ?), 400 contanti altro | emessa | "(IG)"; quota interpretata; Metodo?; Tipo? |
| 7 | Gaia Monti | saldato (eccesso 80) | 500 standard | 180 acconto (metodo ?), 400 contanti altro | emessa | "(IG)"; formato ambiguo; Metodo?; Tipo? |

---

## 7. Interfaccia

- **Scelte nei moduli:** ogni scelta (tipo e metodo di pagamento, categoria spesa, fattura, "incassato da", "anticipata da", stato del trasferimento, risposte "Metodo?" / "Tipo?" / "Fattura?") è un menu a tendina nativo alto 44px (`ChoiceSelect` in `ui.tsx`); i chip restano solo per i filtri degli elenchi; restano pulsanti le risposte a due opzioni dell'anteprima. **Modulo pagamento compatto:** su telefono [Importo] [Tipo ▼] / [Metodo ▼] [Data], poi note e "Registra"; su schermi larghi una riga sola; "Incassato da" è un menu piccolo sotto.
- **Mobile first.** Area di tocco minima 44px. `inputmode="numeric"` su PIN e importi. Importi inseriti come "250" o "250,50" e convertiti in centesimi.
- Layout `/gestione` separato: **niente header pubblico né BottomNav pubblica**. Se la BottomNav è montata nel layout radice, nascondila su `/gestione` con la modifica più piccola possibile, segnalata nel report.
- Navigazione propria in basso: **Workshop · Cerca · Persone · Altro** per gli admin; **Workshop · Altro** per l'organizzatrice (D18).
- Palette Peony (crema `#f2ede3`, terracotta `#a8583e`) e i font già caricati dal sito (D12), ma tono pratico: card, sezioni richiudibili, pulsanti grandi.
- Header e BottomNav pubblici: esclusi con la guardia `pathname.startsWith("/gestione")` in `BottomNav.tsx` e `GlobalFooter.tsx` (come già fatto per `/area-personale`). L'header pubblico è importato pagina per pagina, quindi su `/gestione` non compare.
- Dopo ogni salvataggio un messaggio breve di conferma. In caso di errore il messaggio è chiaro e i dati inseriti restano nel form.
- Su desktop (≥1024px): tabelle con ordinamento e filtri al posto delle card.
- **Etichette (D17):** la parte `redsabbath` si mostra sempre come **"Ale"** (es. "Ale: 70%", "Ale deve trasferire…", "Incassato da: Ale"). Le etichette stanno solo in `src/lib/gestionale/labels.ts`.
- **Conteggi (D15):** "X iscrizioni / capienza", contando prenotazioni confermate (una coppia = 1). Il riepilogo soci è per persona ("su N persone").
- **Schermata "Aggiungi" degli admin** (Fase 2b, con ricerca; per l'organizzatrice vale invece D20, sezione 9), tutta in una schermata: 1) ricerca (persone del gestionale, poi "Dal libro soci", poi "Crea nuova: <testo>"); 2) la persona scelta compare in alto come scheda compatta con il badge socio; 3) stato con quattro pulsanti grandi (Interessato · Prenotato a parola · Acconto pagato · Saldato; Interessato preselezionato), Lista d'attesa e Cancellato sotto "Altro"; 4) "+ Partner" con la stessa ricerca, mostrato come "partner di <primo nome>"; 5) note facoltative su una riga che si allarga; 6) Salva. **Niente quota** qui né nel tab Partecipanti: la prenotazione nasce con la quota standard (D19) e i soldi li gestisce Ale nel tab Iscrizioni.

---

## 8. Struttura delle schermate (approvata da Laura)

**Barra in basso, sempre visibile:** Workshop · Cerca · Persone · Altro (admin); Workshop · Altro (organizzatrice, D18).

**Home `/gestione` (D23, stesso contenuto per tutti gli operatori):** in cima un selettore d'anno piccolo (anno di inizio del workshop; predefinito l'anno corrente, oppure "Tutti") e quattro riquadri **Entrate · Uscite · Rimane · Da incassare**, somma dei workshop dell'anno; sotto, se diversi da zero, "Conguagli da fare: Ale → Peony X € · Peony → Ale Y €" (residui dei workshop non saldati). Poi gli eventi LuXuria di Ticket Tailor (D14): l'anno filtra **solo i Passati** (e i riquadri), In corso e Prossimi si vedono sempre tutti, di qualsiasi anno. **In corso** (primo, aperto, card evidenziata; il gruppo non c'è se vuoto), **Prossimi** (aperto, dal più vicino; se non c'è un workshop in corso il primo è evidenziato), **Passati** (chiuso, dal più recente). Ogni card: "X iscrizioni / capienza" (D15), "Entrate · Uscite · Rimane" (o "Nessun movimento") e il badge "Saldato" / "Aperto · da trasferire X €" (D24), più "Da ricontrollare" se il consuntivo verificato è cambiato. Su desktop una tabella ordinabile (Workshop · Date · Iscrizioni · Entrate · Uscite · Rimane · Stato) con riga Totale (somma delle righe visibili; "Totale righe visibili" se diversa dai riquadri). I numeri arrivano da **una** lettura aggregata (`gw_economic_overview`, migrazione 021) e si calcolano con le stesse funzioni del tab Conti. Aprire un evento crea, se manca, la sua riga `gw_workshops`. I workshop il cui evento non è più su Ticket Tailor restano elencati con l'etichetta "Evento non più su Ticket Tailor". Nessun pulsante "Nuovo workshop".

**Dettaglio workshop `/gestione/w/[id]`:** una sola pagina a tab. Il tab attivo sta nell'URL, così il tasto indietro del telefono funziona. **Tab per ruolo (D18):** admin `?tab=partecipanti|conti|email|info` (predefinito Partecipanti; `?tab=pagamenti` reindirizza a `?tab=conti`, D23); organizzatrice `?tab=iscrizioni|conti|info` (predefinito Iscrizioni). Un tab dell'altro ruolo restituisce 404 (verifica lato server). Il contenuto di ogni tab è a sezioni richiudibili e righe compatte che si aprono sul posto: niente pagine separate per singola iscrizione.

| Tab | Per chi | Contenuto |
|---|---|---|
| **Partecipanti** | admin (vista principale) | 1) Il box di testo "Scrivi o incolla dagli appunti" sta ora nel tab Iscrizioni di Ale (sezione 6). Badge e filtri dell'abbinamento automatico (D20, sezione 9.3). 2) Riepilogo **per persona** sui confermati: N soci in regola · N quota non registrata · N modulo non trovato o non associati · N non collegati al libro soci · N email mancanti, "su N persone" (D11, 017). 3) Elenco **per prenotazione** (D15): una riga "Claudia + Francesco" con il principale per primo; dentro la riga ogni persona ha il proprio **badge stato socio** con le etichette della pagina admin (D11) e l'eventuale "email mancante". Riga aperta: stato e note della prenotazione; per ogni persona "Modifica dati" sul posto (nome, cognome, nickname, email, instagram, telefono), "Cerca nel libro soci", "Apri scheda"; Cambia partner (solo il secondario) e Separa. Filtri a chip per stato iscrizione e stato socio ("Quota non registrata", "Non in regola" = prenotazioni confermate con almeno una persona in quello stato; "Non collegati al libro soci", di qualunque stato). Riga persona: sezione 9.3 (017). Niente quota in questo tab. 4) Azioni: + Aggiungi; Copia email solo nei gruppi "Da contattare" / "Richiesta inviata" (D26); niente Appello, presenze con la spunta "Presente" sulla riga (D27). |
| **Email** | admin (D27) | Una riga per persona: Confermati selezionati, Interessati e Prenotati a parola in grigio, lista d'attesa e cancellati esclusi; "Copia email (N)" per il Ccn. Sezione 14. |
| **Iscrizioni** | Ale (solo organizzatrice) | Vedi sezione 9: quota del workshop, box di testo, elenco per prenotazione con `entered_as`, pagamenti, totali. |
| **Conti** | Laura + Alessandra (D23) | In cima, sempre visibili: **Entrate · Uscite · Rimane** e, piccolo, "Da incassare ancora: X €" (più l'avviso "modificato dopo la verifica"). Sezioni chiuse, col totale visibile: 1) **Entrate dai partecipanti · N iscrizioni**: una riga per prenotazione (nome come `entered_as`), tocco → movimenti (gli admin li vedono in sola lettura, con il solo "Elimina" di D22 nel menu "…"; Ale ha "Gestisci in Iscrizioni"); in fondo totali per chi ha incassato e per metodo. Sostituisce il tab Pagamenti. 2) **Spese · N categorie**: totale per categoria, tocco → singole spese con "…" (Modifica, Elimina) e "+ Spesa". 3) **Divisione Peony / Ale**: risultato del conguaglio, ripartizione (o perdita da ripartire), posizioni per parte, trasferimenti, riporti, stati del consuntivo. 4) **Note fiscali** (solo Ale). In fondo: Excel e Stampa / PDF. |
| **Info** | tutti | Nome e date dall'evento Ticket Tailor (sola lettura). Admin: capienza (in prenotazioni), quota standard, percentuali, descrizione/note; sui workshop senza iscrizioni "Copia impostazioni da un workshop precedente" (D14). Organizzatrice: solo quota standard e note; percentuali in sola lettura. |

Lo **stato socio** si calcola con la regola della sezione 4.3 e viene costruito già in **Fase 2** (è la prima informazione che serve a Laura).

---

## 9. Ruoli, iscrizioni di Ale e pagamenti (Fase 3, D18–D21)

### 9.1 Ruoli (D18)

| Ruolo | Chi | Cosa vede e fa |
|---|---|---|
| `admin` | Laura, Andrea | Tutto. |
| `organizzatrice` | Ale | Dashboard workshop; nel workshop i tab **Iscrizioni**, **Conti**, **Info**. Non vede libro soci, stato socio, anagrafica, Cerca, Persone. Lo **storico** lo vede filtrato lato server (D27): solo iscrizioni, pagamenti, spese, trasferimenti, riporti e stato dei conti, persone come `entered_as`, autori solo come Peony/Ale. |

- La migrazione 013 imposta `admin` a tutti gli operatori esistenti **tranne** quello chiamato "Ale" (senza distinzione maiuscole/minuscole), che resta `organizzatrice`. I nuovi operatori creati con `set-pin` sono `organizzatrice` (privilegio minimo): `npm.cmd run gw:set-role -- "<nome>" admin`.
- Applicazione **lato server**: `requireOperator()` restituisce il ruolo; `requireAdmin()` risponde 404 all'organizzatrice. Lo chiamano ogni server action, route handler e loader di dati riservati agli admin. `/gestione/persone`, `/gestione/cerca`, `/gestione/p/*`, `/gestione/altro/soci` sono 404 per l'organizzatrice; `/gestione/altro/storico` le mostra la sua vista filtrata (D27).
- I loader usati dall'organizzatrice (`server/registrations.ts`) **non selezionano mai** colonne di `gw_people` né dati di `association_members`: costruiscono le righe da `entered_as` e dai dati economici (verificato da un test sulle chiavi restituite). Per le iscrizioni inserite da un admin con la ricerca (aggiunta rapida, partner), `entered_as` è il **nome visualizzato al momento dell'inserimento**: il nickname, altrimenti solo il nome di battesimo, **mai cognome né email** (`gw_admin_entry_label`). La migrazione 013 lo compila con la stessa regola sulle iscrizioni già presenti. Non si aggiorna se poi la scheda persona cambia.

- **Correzioni 3b (dopo la prova di Laura):** l'admin aggiunge iscrizioni e partner con la ricerca (aggiunta rapida, "+ Partner", "Cambia partner") ma **senza parte economica**: in creazione solo Interessato · Prenotato a parola (predefinito) · Lista d'attesa; la quota è sempre quella standard del workshop e l'admin non la vede né la modifica; dopo la creazione lo stato è in **sola lettura** per l'admin (lo aggiornano Ale e i pagamenti). L'admin modifica dati delle persone, abbinamenti, libro soci e **note** (`gw_update_booking_notes`). Niente "Separa" per l'admin. `entered_as` = nickname o nome di battesimo, così Ale vede la persona. Lato server: `addBookingAction` rifiuta gli stati economici e non invia mai una quota; non esistono azioni admin per cambiare stato o quota; le azioni del tab Iscrizioni (`registration-actions.ts`: stato, quote, pagamenti, importazione) chiamano `requireOrganizer()` e rispondono 404 agli admin.
- **Chi ha inserito (3b):** ad Ale e agli admin si mostra "Inserito da Peony" per le iscrizioni create da un admin (o da uno script) e "Inserito da Ale" per quelle create dall'organizzatrice; mai il nome dell'operatore (`insertedByLabel`, il loader di Ale legge solo il ruolo). Nella riga aperta admin: "Inserito da … · Ale vede / scritto: <entered_as>".
- **Stato (3b):** ovunque un menu a tendina nativo (`<select>`, 44px) con accanto un pallino colorato dello stato attuale (`StatusPicker`, `StatusDot`): Aggiungi e riga aperta di Ale, anteprima del box di testo, aggiunta rapida admin (solo gli stati consentiti). Nella riga aperta admin lo stato resta in sola lettura (pallino + nome).
- **Libro soci (3b, migrazione 014):** quando una persona viene collegata a un socio (Cerca nel libro soci, abbinamento automatico, Collega a un socio) i suoi campi **vuoti** nome, cognome ed email prendono i valori del socio (`gw_fill_person_from_member`); quelli pieni non si toccano. Se un campo è pieno ma diverso, la scheda mostra "Nel libro soci: <valore> — usa questo". Email del socio: quella della riga collegata, altrimenti l'unica email delle altre righe dello stesso socio; se non c'è, l'email resta vuota e la scheda lo segnala. La 014 sistema anche le persone già collegate.

### 9.2 Quota (D19)

- Primo passo di Ale: se il workshop non ha quota standard, il tab Iscrizioni mostra solo "Imposta la quota del workshop". Finché manca, "Aggiungi" e il box di testo non sono disponibili (e `gw_create_booking_entered` / `gw_import_roster` rifiutano).
- **Regola (rivista, migrazione 015):** ogni prenotazione segue la quota del workshop, salvo tariffa dedicata (`fee_custom = true`).
- Nuova prenotazione → quota del workshop, `fee_custom = false`. In "Aggiungi" la quota si mostra come "450 € · quota del workshop" con la matita: confermare dalla matita = tariffa dedicata (anche se l'importo è uguale). Dal testo importato: quota `X€/` diversa da quella del workshop = dedicata; uguale o assente = segue il workshop.
- Riga aperta: "580 € · quota del workshop" (o "· tariffa dedicata") con la matita → modifica sul posto, conferma/annulla → `gw_set_booking_fee` (`fee_custom = true`, storico, stato automatico). Se dedicata: "Ripristina quota del workshop" → quota del workshop, `fee_custom = false`. `gw_update_registration` non tocca più la quota.
- Cambio della quota del workshop (tab Iscrizioni, tab Info di Ale o degli admin): `gw_update_workshop_settings` chiama `gw_sync_workshop_fee` nella stessa transazione: tutte le prenotazioni non dedicate e **non cancellate** con quota diversa (anche nulla) prendono la nuova quota, con storico ("segue la quota del workshop") e stato automatico. Restituisce `{ version, unsettled }`: se `unsettled > 0`, dopo il salvataggio "N iscrizioni non sono più saldate". Niente più "Applica la nuova quota…" (`gw_apply_standard_fee` eliminata). Le cancellate tengono la quota che avevano.
- **Dati esistenti (015):** `fee_custom = false` dove la quota è nulla o coincide con una quota standard passata o attuale del workshop (dallo storico `gw_audit_log`); poi allineamento alla quota del workshop come sopra.

### 9.3 Abbinamento automatico (D20)

Dentro `gw_match_entered_person` (chiamata da `gw_create_booking_entered` e `gw_import_roster`). Normalizzazione: minuscole, senza accenti, spazi compressi. Se il testo contiene `@` è un'email.
1. Persone del gestionale non unite: corrispondenza **esatta** su email, oppure nickname, oppure nome + cognome. **Esattamente una** persona → collegata (`automatico`). Più di una → passo 3.
2. Nessuna: libro soci (`association_members`, sola lettura, fonti `official_members_book` e `manual_override`; è la copia nel database del libro soci, l'unica leggibile da Postgres — lo **stato** invece si calcola dalle fonti live, D11): email esatta, altrimenti nome + cognome (stessa chiave a parole ordinate di `normalizeMembershipNameKey`); righe con la stessa email sono lo stesso socio, omonimi con email diverse sono soci diversi. **Esattamente un** socio → se è già collegato a una sola persona del gestionale si usa quella, altrimenti si crea la persona copiando **solo** nome, cognome, email e il collegamento (`association_member_id` per le validazioni manuali, `membership_email` per il libro soci; 016) (`automatico`). "Già collegato" vale sia per id sia per email.
3. Altrimenti → persona nuova dal testo (una parola → nickname; email → email, con nickname = parte prima della `@`; più parole → nome + cognome), `da_abbinare`.
- Persona abbinata già iscritta allo stesso workshop (o uguale all'altra persona della coppia): nessun errore per Ale; si crea una persona nuova `da_abbinare` con `possible_duplicate_person_id` → avviso "possibile doppia iscrizione" per gli admin.
- Admin, tab Partecipanti: badge "abbinato automaticamente" / "da abbinare" con chip di filtro; riga aperta "Scritto da Ale: …"; `automatico` → **Conferma** / **Non è questa persona** (scollega: persona nuova dal testo, `da_abbinare`); `da_abbinare` → corrispondenze proposte (gestionale e libro soci, anche parziali) + **Crea nuova** (tiene la persona creata dal testo, `confermato`) / **Collega** (a una persona esistente o a un socio del libro soci) / **Unisci** (collega e segna la persona creata dal testo come unita a quella scelta, copiando l'email se manca). Una persona creata in automatico che resta inutilizzata viene rimossa, con storico.
- **Riga persona semplificata (017, sostituisce la riga sopra per la vista):** un solo badge per persona, lo stato tessera ("In regola" · "Quota non registrata dal …" · "Modulo non trovato"; correzione manuale del gestionale), oppure **"Non collegata al libro soci"** se la persona non ha un collegamento esplicito (validazione manuale o `membership_email`) e l'abbinamento della pagina admin non trova righe. Niente badge "da abbinare" / "abbinato automaticamente" né il loro filtro: resta il filtro **"Non collegati al libro soci"**. Il riquadro dell'abbinamento ("Inserito da Ale · scritto: X", corrispondenze, Crea nuova / Collega / Unisci, Conferma / Non è questa persona) compare **solo** se la persona non è collegata **e** non ha email; altrimenti una riga piccola "Inserito da Ale come: X" (e, se c'è, "possibile doppia iscrizione"). Riga persona aperta: nome e cognome (link alla scheda), email, badge, "Modifica dati" e, solo se non collegata, "Cerca nel libro soci". Quando l'admin modifica i dati della persona (`gw_update_person`) o la collega al libro soci (`gw_set_membership_link`), i suoi abbinamenti diventano `confermato` da soli (`gw_confirm_person_matches`, con storico).
- **Nome e cognome dal libro soci (017):** collegando una persona, i campi vuoti si riempiono come prima; in più, se il nome contiene già nome e cognome del socio insieme (anche in ordine inverso) e il cognome è vuoto, si separano. Se il nome contiene già altre due parole, il cognome vuoto non si riempie. La 017 sistema le persone esistenti collegate (per id o email) o con la stessa email di un'unica persona del libro soci nella tabella.

- **Altri nomi ed email di Ale (4d, B2, migrazione 023):** il passo 1 dell'abbinamento confronta anche gli altri nomi (`gw_person_aliases`), con le stesse regole (esatto e unico). Le voci di `gw_create_booking_entered` possono essere `{ "text", "email" }`: l'email scritta da Ale abbina **per prima** (email esatta di una sola persona del gestionale non già iscritta; il libro soci per email no, resta l'abbinamento dal testo), poi `gw_apply_entered_email` copia l'email nella scheda se è vuota e non tocca un'email diversa (l'admin vede "Ale ha indicato: x@y — usa questa"). Ale: campo "Email" facoltativo sotto nome e partner in "Aggiungi", "+ Email" / "cambia" nella riga aperta (`gw_set_entered_email`), proposta "usare questa email?" se nelle note c'è un indirizzo; il parser toglie le email scritte dopo il nome (la prima al principale, la seconda al partner). Admin: "Altri nomi" (chip, "+ Aggiungi") nella scheda; dopo un nuovo nome o nickname "Collega anche N iscrizioni con «X»" (iscrizioni "da abbinare" di qualsiasi workshop con lo stesso testo, una per workshop, con "Collega"); pagina Persone "+ Nuova persona" (`gw_create_person_with_aliases`) con avviso "Esiste già: X — apri" (nickname, altri nomi, nome + cognome, email) e "Salva comunque". Gli altri nomi entrano anche tra le corrispondenze esatte proposte nel riquadro dell'abbinamento.

### 9.3b Riga iscrizione del tab Iscrizioni

- **Riga chiusa:** nome · "Pagato X € su Y € · manca Z €" (o "Quota Y € · nessun pagamento"; "· eccedenza" se si è pagato di più) · badge stato · "tariffa dedicata" solo se `fee_custom` · "Inserito da Peony/Ale".
- **Riga aperta**, in quest'ordine, ogni campo si salva da solo (breve "Salvato"; niente "Salva iscrizione"): 1) quota con la matita (9.2); 2) stato, menu a tendina, salva al cambio — se si sceglie Acconto pagato senza nessun pagamento, o Saldato con il pagato sotto la quota, lo stato **non** si salva: si apre "Nuovo pagamento" con il tipo preselezionato (Saldato → Saldo con importo = residuo); lo stato si aggiorna col pagamento (stato automatico; da lista d'attesa o cancellato, se il pagato ora lo giustifica, si salva lo stato scelto); chiudendo senza registrare il menu torna allo stato precedente; 3) Pagamenti, richiusa di default, intestazione "Pagamenti · N · totale" (N = movimenti validi); aperta: movimenti (data · tipo · metodo · importo · note), Correggi e Rimborso nel menu "…" di ogni riga, "+ Nuovo pagamento" apre il modulo (importo, tipo, metodo, "Data: oggi · cambia", note, "Registra pagamento"); 4) Fattura, tre pulsanti piccoli, salva al tocco; 5) Note, salva all'uscita dal campo.

### 9.4 Pagamenti e stato automatico (D21)

- Ale registra i movimenti nella riga aperta del tab Iscrizioni: importo ("200" o "200,50") · tipo (Acconto · Saldo · Altro) · metodo (PayPal · Contanti · Bonifico · Altro) · note; data predefinita oggi (Europe/Rome), "Data: oggi · cambia"; incassato da predefinito Ale.
- **Rimborso** = movimento `rimborso` (importo negativo, tipo `altro`, "incassato da" = chi restituisce). **Correggi** = rettifica di importo opposto al netto del movimento, collegata con `corrects_payment_id` (l'originale si mostra barrato), più, se indicato, il movimento corretto, nella stessa transazione. Mai `UPDATE` o `DELETE` sugli importi.
- **Stato automatico** (`gw_apply_auto_status`, nella stessa transazione del movimento o del cambio quota), solo se lo stato è `interessato`, `prenotato`, `acconto` o `saldato` (quest'ultimo per il ritorno indietro dopo rimborsi o correzioni); `lista_attesa` e `cancellato` non cambiano mai da soli. Con quota definita: pagato > 0 e < quota → `acconto`; pagato ≥ quota → `saldato`; pagato ≤ 0 → da `acconto`/`saldato` torna a `prenotato`. Senza quota: pagato > 0 porta `interessato`/`prenotato` ad `acconto`. Storico con nota "aggiornato dal pagamento". Se nello stesso salvataggio lo stato è cambiato a mano, vale quello. Stessa regola in TypeScript (`autoStatus` in `src/lib/gestionale/payments.ts`) per l'anteprima.
- Cancellazione con pagamenti: avviso "Questa iscrizione ha X € pagati: registra un rimborso se restituisci i soldi."
- **Totali** (tab Iscrizioni e tab Conti): concordato = Σ quote delle prenotazioni non cancellate; ricevuto = Σ di tutti i movimenti (anche delle cancellate); **ancora da pagare / da incassare** (D23) = Σ dei residui positivi delle prenotazioni non cancellate e non in lista d'attesa, con quota; eccedenze = Σ dei pagati oltre la quota delle non cancellate.

**Quota ok e nomi (dopo la 022, solo admin):** nel tab Partecipanti la persona si mostra come "Nome Cognome" (scheda, altrimenti socio collegato) con il nickname o il testo di Ale piccolo accanto; Ale vede sempre solo `entered_as`. Accanto al badge (riga persona aperta e scheda persona) "Segna quota ok" con conferma sul posto ("Segnare la quota associativa di <Nome Cognome> come pagata per il periodo <periodo>?"; periodo del workshop, o di oggi nella scheda) e, se la validazione è manuale, "Annulla validazione manuale"; senza nome e cognome né email chiede di completarli. "Aggiorna stato soci" svuota la cache dei soci. Storico con `gw_log_member_validation`.

**Blocco persona (4d, parte A, solo admin):** ordine fisso: riga 1 "Nome Cognome" (nickname piccolo) · badge; riga 2 email o "email mancante"; **una** azione principale secondo lo stato (non collegata → "Cerca nel libro soci"; collegata e non in regola → "Segna quota ok" + richieste di associazione; in regola → nessuna, "Annulla validazione manuale" nel menu "…" se è manuale); in fondo, piccolo, "Modifica dati" · "Inserito da Ale come: X" (solo se diverso dal nome). "Segna quota ok" non compare sulle persone non collegate. Un solo messaggio di esito per blocco, sostituito dal successivo, che sparisce dopo qualche secondo (`Flash.tsx`). Le note dell'iscrizione si salvano all'uscita dal campo. **Aggiornamento:** ogni server action del gestionale che scrive chiama `refreshGestione()` (`revalidatePath("/gestione", "layout")` + `refresh()`), verificato da un test in `code-rules`. **Ricerca nel libro soci:** una voce per socio, non per fonte (stessa email = stesso socio; una riga senza email va con l'unico socio con email dello stesso nome e cognome; omonimi con email diverse restano distinti), con nome e cognome, email e lo stato che risulterebbe per il periodo del workshop ("In regola fino al 31 dic 2026", "Solo modulo, quota non registrata", …). Collegare = completare: i campi vuoti si riempiono subito (`gw_set_membership_link`), quelli diversi mostrano "Nel libro soci: X — usa questo". Un socio del libro **senza email** non ha una chiave salvabile: come nella pagina admin vale nome e cognome, quindi collegando la persona prende nome e cognome del socio (prima il collegamento non salvava nulla pur dicendo "Collegato": era il bug segnalato).

**Richieste di associazione (4d, parte B, migrazione 023, solo admin):** `gw_membership_contacts` (`person_id`, `period_key` = inizio pagamenti del periodo associativo di `membership-periods.ts`, `kind` `richiesta` | `sollecito`, `number` 0 per la richiesta e 1, 2… per i solleciti calcolato dal database come massimo valido + 1, `sent_on`, `note`, `created_by`, eliminazione logica D22 con Annulla via `restoreDeletedAction` entità `membership_contact`, storico). Valgono per **persona e periodo**, non per workshop. Le email partono da Gmail: qui si registra solo che sono state mandate. Blocco persona, per chi non è in regola (anche non collegata): "Segna richiesta inviata" → "Richiesta inviata il 12 ott" + "Segna sollecito 1" …, mini-riga sul posto (data, oggi predefinita e mai nel futuro · nota · Conferma), elenco richiudibile con "Elimina" nel menu "…"; riga chiusa "✉ sollecito 2 · 25 ott"; storico nella scheda persona. Chip **"Da contattare"** e **"In attesa"** (dalla 4e "Richiesta inviata", più "Da verificare nel libro soci" e le spunte: vedi D26) (persone delle prenotazioni **confermate** non in regola, senza / con contatti nel periodo, contate per persona) con **"Copia email"** per il Ccn di Gmail (`bccList`: virgole, senza doppioni, elenco di chi non ha email) e poi "Segna come inviata a tutti (N)" (`gw_add_membership_contacts`, tutte o nessuna, data di oggi; il server ricalcola il gruppo).

---

## 10. Eliminazioni (Fase 4b, D22, migrazione 020)

Eliminare corregge un **errore di inserimento**. Gli eventi reali hanno già i loro strumenti: ritiro → stato "Cancellato"; soldi restituiti → "Rimborso". Ogni conferma lo ricorda con una riga.

**Come si elimina (vale per tutto)**
- Eliminazione **logica**: `deleted_at timestamptz` e `deleted_by uuid` su `gw_workshops`, `gw_people`, `gw_bookings`, `gw_booking_participants`, `gw_payments`, `gw_expenses`, `gw_transfers`, `gw_carryovers`. Le righe eliminate non compaiono da nessuna parte (elenchi, conteggi, totali, conti, export, ricerca, abbinamenti, copia email) e non contano in nessun calcolo. Le query del server filtrano `deleted_at is null`; le funzioni Postgres che leggono o aggiornano in blocco lo filtrano; l'indice "una iscrizione attiva per persona e workshop" ignora le righe eliminate.
- Guardie nel database: una riga eliminata non si modifica più (solo il ripristino); non si aggiunge nulla a un workshop, una prenotazione o una persona eliminati.
- Ogni eliminazione scrive lo storico (`action = delete`: cosa e chi); il ripristino scrive `update` con `ripristinato`. Lo storico resta consultabile dagli admin.
- Conferma **sul posto**: "Eliminare <cosa>? · Elimina · Annulla". Poi "Eliminato · **Annulla**" per almeno 30 secondi, poi finché non si tocca altro (4g, sezione 13): Annulla ripristina (azzera `deleted_at`, con storico). Il server accetta il ripristino solo da chi ha eliminato e entro 10 minuti; dopo non c'è un cestino.
- `gw_payments` resta append-only: niente `DELETE`, e l'unico `UPDATE` consentito dal trigger è su `deleted_at`/`deleted_by`.

**Cosa si può eliminare e chi**

| Elemento | Condizione | Ale | Admin |
|---|---|---|---|
| Pagamento | sempre, con conferma obbligatoria e i dettagli del movimento | ✔ | ✔ |
| Iscrizione | solo se il pagato netto è 0 (eliminati non contano), per ciascuna parte. Altrimenti: "Ha X € di pagamenti: eliminali o registra un rimborso prima." | ✔ | ✔ |
| Spesa, trasferimento, riporto | sempre | ✔ | ✔ |
| Persona | solo senza iscrizioni attive (eliminate ed ex partner non contano); altrimenti elenca i workshop | ✘ | ✔ |
| Workshop non collegato a Ticket Tailor | con tutto il contenuto (iscrizioni, pagamenti, spese, trasferimenti, riporti in entrata e in uscita); conferma scrivendo il nome | ✘ | ✔ |
| Workshop collegato a Ticket Tailor | mai | ✘ | ✘ |

- Pagamento "modificato": si eliminano insieme il movimento valido, la rettifica e l'originale (catena della Modifica, anche ripetuta), così il totale torna come se non fosse mai esistito. Un movimento già annullato o una rettifica collegata non si eliminano da soli.
- Dopo un pagamento eliminato o ripristinato si ricalcola lo stato automatico (D21); il consuntivo si ricalcola dai dati vivi (il banner "modificato dopo la verifica" funziona come sempre).
- Iscrizione eliminata: con lei i partecipanti e gli eventuali movimenti a saldo zero; la persona può essere iscritta di nuovo. Ripristino rifiutato se nel frattempo la persona è stata iscritta di nuovo.
- Le righe eliminate insieme hanno lo stesso `deleted_at`: Annulla ripristina esattamente quel gruppo.
- Pulsanti: nel menu "…" della riga (pagamento, spesa, trasferimento, riporto, iscrizione); persona in fondo alla scheda ("Elimina persona"); workshop manuale in fondo al tab Info ("Elimina workshop"). Lato server ogni azione controlla ruolo e condizioni (`server/deletions` + funzioni `gw_delete_*` / `gw_restore_deleted`).

---

## 11. Correzioni dalla revisione (Fase 4e, migrazione 024)

Dettagli e numeri in `revisione.md` (colonna Esito). In breve:

- **Ale:** "+ Nuovo pagamento" propone Saldo col residuo se c'è già un pagamento valido (`newPaymentPreset`); sulle cancellate con soldi pagati "Registra rimborso di X €" (`gw_refund_booking`: un rimborso per parte che ha incassato, oppure uno solo della parte indicata se non si può ripartire); riga aperta Quota · Stato · Pagamenti · "Altri dati" (email, fattura, note); "Sembra già iscritta come «X»" nella riga (dal `possible_duplicate_person_id`, al browser arriva solo il testo di Ale) e nell'anteprima del box di testo (`gw_preview_entered_matches`, sola lettura: id dell'iscrizione e testo di Ale) con "Aggiorna quella iscrizione / È un'altra persona".
- **Box di testo:** data dei pagamenti obbligatoria solo se un pagamento non ha la sua (`gw_import_roster` accetta `p_paid_on` nullo); "Metodo / Tipo per tutti i pagamenti senza…"; "Non importare le cancellate senza pagamenti" (preselezionato); righe già presenti: "Salva l'email" se Ale non ne aveva scritta una (`entered_email` della riga).
- **Laura:** "Collega le corrispondenze esatte (N)" (stessa email, oppure stesso nome e cognome senza email diverse; un solo socio per persona e una sola persona per socio; ricalcolate alla conferma); dopo un collegamento che lascia "Non collegata": "Nel libro soci ci sono più persone con questo nome: serve l'email."; scheda persona con lo stato tessera per periodo (oggi e i periodi dei suoi workshop, es. "2025/26: In regola · 2027: Quota non registrata"), ognuno col suo "Segna quota associativa pagata" (`periodFrom`); nessuna `window.confirm` (`InlineConfirm`); "Altri nomi" sotto il Nickname, eliminati con conferma e "Eliminato · Annulla" (`gw_restore_person_alias`).
- **Conti:** D24, D25; spesa con data predefinita oggi e riga chiusa data · categoria · anticipata da · inserita da; iscrizione con pagamenti: "Elimina anche i pagamenti (X €) e l'iscrizione", una conferma e un Annulla (`gw_delete_booking_with_payments`); agli admin "Per correggere un importo: Ale → Modifica"; Excel con il foglio "Trasferimenti e riporti".
- **Testi (gruppo 5, parole comuni in `UI_LABELS` di `labels.ts`):** sempre **Iscrizione** (i messaggi delle migrazioni vecchie con "prenotazione" si traducono in `errors.ts`); **Collega** solo per il libro soci, **Abbina** per le persone del gestionale; **quota associativa** per l'associazione; chip **Richiesta inviata**; **Chiudi** nei moduli, **Annulla** solo per l'undo, **Storna movimento**, **Revoca validazione**; stato socio **In regola · Quota non registrata (dal …) · Modulo non trovato · Non collegata** ("(manuale)" per le validazioni manuali); **Rimane** = Entrate − Uscite (anche nella ripartizione), **Da trasferire** = residuo, sezione **Divisione Peony / Ale**; **Salva** per i dati, **Registra** per soldi e contatti, **Conferma** solo nelle conferme sul posto; messaggi di esito col punto; sempre **Ale** (anche come nome del ruolo). Telefono: sotto i 380 px la data del modulo pagamento va su una riga propria; il menu "…" ha 8 px di spazio ai lati.

---

## 12. Semplicità per Ale (Fase 4f, migrazione 026)

- **Data del pagamento facoltativa, ovunque** (modulo pagamento, Modifica, Aggiungi, anteprima del box di testo, rimborso del pagato): `gw_payments.paid_on` nullable (026); `gw_insert_payment` richiede solo "Incassato da"; `gw_import_roster` non chiede più la data; nella Modifica una data vuota toglie la data (`paid_on` presente e nullo), assente tiene quella dell'originale. Nell'elenco "data non indicata" (`formatPaymentDate`); ordine per data, i movimenti senza data per data di inserimento (`comparePayments`). Nell'anteprima la data non è più tra i campi da completare. Sostituisce "data dei pagamenti obbligatoria" (sezione 6) e "Data e incassato da sono obbligatori". Il rollback dà ai pagamenti senza data la data di inserimento, con storico.
- **Interfaccia compatta** (tutto il gestionale, telefono 360 px): misure in un unico punto, `UI` e `buttonClass` in `ui.tsx` — campi e menu 40 px con testo 15 px, etichette 12 px a 4 px dal campo, card 12 px di padding, 8 px tra i campi e 12 px tra i blocchi, pulsanti principali 40 px, secondari 36 px e piccoli 32 px con area di tocco di 40 px, titoli delle sezioni 16 px. Sostituisce i 44 px della sezione 7 (il tastierino del PIN e la barra in basso restano più alti). Campi affiancati con basi flex (`PAYMENT_FIELD_WIDTH`): se un campo non entra va a capo, i menu non si troncano. Pagamento: Importo · Metodo · Data su una riga, poi Tipo · Incassato da, poi Note; data compatta `DateField` ("oggi" / "28 ott" / "nessuna", × per toglierla). Riga iscrizione: Quota · Stato, Fattura · Email, Note a tutta larghezza. Anteprima: riga incollata (12 px) e "Includi" sulla stessa riga, Nome · Email, Stato · Quota; avvisi con le risposte come pulsanti piccoli affiancati ("Sì, è lei" · "No, è un'altra persona"; nel conflitto testo/pagamenti solo il nome dello stato).
- **Analisi** dal punto di vista di Ale (solo telefono, niente gergo): `revisione-ale.md`, nessuna modifica al codice.

---

## 13. Semplificazioni per Ale (Fase 4g, D28)

Dettagli e numeri in `revisione-ale.md` (colonna Esito). Nessuna migrazione: tutto lato interfaccia e server action.

- **Bloccanti:** sotto l'errore del PIN "Se non riesci a entrare, aspetta 15 minuti o scrivi a Laura." (il messaggio d'errore resta generico). "Modifica" visibile su ogni pagamento; nel "…" solo "Ho restituito dei soldi" ed "Elimina". **"Eliminato · Annulla" (sostituisce i 10 secondi di D22 e sezione 10):** almeno 30 secondi, poi resta finché non si tocca altro, al massimo 10 minuti (il limite del server); vicino alla riga eliminata (`UndoSlot`, `undoScope`) per pagamenti e iscrizioni di Ale, in basso negli altri casi (`undoShouldHide` in `deletions.ts`). **Bozza del box di testo** (`draft.ts`): testo e anteprima non salvati solo su quel telefono (localStorage, chiave `gw-bozza:<workshop>:<operatore>`, ogni accesso in try/catch), cancellata al salvataggio, con "Svuota" o dopo 7 giorni; riaprendo "Hai un testo non salvato del 29 ott · Riprendi · Svuota". Si conservano solo i campi delle righe nati dal testo o dalle correzioni di Ale (elenco chiuso di chiavi), mai iscrizioni salvate né risposte del server.
- **Pagamento:** "Cerca un nome" e "+ Aggiungi" in cima al tab Iscrizioni; "+ Pagamento" sulla riga chiusa; Pagamenti aperti di default. Modulo: Importo · Metodo · Data, sotto "Incassato da Ale · cambia" e "altro…" (Tipo e Note). **Tipo dedotto** (`deducedPaymentType`, anche nell'anteprima con `previewPaymentTypes`): dopo il pagamento manca qualcosa → acconto, prezzo raggiunto → saldo, senza prezzo → acconto, rimborso → altro; scelto a mano in "altro…" vale quello. **Metodo proposto** = ultimo pagamento registrato da quell'operatore (`getLastPaymentMethod`). Modifica: "Salva modifica" · "Elimina pagamento", niente "Storna" (l'azione server di storno resta, non più usata da Ale). Ad Ale solo i pagamenti validi (correzioni e "modificato" solo agli admin). Cancellata con soldi: "Ho restituito X € a questa persona" con conferma. Aggiungi: Nome · Partner · Stato · "+ Pagamento" ("Quanto ha già pagato?"); email, note e prezzo speciale in "altro…".
- **Parole (anche per gli admin):** Rimane → **Guadagno**, Uscite → **Spese**, Concordato → **Totale prezzi**, Ancora da pagare → **Mancano**, Eccedenze → **Pagato in più**, Anticipata da → **Pagata da**, quota del workshop / tariffa dedicata → **Prezzo** / **Prezzo speciale** ("torna al prezzo normale"), Interpreta → **Leggi il testo**. Chi deve a chi come frase (`debtPhrase`): ad Ale "Devi dare X € a Peony" · "Peony ti deve X €" · "Siete pari"; agli admin "Ale deve dare X € a Peony" · "Peony deve dare X € ad Ale" · "Pari" (anche `settlement.frase`, Excel e stampa; il badge D24 "Saldato" diventa "Pari"). "Registra trasferimento" del residuo → "Ho dato X € a Peony" (admin: "Ale ha dato X € a Peony") con "L'hai già dato? Lo segno come fatto oggi.". **Conflitto di versione:** "Peony ha appena cambiato questa iscrizione." / "Hai appena cambiato … da un'altra schermata." (dallo storico, solo Peony/Ale come D25; altrimenti "Questi dati sono appena stati cambiati da qualcun altro.") con il pulsante "Aggiorna" (`Notice` + `ConflictRefresh`). Errori col campo ("Importo: scrivi un numero, es. 250."). Esiti in seconda persona ("Fatto: 3 nuove, 1 aggiornata, 4 pagamenti."). Altro: "Sei entrata come Ale" · "Esci (poi servirà il PIN)".
- **Conti e home di Ale:** home con la frase e il workshop in corso/prossimo in cima, riquadri dell'anno sotto, niente sottotitolo; "Da ricontrollare" solo agli admin. Tab Conti di Ale (`OrganizerAccounts`): in cima la frase con "Ho dato X € a Peony", Guadagno, Spese con "+ Spesa" sempre visibile ("Pagata da" predefinito Ale, categoria facoltativa), "Da incassare ancora X €" con il link "chi deve pagare" (`?tab=iscrizioni&filtro=da-pagare`, `owesMoney`); tutto il resto in "Dettagli" chiuso (entrate solo come totale, spese per categoria, divisione, Excel e Stampa); niente banner della verifica; perdita: "Il workshop è in perdita: Laura deciderà come dividerla." (controlli solo admin). Gli admin vedono il tab Conti come prima, con le parole nuove. "Inserito da Peony" solo sulle iscrizioni non inserite da Ale. **Cambio del prezzo del workshop** (tab Iscrizioni e Info, entrambi i ruoli): prima di salvare "Cambia il prezzo di N iscrizioni (non quelle con prezzo speciale). M non risulteranno più pagate. Confermi?" (`feeChangeImpact`, `getFeeRows`).
- **Box di testo:** aperto da solo se l'elenco è vuoto (o c'è una bozza); riga di aiuto con l'esempio «Claudia 250 paypal»; card chiuse su una riga ("Dalia · Acconto pagato · 225 € PayPal ✓", "Correggi") quando è tutto giusto, aperte solo quelle da completare o da chiarire; niente "Tipo?" (tipo dedotto, `typeExplicit` del parser quando il testo dice saldo/acconto); "Torna al testo" dopo delle correzioni chiede "Le correzioni dell'anteprima si perdono. · Torna al testo · Resta".

---

## 14. Associazione, presenze, email, storico (Fase 5, D27, migrazione 027)

- **Presenze:** colonna `gw_bookings.present` (boolean, default false), scritta solo con `gw_set_present(p_operator_id, p_booking_id, p_version, p_present)`: tutti e due i ruoli (`setPresentAction`, `requireOperator`), controllo di `version` (GW409), "Presente" solo sulle iscrizioni confermate (GW400; togliere la spunta sempre), storico `booking` con `present` prima/dopo. Non cambia lo stato né i dati associativi. `PresentToggle` sulla riga chiusa (tab Iscrizioni di Ale; tab Partecipanti: sotto la riga su mobile, colonna "Presente" su desktop), visibile dal giorno di inizio (`showPresence`); "Presenti X / Y" nell'intestazione del workshop dal giorno di inizio (`presentCount`: X confermate con la spunta, Y confermate, una coppia = 1). `gw_booking_participants.attendance` (010) non si usa più. Scheda persona, "Storico workshop": "· Presente" se l'iscrizione ha la spunta.
- **Tab Email** (solo admin, `?tab=email`, `EmailTab`, `email-list.ts`): una riga per persona (persone unite escluse, una volta sola); Confermati = Acconto pagato o Saldato, selezionati all'apertura; Interessati e Prenotati a parola in grigio, non selezionati ma selezionabili; lista d'attesa e cancellati esclusi. Senza email: casella disattivata, "manca l'email" e "Completa la scheda". "Copia email (N)" in basso (Ccn di Gmail, ", ", senza doppioni ignorando maiuscole); senza appunti il testo resta da selezionare. Al browser arrivano solo nome, altro nome, email e stato. Nel tab Partecipanti resta solo la Copia email dei gruppi "Da contattare" / "Richiesta inviata" (`ContactGroupTools`).
- **Storico** (`/gestione/altro/storico`, tutti e due i ruoli, ultima voce di Altro): `gw_audit_list(p_viewer_role, p_filter_operator, p_workshop_id, p_kind, p_person_id, p_offset, p_limit)`, sola lettura; il ruolo lo passa il server dalla sessione (`getAuditPage`). Tipi (`gw_audit_kind`): anagrafica, iscrizioni, pagamenti, spese, trasferimenti, riporti, conti (workshop), accessi. **Organizzatrice**, filtrato in Postgres: solo iscrizioni, pagamenti, spese, trasferimenti, riporti e, del workshop, solo i cambi dello stato dei conti (`settlement_status`, `verified_at`); prima/dopo ridotti da `gw_audit_organizer_view` ai campi che vede già nel suo tab (delle persone solo `entered_as`; mai id di persone, abbinamenti, libro soci, snapshot); righe che così non cambiano niente nascoste; persona della riga = `entered_as`; chi ha fatto la modifica solo come ruolo (Peony/Ale, D25), mai il nome; filtri per operatore e persona ignorati. **Admin:** tutto, con nome dell'operatore e persona (`gw_person_label`); filtri `chi`, `workshop`, `tipo`, `persona`, `pagina` nell'URL. `gw_audit_clean` (SQL) e `cleanAuditValue` (TS) tolgono PIN, hash, token e note fiscali per tutti. Link "Storico" dalla scheda persona (admin, `?persona=`) e dal tab Conti (tutti e due i ruoli, `?workshop=`).
- **Collega al libro soci** (`/gestione/altro/soci`, solo admin): persone non unite senza collegamento esplicito; proposte da `memberLinkProposals` (`exact-matches.ts`) sui soci non collegati (`listUnlinkedMembers`): prima email (`normalizeMembershipEmail`), poi nome e cognome (`normalizeMembershipNameKey`, ordine indifferente); solo un socio per persona e una persona per socio. Per email spuntate, per nome no; "Conferma selezionati" (`linkMemberProposalsAction`) ricalcola e collega con `linkPersonToMember`. Sotto, "Nessuna corrispondenza" con il link alla scheda.
- **Scheda persona:** "Scollega dal libro soci" (conferma sul posto) quando c'è un collegamento esplicito; "Segna quota associativa pagata" resta la correzione manuale (D11, non `gw_membership_overrides`).
- **Caricamento:** `loading.tsx` per soci (Google Sheet) e storico (`PageLoading` in `ui.tsx`).



---

## D30 — Tab Email del gestionale (FASE 7)

Le comunicazioni ai partecipanti stanno esclusivamente nel tab **Email** degli admin. Il tab Partecipanti mantiene gli stati associativi e gli ultimi contatti ma non azioni di invio. Il percorso è: dettagli condivisi del workshop, scelta del messaggio, destinatari proposti, copia di Ccn/oggetto/corpo HTML in Gmail, conferma esplicita dell'avvenuto invio. Copiare **non** equivale a inviare. I riquadri sono compatti e apribili a richiesta; si parte dalla prima comunicazione con destinatari da contattare.

Le quattro categorie sono **richiesta di associazione**, **partner da conoscere**, **sollecito** (associazione e partner distinti) e **dettagli del workshop**. La richiesta e i solleciti associativi riusano `gw_membership_contacts` per persona e periodo; gli altri invii usano `gw_email_sends` per persona e workshop. Le registrazioni sono manuali, con data validata, eliminazione logica e audit. Le persone senza email non sono selezionabili; l'admin può correggere la scheda. I gruppi sono ricalcolati dal server per evitare registrazioni non più appropriate.

Tutte le email sono HTML, con lo stesso layout grafico del modello Level 2+ (680px, palette sabbia/bordeaux, logo, riquadri ◆ e pulsanti, CSS inline). Sorgenti originali in `docs/gestionale/email/`, asset in `public/email/` con URL assoluti. `src/lib/gestionale/email/` contiene i generatori e l'escaping dei testi. L'interfaccia presenta anteprima sandbox e copia Gmail HTML e plain text. I dati variabili del workshop sono versionati in `gw_email_texts`, quelli globali in `gw_settings` (`email_defaults`), modificabili solo dagli admin in `/gestione/altro/impostazioni-email`. La migrazione è `028_gw_email.sql` con rollback, da applicare separatamente dopo i test; nessuna scrittura automatica sul database reale.

La FASE 7 non si considera completata senza TypeScript, test del gestionale, test SQL, verifica di Gmail desktop e valutazione del comportamento mobile. La pull request rimane draft finché queste verifiche non sono completate.
