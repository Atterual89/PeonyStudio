# Peony Studio — matrice email (8 esempi EML, novembre 2026)

## Cluster

| Famiglia | Variante | Esempi originali |
|---|---|---|
| Associazione | Iscrizione richiesta | Rope Jam registrazione associazione; Kinbaku LuXuria Level 2+ Registration required |
| Partner | Identificazione partner | Kinbaku LuXuria Level 2+ Partner info required |
| Informazioni evento | Workshop | Neck Rope; 3 Dimensions; Kinbaku LuXuria Level 2+ |
| Informazioni evento | Rope Jam praticanti | Rope Jam 11/11 conferma |
| Informazioni evento | Rope Jam observer | Rope Jam 11/11 Observer |

Tre tipi persistiti: membership, partner, details. Il tipo details prevede due pubblici, praticanti e observer, senza cambiare il DB.

## Elementi condivisi

- Identità Peony: logo, titolo evento, data, footer, contatto.
- Corpo HTML con header e blocchi modulari: associazione, partner, orario/descrizione, mappa, accesso, regolamento, pause, foto, contatti.
- Introduzione editabile con placeholders per titolo e data sempre aggiornati.
- Testo sanificato per essere copiato in HTML su Gmail. Nessun invio automatico.

## Provenienza

Ticket Tailor sincronizzato in tabella events: titolo, data, categoria, orario e descrizione quando presenti nel raw_payload.normalized, URL di prenotazione. I biglietti identificano il tipo observer.
Gestionale: associazione, partner, destinatari, storico.
Configurazione fissa: sede, metro, citofono, regole, modulo associativo IT/EN, contatti, vademecum, voucher.
Regola periodi: membershipPeriodFor con validità 31/12/2026 per le quote del primo periodo e poi annualità solari.

Non ricavare ore di apertura, pausa pranzo, materiali o prerequisiti da supposizioni: usare solo i dettagli realmente presenti su Ticket Tailor o note manuali deliberate.

## Variante per pubblico

- Rope Jam praticante: associazione, possibilità voucher 10 euro nuovi soci (set minimo quattro corde), vademecum, QR prima visita.
- Observer: non pratica, non richiede associazione, non riceve voucher; non richiedere un secondo pagamento all'ingresso.
- Aperi Bottom free: nessuna tessera.
- Workshop: informazioni complete, servizi pranzo, foto/video, materiale e prerequisiti solo se effettivamente disponibili.

## Conflitti negli esempi da non ereditare

1. Scadenza quota alterna 31/12/2026 e 31/12/2027 in email per eventi 2026; usare regola associativa, non testo storico.
2. KL Level 2+ riporta deadline 4 novembre ore 10:00 e 23:59; mostrare 48h senza inventare l'ora.
3. Observer Rope Jam indica pagamento 6 euro in loco; il nuovo flusso è pagato su Ticket Tailor.
4. Moduli IT e EN diversi negli esempi; configurazione studio distinta dalla scheda evento.
5. Alcuni allegati sono HTML Gmail minimale, non visual design HTML; uniformare tutti.

## Accettazione

- Segmentazione destinatari pratica/observer anche su Seleziona tutti.
- Orario e descrizione assenti da TT: non inventare, mostrare avviso di verifica.
- Rendering di titolo/data al momento dell'anteprima e del copia/incolla.
- Template persistenti personalizzabili senza sovrascrittura automatica; pulsante ripristino esplicito.
- Verifica CI Vitest/TypeScript e resa Gmail mobile/desktop prima del merge. Nessun invio reale durante i test.

## Aggiornamento: confronto con gli allegati EML

Le informative non devono essere un riassunto della descrizione Ticket Tailor. Il layout workshop riproduce in inglese la sequenza delle email Neck Rope / 3 Dimensions / KL Level 2+: intestazione, introduzione, Important at a glance, Event Schedule, Workshop Information, What to Bring, Prerequisites, Location con immagine, How to Access, Important Notes, Lunch and Facilities, Venue Rules, Photo / Video Policy, Association, Emergency Contact, firma e footer. Le sezioni evento senza dati verificati vengono omesse; orari di apertura e orari giornalieri vanno confermati prima della copia. Per la Rope Jam in italiano l'ordine deriva dai due esempi praticante/observer e non si includono blocchi workshop non pertinenti.

La lingua è un'impostazione evento ('auto', italiano o inglese), con automatico inglese per workshop; l'intero testo gestito e la formattazione delle date seguono la lingua selezionata. La descrizione pubblicata su Ticket Tailor si può includere letteralmente o escludere e sostituire con un testo specifico, perché potrebbe non essere nella lingua richiesta e potrebbe contenere informazioni di marketing anziché istruzioni pratiche.

Gli override puntuali vengono salvati in `gw_peony_email_settings` (migrazione 042); la sincronizzazione Ticket Tailor continua a essere l'origine di titolo, date e descrizione, non viene sovrascritta. I template associativi e partner rimangono separati. Le informative Kinbaku LuXuria continuano in inglese e seguono anch'esse le intestazioni degli allegati; la descrizione Ticket Tailor esplicitamente collegata viene mostrata sotto Workshop Information.
