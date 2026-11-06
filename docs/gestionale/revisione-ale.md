# Revisione "Semplicità per Ale" (Fase 4f, parte 2)

Analisi senza modifiche al codice, fatta leggendo i componenti delle schermate che Ale vede (ruolo `organizzatrice`) e immaginando un telefono a 360 px, **dopo** le correzioni 4f parte 1 (data facoltativa) e 1b (interfaccia compatta).

Ale: 50 anni, solo telefono, abituata a Google Keep, niente gergo informatico o contabile, legge con calma, non esplora i menu nascosti. Obiettivo: **chi è iscritto, chi le ha dato quanti soldi, quanto deve dare a Peony (o ricevere)**.

Schermate percorse: accesso con PIN (`accesso/page.tsx`, `PinPad`), home (`(app)/page.tsx`, `Recap`), intestazione e tab del workshop (`w/[id]/page.tsx`), tab Iscrizioni (`RegistrationsTab`, `FeeEditor`, `StatusPicker`, `PaymentForm`, `PaymentBits`, `EnteredEmails`), Aggiungi (`AddRegistration`), box di testo e anteprima (`TextImport`), tab Conti (`AccountsTab`, `ExpensesBlock`, `TransfersBlock`), tab Info (`WorkshopSettingsForm`), Altro (`altro/page.tsx`), eliminazioni (`Deletion`), messaggi d'errore (`errors.ts`). Lo storico non c'è per Ale (404).

Gravità: **la blocca** = non riesce a finire o non sa rimediare; **la rallenta** = ci riesce ma con passaggi o letture inutili; **la confonde** = parole o informazioni che non capisce o che la fanno dubitare.

---

## 1. Problemi

| # | Schermata | Problema per Ale | Gravità | Proposta | Esito |
|---|---|---|---|---|---|
| 1 | Accesso (PIN) | Dopo 5 PIN sbagliati vede "PIN non valido o accesso temporaneamente bloccato": non sa se ha sbagliato, quanto aspettare, chi chiamare. | la blocca | Aggiungere sotto: "Se non riesci a entrare, aspetta 15 minuti o scrivi a Laura" (il messaggio resta generico per sicurezza). | Fatto (4g, gruppo 1): sotto l'errore generico "Se non riesci a entrare, aspetta 15 minuti o scrivi a Laura." (`PIN_HELP`). |
| 2 | Home | "Conguagli da fare: Ale → Peony 950 €": parola contabile e freccia da decifrare; è proprio la risposta che cerca. | la confonde | Frase intera in cima: "Devi dare 950 € a Peony" / "Peony ti deve 120 €" / "Siete pari". | Fatto (gruppo 3): in cima alla home "Devi dare X € a Peony · Peony ti deve Y €" o "Siete pari" (`conguagliText`, `debtPhrase`); agli admin in terza persona. |
| 3 | Home | Riquadro "Rimane": non si capisce se è guadagno, soldi in cassa o ancora da incassare (accanto c'è "Da incassare"). | la confonde | Rinominare "Guadagno" (Entrate − Spese), uguale in home, card e Conti. | Fatto (gruppo 3): "Guadagno" in home, card, tabella, Conti, Excel e stampa. |
| 4 | Home | Badge della card "Aperto · da trasferire X €": non dice chi deve a chi; "Da ricontrollare" è un concetto della verifica degli admin. | la confonde | Badge "Devi dare X € a Peony" / "Pari"; "Da ricontrollare" solo agli admin. | Fatto (gruppo 3): badge "Devi dare X € a Peony" / "Peony ti deve X €" / "Pari"; "Da ricontrollare" solo agli admin. |
| 5 | Home | Sottotitolo "Eventi LuXuria da Ticket Tailor", selettore d'anno e quattro riquadri prima dei workshop: tanto da leggere prima di toccare il workshop in corso. | la rallenta | Per Ale: card del workshop in corso/prossimo in cima, riquadri sotto; togliere il sottotitolo. | Fatto (gruppo 4): per Ale frase e workshop in corso/prossimi in cima, poi "Totali dell'anno" con selettore e riquadri, poi Passati; niente sottotitolo. |
| 6 | Iscrizioni, riga chiusa | Su ogni riga "Inserito da Ale": per lei è sempre vero, è rumore. | la rallenta | Mostrare solo "Inserito da Peony" quando non l'ha inserita lei. | Fatto (gruppo 4): "Inserito da Peony" solo sulle iscrizioni non inserite da lei. |
| 7 | Iscrizioni, elenco | Nessuna ricerca: con 25 iscrizioni per trovare "Claudia" deve scorrere; "Aggiungi" sta in fondo, dopo l'elenco. | la rallenta | Casella "Cerca un nome" in cima all'elenco (filtro sul telefono) e "+ Aggiungi" in alto, accanto al box di testo. | Fatto (gruppo 2): "Cerca un nome" (filtro sul telefono, `matchesSearch`) e "+ Aggiungi" in alto, sotto il box di testo. |
| 8 | Iscrizioni, riga aperta | Per registrare un pagamento: apri la riga → apri "Pagamenti · 1 · 250 €" → "+ Nuovo pagamento". Tre tocchi prima del modulo. | la rallenta | Pulsante "+ Pagamento" già sulla riga chiusa (o primo elemento della riga aperta), sezione Pagamenti aperta di default. | Fatto (gruppo 2): "+ Pagamento" sulla riga chiusa (apre la riga col modulo pronto); Pagamenti aperti di default. |
| 9 | Modulo pagamento | Cinque scelte per ogni pagamento (importo, metodo, data, tipo, incassato da) più note: tipo e incassato da quasi sempre deducibili. | la rallenta | Ipotesi 1 e 2: restano Importo · Metodo · Data; Tipo e Incassato da in "altro…". | Fatto (gruppo 2, ipotesi 1 e 2): in vista Importo · Metodo · Data; tipo dedotto (`deducedPaymentType`) e Note in "altro…"; riga piccola "Incassato da Ale · cambia". |
| 10 | Modulo pagamento | Metodo vuoto ("—") di default: se lo dimentica il pagamento resta "metodo ?" e nei conti finisce sotto "Metodo non indicato". | la rallenta | Proporre il metodo usato nell'ultimo pagamento registrato da lei (modificabile). | Fatto (gruppo 2): metodo proposto = ultimo pagamento registrato da quell'operatore (`getLastPaymentMethod`). |
| 11 | Pagamenti, elenco | Modifica, Rimborso ed Elimina solo nel menu "…": se ha scritto 205 invece di 250 non trova come correggere. | la blocca | Ipotesi 4: "Modifica" visibile su ogni pagamento; nel "…" restano solo le azioni rare. | Fatto (gruppo 1, ipotesi 4): "Modifica" visibile su ogni pagamento; nel "…" solo "Ho restituito dei soldi" ed "Elimina". |
| 12 | Modifica pagamento | Tre modi di "annullare" un pagamento: "Storna movimento" (nel modulo), "Elimina" e "Rimborso" (nel "…"). Non sa quale usare. | la confonde | Per Ale solo "Salva modifica" ed "Elimina pagamento" (inserito per errore); "Ho restituito dei soldi" per i rimborsi veri. Niente "Storna". | Fatto (gruppo 2): nella Modifica solo "Salva modifica" ed "Elimina pagamento"; "Storna" tolto (anche da `UI_LABELS`). |
| 13 | Pagamenti, elenco | "Mostra correzioni (N)", righe barrate, etichetta "modificato", movimenti "Correzione": storia contabile che lei non ha chiesto. | la confonde | Per Ale solo i pagamenti validi; le correzioni restano agli admin (storico). | Fatto (gruppo 2): Ale vede solo i pagamenti validi; "modificato" e "Mostra correzioni" solo agli admin (`showCorrections`). |
| 14 | Riga aperta, Stato | Il menu ha 6 stati; scegliendo "Acconto pagato" o "Saldato" si apre all'improvviso un modulo di pagamento e, se lo chiude, lo stato torna indietro. | la confonde | Ipotesi 3: stati scelti a mano Interessato · Prenotato · Lista d'attesa · Cancellato; Acconto pagato / Saldato solo calcolati. | Fatto, versione ridotta (gruppo 5; ipotesi 3 non approvata): i 6 stati restano; il modulo aperto dallo stato dice "Registra il pagamento per confermare lo stato."; chiuso senza registrare "Stato non cambiato: nessun pagamento registrato.". |
| 15 | Riga aperta, Quota | "quota del workshop" / "tariffa dedicata" sotto l'importo, matita per cambiarla, "Ripristina quota del workshop". | la confonde | "Prezzo: 500 €" e, se diverso, "Prezzo speciale · torna al prezzo normale". | Fatto (gruppo 3): "Prezzo" con la matita; se speciale "Prezzo speciale · torna al prezzo normale". |
| 16 | Riga aperta, cancellata con soldi | "Registra rimborso di X €": "rimborso" sembra un'azione che restituisce i soldi dal gestionale. | la confonde | "Ho restituito X € a questa persona" con conferma. | Fatto (gruppo 2): "Ho restituito X € a questa persona" con conferma "Hai restituito X € a …? Lo segno come fatto.". |
| 17 | Iscrizioni, totali in fondo | "Concordato · Ricevuto · Ancora da pagare", "Eccedenze", "Pagato su iscrizioni cancellate", "iscrizioni senza quota (non contate)". | la confonde | "Totale prezzi · Ricevuto · Mancano"; "Pagato in più"; il resto solo se diverso da zero, con frasi intere. | Fatto (gruppo 3): "Totale prezzi · Ricevuto · Mancano"; sotto, solo se diversi da zero, frasi intere ("Pagato in più: X €.", "Pagato da chi ha cancellato: X €.", "N iscrizioni senza prezzo non sono contate."). |
| 18 | Eliminazione (iscrizione o pagamento) | "Eliminato · Annulla" dura 10 secondi e compare in basso sopra la barra: chi legge con calma lo perde e non ha più modo di rimediare (niente cestino). | la blocca | Ipotesi 8: almeno 30 secondi, e il messaggio resta finché non tocca altro. | Fatto (gruppo 1, ipotesi 8): almeno 30 secondi, poi resta finché non si tocca altro (massimo 10 minuti, come il server); vicino alla riga eliminata (`UndoSlot`) per pagamenti e iscrizioni di Ale, in basso negli altri casi. |
| 19 | Errori | "Modificato da un altro operatore, ricarica.": "operatore" e "ricarica" (come?) non le dicono cosa fare. | la confonde | "Laura ha appena cambiato questa iscrizione. [Aggiorna]" con il pulsante che ricarica. | Fatto (gruppo 3), con una scelta conservativa: "Peony ha appena cambiato questa iscrizione." (o "Hai appena cambiato … da un'altra schermata.") + pulsante "Aggiorna"; chi ha cambiato è detto come Peony/Ale dal ruolo (D25), non col nome dell'operatore. |
| 20 | Errori | "Dati non validi." e "Dati non validi: controlla i campi." senza indicare quale campo. | la confonde | Indicare il campo ("Importo: scrivi un numero, es. 250") ed evidenziarlo come "da completare". | Fatto (gruppo 3): messaggi col campo ("Importo: scrivi un numero, es. 250.", "Prezzo: …", "Nome: …", "Email: …") e importo evidenziato "da completare" nel modulo pagamento e in Aggiungi. |
| 21 | Aggiungi | Sette campi in colonna (nome, email, partner, email partner, stato, prezzo con matita, note) per un'iscrizione che di solito è solo un nome. | la rallenta | In vista: Nome · Partner · Stato · "+ Pagamento"; email, note e prezzo speciale in "altro…". | Fatto (gruppo 2): in vista Nome · Partner · Stato · "+ Pagamento"; email, note e prezzo speciale in "altro…". |
| 22 | Aggiungi | Scegliendo "Acconto pagato" compare "Primo pagamento" con tutti i campi del pagamento; scegliendo "Saldato" l'importo è la quota intera. | la confonde | Con l'ipotesi 3: un pulsante "Ha già pagato? + Pagamento", lo stato si calcola da solo. | Fatto, versione ridotta (gruppo 2; ipotesi 3 non approvata): il primo pagamento compare come "Quanto ha già pagato?" (importo e metodo; data, tipo e note in "altro…"), da "+ Pagamento" o scegliendo Acconto pagato / Saldato. |
| 23 | Box di testo | Il testo incollato non si conserva: se il telefono ricarica la scheda mentre torna su Keep a copiare il resto, perde tutto (anche le correzioni nell'anteprima). | la blocca | Tenere sul telefono il testo e l'anteprima non salvati del workshop finché non preme Salva o "Svuota". | Fatto (gruppo 1): bozza solo su quel telefono (localStorage, chiave per workshop e operatore, sempre in try/catch); "Hai un testo non salvato del 29 ott · Riprendi · Svuota"; cancellata al salvataggio, con Svuota o dopo 7 giorni; solo testo e righe scritte da Ale. |
| 24 | Box di testo | "Torna al testo" butta le correzioni fatte nell'anteprima senza avvisare. | la rallenta | Avviso "Le correzioni dell'anteprima si perdono · Torna al testo · Resta". | Fatto (gruppo 5): dopo delle correzioni "Le correzioni dell'anteprima si perdono. · Torna al testo · Resta". |
| 25 | Box di testo | Pulsante "Interpreta": parola tecnica. | la confonde | "Leggi il testo". | Fatto (gruppo 3): "Leggi il testo". |
| 26 | Anteprima | Ogni persona è un modulo aperto con 6 campi più 5 per ogni pagamento: 15 righe incollate = scorrere moltissimo, anche quando tutto è già giusto. | la rallenta | Card chiuse su una riga ("Dalia · Acconto pagato · 225 € PayPal ✓") con "Correggi"; aperte solo quelle con campi da completare. | Fatto (gruppo 5): card chiuse su una riga ("Dalia · Acconto pagato · 225 € PayPal ✓") con "Correggi"; aperte solo quelle da completare o da chiarire. |
| 27 | Anteprima | "Il testo dice Prenotato a parola, i pagamenti indicano Acconto pagato": domanda difficile e frequente. | la confonde | Con l'ipotesi 3 sparisce: lo stato si calcola dai pagamenti, resta solo Interessato / Lista d'attesa / Cancellato se scritto. | Fatto, versione ridotta (gruppo 5; ipotesi 3 non approvata): "Nel testo: Prenotato. Ha già pagato 300 €: segno Acconto pagato? · Sì · No, lascia Prenotato". |
| 28 | Anteprima | Dubbio "Tipo?" sui pagamenti successivi al primo e campo Tipo da completare. | la rallenta | Con l'ipotesi 1 il tipo si deduce: nessun dubbio "Tipo?". | Fatto (gruppo 5): tipo dedotto anche nell'anteprima (`previewPaymentTypes`, anche senza prezzo → acconto), nessun "Tipo?" da completare; il tipo si cambia in "altro…". |
| 29 | Anteprima | Sotto la quota "Tariffa dedicata" / "Quota del workshop"; "Sembra già iscritta come «X»" senza dire cosa succede scegliendo. | la confonde | "Prezzo speciale" / niente se normale; "Sì, è lei (aggiungo i pagamenti)" · "No, è un'altra persona". | Fatto (gruppo 3): "Prezzo speciale" (niente se normale); "Sì, è lei (aggiungo i pagamenti)" · "No, è un'altra persona". |
| 30 | Conti, in cima | "Uscite" nei riquadri e "Spese" nella sezione: due parole per la stessa cosa. | la confonde | Sempre "Spese". | Fatto (gruppo 3): sempre "Spese". |
| 31 | Conti | La risposta "quanto devo dare a Peony" sta nella sezione chiusa "Divisione Peony / Ale", col riassunto "Ale → Peony 950 €". | la confonde | Ipotesi 6: frase in cima al tab, sempre visibile. | Fatto (gruppo 4, ipotesi 6): frase in cima al tab Conti, sempre visibile. |
| 32 | Conti, Divisione | Ripartizione, Quota, Spettanza, Posizione per parte, Rimborso spese anticipate, Trasferimenti, Riporti, Stato della verifica (Provvisorio / Verificato), "Torna a Provvisorio". | la confonde | Ipotesi 6: per Ale in "Dettagli" chiuso (o solo admin). | Fatto (gruppo 4): per Ale tutto il resto in "Dettagli" chiuso (stessi numeri di Laura). |
| 33 | Conti, Divisione | Pulsante principale "Registra trasferimento di X € (Ale → Peony)": sembra un'istruzione, invece registra il pagamento come già fatto oggi. | la confonde | "Ho dato X € a Peony" con conferma "L'hai già dato? Lo segno come fatto oggi". | Fatto (gruppo 3): "Ho dato X € a Peony" con conferma "L'hai già dato? Lo segno come fatto oggi." (admin: "Ale ha dato X € a Peony"). |
| 34 | Conti, perdita | "Perdita da ripartire" e "Perdita sostenuta da Peony" con un campo importo. | la confonde | Solo admin; ad Ale "Il workshop è in perdita: Laura deciderà come dividerla". | Fatto (gruppo 4): controlli della perdita solo admin; ad Ale "Il workshop è in perdita: Laura deciderà come dividerla.". |
| 35 | Conti, Entrate | "Entrate dai partecipanti · N iscrizioni" ripete il tab Iscrizioni, con "Incassato da Peony/Ale" e i totali per metodo. | la rallenta | Ipotesi 6: per Ale solo il totale con "vedi in Iscrizioni". | Fatto (gruppo 4): per Ale solo il totale delle entrate con "vedi in Iscrizioni" (in Dettagli). |
| 36 | Conti, Spese | Per aggiungere una spesa: apri "Spese · N categorie" → "+ Spesa" → 5 campi; "Anticipata da" è gergo. | la rallenta | "+ Spesa" sempre visibile in cima a Conti; "Pagata da" (predefinito Ale); categoria facoltativa. | Fatto (gruppo 4): "+ Spesa" sempre visibile in cima a Conti; "Pagata da" (predefinito Ale per lei); categoria facoltativa. |
| 37 | Conti, banner | "Conti modificati dopo la verifica: da ricontrollare" con l'elenco prima → dopo. | la confonde | Solo admin. | Fatto (gruppo 4): il banner della verifica solo agli admin. |
| 38 | Conti, fondo | Pulsanti "Excel" e "Stampa / PDF" che non le servono. | la rallenta | In "Dettagli". | Fatto (gruppo 4): Excel e Stampa / PDF in "Dettagli" per Ale. |
| 39 | Info | "Nome e date (da Ticket Tailor, non modificabili qui)"; aiuto della quota con "tariffa dedicata"; "Ripartizione … (sola lettura)". | la confonde | "Nome e date (si cambiano sul sito)"; "Prezzo per iscrizione: cambia per tutti, tranne i prezzi speciali"; "Divisione: Peony 30% · Ale 70%". | Fatto (gruppo 3): "Nome e date (si cambiano sul sito)"; "Prezzo per iscrizione: cambia per tutti, tranne i prezzi speciali"; "Divisione: Peony 30% · Ale 70%". |
| 40 | Quota del workshop | Cambiare la quota aggiorna subito tutte le iscrizioni; l'avviso "N iscrizioni non sono più saldate" arriva solo dopo. | la confonde | Prima di salvare: "Cambia il prezzo di 18 iscrizioni (non quelle con prezzo speciale). 3 non risulteranno più pagate. Confermi?". | Fatto (gruppo 4): prima di salvare "Cambia il prezzo di N iscrizioni (non quelle con prezzo speciale). M non risulteranno più pagate. Confermi?" (tab Iscrizioni e Info, anche per gli admin; `feeChangeImpact`). |
| 41 | Altro | "Operatore connesso" e il nome del ruolo; "Esci" senza dire che dopo serve il PIN. | la confonde | "Sei entrata come Ale" · "Esci (poi servirà il PIN)". | Fatto (gruppo 3): "Sei entrata come Ale" · "Esci (poi servirà il PIN)"; agli admin resta il ruolo. |
| 42 | Tutte | Molti messaggi e azioni scritti in terza persona o al plurale ("Importate 3 iscrizioni nuove, 1 aggiornate, 4 pagamenti."). | la confonde | Frasi brevi in seconda persona: "Fatto: 3 nuove, 1 aggiornata, 4 pagamenti". | Fatto (gruppo 3): esiti brevi in seconda persona ("Fatto: 3 nuove, 1 aggiornata, 4 pagamenti.", "Fatto: pagamento registrato."). |
| 43 | Telefono 360 px | Dopo la 1b i campi sono affiancati, ma in Stato · Quota della riga aperta e nella riga Importo · Metodo · Data lo spazio è al limite: un importo come "1.250,50" o una data dell'anno prima ("30 dic 25") non entra senza scorrere nel campo. | la rallenta | Nessun intervento ora; da ricontrollare se si aggiunge altro sulla stessa riga. | Non applicabile: nessun intervento (come proposto). |

**Esito (Fase 4g):** fatti **42** (tre in versione ridotta perché l'ipotesi 3 non è stata approvata: #14, #22, #27) · non applicabili **1** (#43, nessun intervento).

**Conteggio (43):** la blocca **4** (#1, #11, #18, #23) · la rallenta **14** (#5, #6, #7, #8, #9, #10, #21, #24, #26, #28, #35, #36, #38, #43) · la confonde **25** (#2, #3, #4, #12, #13, #14, #15, #16, #17, #19, #20, #22, #25, #27, #29, #30, #31, #32, #33, #34, #37, #39, #40, #41, #42).

### I 5 più importanti

1. **#11 — Modifica nascosta nel "…"**: l'errore più probabile (importo sbagliato) non ha un rimedio visibile.
2. **#31 + #2 + #4 — "Quanto devo dare a Peony" non è mai scritto come frase**: è il suo obiettivo finale ed è espresso con frecce, "conguagli", "da trasferire", dentro una sezione chiusa.
3. **#9 + #14 — Tipo, Incassato da e stati economici scelti a mano**: metà delle decisioni del pagamento e il salto improvviso al modulo di pagamento dal menu Stato.
4. **#23 — Il testo incollato si perde** se la scheda si ricarica mentre torna su Keep: proprio nel flusso che userà per primo.
5. **#18 — "Annulla" per 10 secondi**: dopo un tocco sbagliato su Elimina non ha tempo di leggere e non c'è un cestino.

---

## 2. Le 8 ipotesi

| # | Ipotesi | Valutazione | Perché |
|---|---|---|---|
| 1 | Tipo del pagamento dedotto (resta in "altro…") | **Giusta** | La regola esiste già per lo stato (`autoStatus`, `gw_apply_auto_status`) e per la proposta del modulo (`newPaymentPreset`): dopo il pagamento manca qualcosa → acconto; raggiunta o superata la quota → saldo; rimborso → altro. Va applicata anche nell'anteprima del box di testo, così sparisce il dubbio "Tipo?" (#28). Unico caso da decidere: iscrizione senza quota → acconto. Il tipo serve solo come etichetta: nessun calcolo dipende da lui. |
| 2 | "Incassato da" nascosto in "altro…" | **Giusta, migliorabile** | È sempre Ale salvo i soldi presi da Peony; però conta nella divisione (`Incassato_X`). Meglio una riga piccola "Incassato da Ale · cambia" che un campo nascosto, così un incasso di Peony non finisce per errore sotto Ale. |
| 3 | Stato manuale: Interessato · Prenotato · Lista d'attesa · Cancellato; Acconto pagato e Saldato calcolati | **Giusta** | Toglie il salto al modulo di pagamento (#14, #22) e la domanda testo/pagamenti nell'anteprima (#27). Lista d'attesa e Cancellato non cambiano già da soli (D21). Da decidere solo cosa mostrare per una cancellata con soldi (resta "Cancellato · pagato X €") e come trattare uno stato manuale salvato oggi in conflitto con i pagamenti (si ricalcola una volta). |
| 4 | "Modifica" visibile, non nel "…" | **Giusta** | È il rimedio all'errore più comune (#11). "Elimina" resta nel "…" (serve solo per un inserimento sbagliato, D22) e "Rimborso" diventa "Ho restituito dei soldi" (#16). |
| 5 | Parole: Modifica, Restituisci soldi, Prezzo speciale, "Quanto devo dare a Peony" | **Giusta, migliorabile** | Il gestionale non muove soldi, li registra: meglio "Ho restituito X €" che "Restituisci soldi". Al posto del titolo "Quanto devo dare a Peony" una frase con il risultato: "Devi dare 950 € a Peony" / "Peony ti deve 120 €" / "Siete pari". "Storna" sparisce del tutto per Ale (bastano Modifica ed Elimina). Da aggiungere: Rimane → Guadagno, Uscite → Spese, Concordato → Totale prezzi, Eccedenze → Pagato in più, Anticipata da → Pagata da, operatore → nome di chi ha cambiato. |
| 6 | Conti per Ale: Entrate · Spese (+ Spesa) · "Devi dare / Peony ti deve"; il resto solo admin o in "Dettagli" chiuso | **Giusta, migliorabile** | Va aggiunto "Da incassare ancora X €" con il link all'elenco di chi deve pagare (le serve) e "Ho dato X € a Peony" (#33): senza, il workshop non risulta mai chiuso. Le note fiscali restano (sono solo sue, D7). Meglio "Dettagli" chiuso che nascosto: Ale vede gli stessi numeri di Laura (trasparenza, D25). |
| 7 | "Scrivi o incolla dagli appunti" resta in cima: come alleggerirlo | **Migliorabile** | Oggi è sempre chiuso all'apertura e si richiude dopo il salvataggio: va **aperto da solo se l'elenco è vuoto**. Poi: conservare testo e anteprima non salvati (#23), "Leggi il testo" al posto di "Interpreta" (#25), anteprima a card chiuse con solo quelle da completare aperte (#26), e una riga di aiuto sotto il titolo con un esempio ("Claudia 250 paypal"). |
| 8 | "Eliminato · Annulla" per 20–30 secondi | **Giusta, migliorabile** | Il server accetta già il ripristino per 10 minuti (D22): basta allungare il messaggio (`UNDO_SECONDS`). Meglio 30 secondi e il messaggio che resta finché non tocca altro, vicino alla riga eliminata e non in basso sopra la barra. |

---

## 3. Percorso più comune: "Claudia mi ha mandato 250 € con PayPal"

Claudia è già iscritta, quota 500 €, nessun pagamento. Ale apre il gestionale (sessione già attiva).

**Oggi (dopo 4f parte 1 e 1b)**

| Passo | Tocchi | Da leggere / decidere |
|---|---|---|
| Home → card del workshop | 1 | riquadri e card |
| Tab Iscrizioni (predefinito) → scorrere fino a Claudia → tocco sulla riga | 2 | cercare il nome scorrendo |
| "Pagamenti · 0 · 0 €" | 3 | |
| "+ Nuovo pagamento" | 4 | |
| Importo: tocco e "250" | 5 + tastiera | importo |
| Metodo: tocco e "PayPal" | 7 | metodo |
| Data ("oggi"), Tipo (Acconto, giusto), Incassato da (Ale) | 0 | tre campi da controllare |
| "Registra pagamento" | 8 | |

**8 tocchi** (10 se il tipo proposto è sbagliato), 6 campi da leggere, uno scorrimento dell'elenco.

**Dopo le correzioni proposte** (#7, #8, #10, ipotesi 1 e 2)

| Passo | Tocchi | Da leggere / decidere |
|---|---|---|
| Home → card del workshop in corso (in cima) | 1 | |
| "Cerca un nome": "cla" | 2 + tastiera | |
| "+ Pagamento" sulla riga di Claudia | 3 | |
| Importo "250" | 4 + tastiera | importo |
| Metodo: PayPal già proposto (ultimo usato) oppure tocco e scelta | 4–6 | metodo |
| Data "oggi" | 0 | |
| "Registra pagamento" | 5–7 | |

**5–7 tocchi**, 2 decisioni (importo, metodo), nessuno scorrimento. In alternativa, dal box di testo in cima: "Claudia 250 paypal" → "Leggi il testo" → "Sì, è lei" → Salva = **4 tocchi** più la scrittura.

**Ricontato sul codice nuovo (Fase 4g)**

| Passo | Tocchi | Da leggere / decidere |
|---|---|---|
| Home → card del workshop in corso (in cima per Ale) | 1 | la frase "Devi dare / Siete pari" sopra |
| "Cerca un nome": tocco e "cla" | 2 + tastiera | |
| "+ Pagamento" sulla riga di Claudia (la riga si apre col modulo pronto) | 3 | |
| Importo: tocco e "250" | 4 + tastiera | importo |
| Metodo: PayPal già proposto (ultimo usato da Ale) | 0 (2 se va cambiato) | metodo |
| Data "oggi", tipo dedotto (Acconto), "Incassato da Ale" | 0 | una riga piccola |
| "Registra pagamento" | 5 (7) | |

**5 tocchi** se il metodo proposto è giusto (7 se va scelto), 2 decisioni, nessuno scorrimento; con un elenco corto si può saltare la ricerca: **4 tocchi**. Dal box di testo: (tocco su "Scrivi o incolla", se il box non è già aperto) → "Claudia 250 paypal" → "Leggi il testo" → la card è già chiusa con ✓ ("Aggiorna: Claudia · Acconto pagato · 250 € PayPal ✓") → Salva = **2–3 tocchi** più la scrittura (uno in più, "Sì, è lei (aggiungo i pagamenti)", se il nome scritto è diverso da quello dell'iscrizione).
