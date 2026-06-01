# Peony Studio Site TODO

Nota di direzione: non ristrutturare l'architettura attuale del sito. Ogni sviluppo futuro deve rispettare la struttura esistente e procedere per estensioni conservative.

## 1. Internationalization

- Preparare il sito per italiano e inglese.
- Evitare copy hardcoded dentro i componenti dove possibile.
- Strutturare i contenuti per pagina, sezione e lingua.
- Ogni nuova pagina o sezione deve essere progettata con copy IT/EN in mente.

## 2. Teacher Section

- Estrarre i dettagli insegnanti dai contenuti Peony Studio attuali.
- Creare profili insegnante strutturati.
- Riutilizzare i profili dentro pagine workshop e pagine dettaglio evento.
- Insegnanti da includere per primi:
  - Kurogami / Shiawase
  - Riccardo Wildties / Red Sabbath
  - Peter Soptick / Sansei
  - ospiti futuri

## 3. Dashboard User

- Disegnare una dashboard personale per utenti registrati.
- Mostrare il prossimo corso/workshop a cui l'utente e iscritto.
- Mostrare informazioni pratiche normalmente inviate via email.
- Mostrare classi/workshop frequentati.
- Suggerire il prossimo step in base allo storico dell'utente.
- Mostrare notifiche quando vengono pubblicati nuovi eventi rilevanti.

## 4. Dashboard Admin

- Creare un'area admin con lista utenti abilitati alla dashboard.
- Consentire ricerca per nome/email.
- Consentire assegnazione manuale utenti a workshop/corsi.
- Consentire modifica manuale di classi/workshop frequentati.
- Valutare in seguito Ticket Tailor Orders API per import automatico partecipanti.

## 5. Ticket Tailor Orders API

- Gli eventi sono gia integrati.
- Punto aperto: capire se ordini/partecipanti possono essere importati automaticamente.
- Valutare API Ticket Tailor per:
  - orders
  - attendees
  - ticket types
  - cancelled/refunded orders
  - matching email con utenti registrati
- Mantenere assegnazione manuale admin come prima versione.

## 6. Contact Page

- Creare una pagina contatti con form.
- Il form deve inviare messaggi a peony.studio.turino@gmail.com.
- Campi:
  - nome
  - email
  - oggetto
  - messaggio
  - motivo del contatto
  - consenso privacy/GDPR

## 7. Shop Section

- Aggiungere una sezione shop/vetrina semplice.
- Partire con card prodotto, prezzo, disponibilita e CTA.
- Non costruire un e-commerce completo salvo necessita futura.
