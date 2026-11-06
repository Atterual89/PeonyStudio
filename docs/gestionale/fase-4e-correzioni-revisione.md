# Gestionale Workshop — FASE 4e: Correzioni dalla revisione

Leggi prima `docs/gestionale/00-contesto.md` e `docs/gestionale/revisione.md` (i numeri `#` qui sotto si riferiscono a quella tabella).
Lavora sul branch `feat/gestionale`. Esegui in silenzio. Mostra solo il report finale.
Nessuna scrittura sul database reale. Se serve, migrazione `024_gw_correzioni_revisione.sql` (+ `.down.sql`, notify finale), non applicata.
Aggiorna `00-contesto.md` con le decisioni D24–D26. Commit separati per i gruppi 1–5 qui sotto. Alla fine aggiorna `revisione.md` aggiungendo una colonna **Esito** (corretto / non applicabile / rimandato) per ognuno dei 30 punti.

---

## Decisioni di Laura

- **D24 — Saldato automatico (#24, #25).** "Saldato" = residuo del conguaglio uguale a 0, calcolato sempre dai numeri (trasferimenti eseguiti compresi). Se gli importi cambiano dopo (es. uno sconto dell'ultimo momento), il workshop torna **da solo** "Aperto · da trasferire X €". Gli stati manuali del consuntivo diventano solo due: **Provvisorio** / **Verificato** (con snapshot e avviso di modifica come ora). "Da conguagliare" e "Conguagliato" non sono più stati da premere: si deducono dal residuo. Nella sezione Divisione Peony / Ale, quando il residuo non è 0: pulsante **"Registra trasferimento di X € (Ale → Peony)"** precompilato, con conferma; registrato come eseguito, porta il residuo a 0. Migra i workshop esistenti (gli stati da_conguagliare/conguagliato diventano verificato).
- **D25 — Permessi invariati (#17, #19, #29).** Spese modificabili da tutti; consuntivo verificabile da chiunque. Aggiungi solo trasparenza: ogni spesa mostra "inserita da Peony/Ale"; lo stato "Verificato" mostra "da <Peony/Ale> il <data>".
- **D26 — Contatti associazione (#13, #14).** "Da contattare" = collegata al libro soci e non in regola. Le non collegate vanno in un chip separato **"Da verificare nel libro soci"**, senza pulsanti di richiesta. Nei gruppi contano le iscrizioni confermate; aggiungi un interruttore "includi interessati" (spento di default).

---

## Gruppo 1 — Ale, iscrizioni e pagamenti

- **#1** "+ Nuovo pagamento": se esiste già un pagamento valido → tipo **Saldo** e importo = residuo; altrimenti Acconto, importo vuoto.
- **#2** Avviso "Cancellato con X € pagati" con pulsante **"Registra rimborso di X €"** precompilato col pagato netto (un solo movimento di rimborso, ripartito automaticamente se gli incassi erano di parti diverse; se non è possibile, chiedi a chi va attribuito).
- **#3** Verifica che anche nella riga di Ale l'elenco mostri solo i movimenti validi con "modificato" e "Mostra correzioni (N)", come già nel resto.
- **#4** Riga aperta di Ale, ordine: Quota · Stato · **Pagamenti** · poi "Altri dati" richiudibile (email, fattura, note).
- **#28 + #5** Segnale per Ale "Sembra già iscritta come «X»" nella sua riga e nell'anteprima del box di testo, quando il server abbina la persona a un'altra iscrizione dello stesso workshop (stessi criteri dell'abbinamento automatico: nickname, altri nomi, email). Nessun dato anagrafico: solo il testo che Ale stessa aveva scritto. Nell'anteprima è un punto da chiarire: "Aggiorna quella iscrizione / È un'altra persona".

## Gruppo 2 — Box di testo

- **#6** Data dei pagamenti obbligatoria solo se almeno una riga inclusa ha un pagamento.
- **#7** In cima all'anteprima: "Metodo per tutti i pagamenti senza metodo [▼]" e "Tipo per tutti i pagamenti senza tipo [▼]".
- **#8** Opzione preselezionata "Non importare le cancellate senza pagamenti".
- **#9** Righe già presenti: se la riga contiene un'email e la persona non ne ha una, proponi "Salva l'email".

## Gruppo 3 — Laura, collegamenti e richieste

- **#10** In cima al tab Partecipanti: **"Collega le corrispondenze esatte (N)"** → elenco di controllo (persona → socio proposto, spunte tutte attive) → Conferma. Solo corrispondenze esatte e uniche.
- **#11** Se dopo il collegamento lo stato resta "Non collegata": "Nel libro soci ci sono più persone con questo nome: serve l'email."
- **#12** Nei gruppi "Da contattare" e "Richiesta inviata": caselle di spunta (tutte attive) prima di "Copia email" e "Registra come inviata"; entrambe le azioni valgono solo per le persone spuntate.
- **#15** Scheda persona: stato tessera **per periodo** (es. "2025/26: In regola · 2027: Quota non registrata"), con "Segna quota associativa pagata" per periodo.
- **#16** Sostituisci tutte le `window.confirm` con la conferma sul posto.
- "Altri nomi" spostato subito sotto il campo Nickname nella scheda persona.

## Gruppo 4 — Conti e home

- **D24** come sopra (stati, Saldato automatico, pulsante "Registra trasferimento").
- **#18** Badge **"Da ricontrollare"** sulla card e nella tabella della home quando un consuntivo verificato è stato modificato dopo.
- **#20** Spesa: data predefinita oggi; nella riga chiusa data · categoria · "anticipata da" · "inserita da".
- **#21** Eliminazione iscrizione bloccata dai pagamenti: nel messaggio, "Elimina anche i pagamenti (X €) e l'iscrizione" con una sola conferma e un solo Annulla.
- **#22** Nella riga dei pagamenti in sola lettura per l'admin: "Per correggere un importo: Ale → Modifica".
- **#23** "Altri nomi": eliminazione con "Eliminato · Annulla" come le altre.
- **#26** Excel: titoli uniformati con l'interfaccia (vedi gruppo 5); foglio "Trasferimenti e riporti".

## Gruppo 5 — Testi e telefono

Applica **tutte** le proposte della sezione "Testi dell'interfaccia da uniformare" di `revisione.md`, in interfaccia, messaggi, export e documentazione:
- sempre **Iscrizione** (mai Prenotazione nei testi visibili);
- **Collega** solo per il libro soci, **Abbina** per le persone del gestionale;
- **quota associativa** per l'associazione ("Segna quota associativa pagata"), **quota** per il workshop;
- chip "In attesa" → **"Richiesta inviata"**;
- **Chiudi** nei moduli, **Annulla** solo per l'undo, **Storna movimento**, **Revoca validazione**;
- stato socio: **In regola · Quota non registrata · Modulo non trovato · Non collegata** (con "(manuale)" se validazione manuale);
- **Rimane** = Entrate − Uscite; **Da trasferire** = residuo del conguaglio; la sezione si chiama **Divisione Peony / Ale**;
- **Salva** per i dati, **Registra** per soldi e contatti, **Conferma** solo nelle conferme sul posto;
- iniziale maiuscola solo a inizio riga; sempre **Ale**; messaggi di esito con un'unica forma ("Note salvate.", "Pagamento registrato.", "Salvato.").

Raccogli i testi in un unico file (es. `src/lib/gestionale/labels.ts`) dove ragionevole, così restano coerenti.

- **#30** Sotto i 380 px il campo Data del modulo pagamento va su una riga propria; il menu "…" ha spazio intorno di almeno 8 px.
- **#27** Lascia com'è.

---

## Test

Copri ogni punto corretto con almeno un test (unitario, PGlite o di codice). In particolare: D24 (residuo 0 → Saldato; sconto successivo → torna Aperto; "Registra trasferimento"; migrazione degli stati), #1, #2, #5/#28 senza dati anagrafici per Ale, #10, #12, #15, #21, nessuna `window.confirm` nel gestionale, nessun testo "Prenotazione" visibile.

Poi tsc, lint del gestionale, build, `test:gestionale`, `test:gestionale:sql`. Niente push.

## Report finale (breve)

```
COMMIT: [hash per gruppo]
MIGRAZIONE: 024 sì/no
ESITO DEI 30 PUNTI: corretti N · non applicabili N · rimandati N (quali e perché)
TEST: ...
DA DECIDERE: solo se indispensabile
```
