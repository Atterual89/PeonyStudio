# FASE 7 — Tab Email e miglioramenti di usability

Stato: specifica preparatoria. Non ancora implementata nel gestionale. Nessuna migrazione da applicare al database reale.

## Obiettivo
Unificare tutte le comunicazioni nel tab Email, solo admin; il tab Partecipanti deve rimanere focalizzato su persone, iscrizioni e verifica dello stato associativo.

## Esperienza desiderata
1. Mostrare prima un elenco compatto delle quattro email, ciascuna con il contatore dei destinatari da contattare. Aprire soltanto la prima con lavoro da fare.
2. Passo 1 — A chi: nominativi proposti e contatore; Cambia apre le checkbox. Indicare chi non ha indirizzo, con collegamento alla scheda persona.
3. Passo 2 — Prepara e copia: pulsanti separati per indirizzi nel Ccn, oggetto, HTML nel corpo di Gmail; anteprima e modifica testo inizialmente chiuse. La conferma Copiato non deve suggerire che il messaggio sia stato inviato.
4. Passo 3 — Inviata?: registrazione manuale esplicita, con data modificabile, Annulla per 30 secondi e contatori aggiornati; consentire la registrazione anche senza copiare.
5. I Dettagli del workshop vanno compilati una sola volta e riutilizzati. Riquadro compatto chiuso di default, accessibile dai messaggi che richiedono dati mancanti. Sezioni: date e orari, presentazione, programma, prerequisiti, cosa portare, associazione e note extra.
6. Storico invii chiuso in fondo, con azione Segna non inviata e audit.

## Tipologie
- Richiesta di associazione: collegate al libro soci, non in regola nel periodo del workshop, mai contattate. Personalizzare la parte partner.
- Partner da conoscere: confermati (Prenotato a parola, Acconto, Saldato), in regola, ma senza partner. Mai proporre contemporaneamente a chi deve ricevere la richiesta di associazione.
- Sollecito: richieste associazione o partner irrisolte; separare i due sottogruppi e attribuire il numero progressivo per persona.
- Dettagli del workshop: solo Acconto/Saldato, non cancellate, non già contattate per questo tipo.

## Architettura e vincoli
- Dati workshop salvati una sola volta in gw_email_texts, con versione e storico.
- Impostazioni globali in gw_settings (email_defaults), pagina /gestione/altro/impostazioni-email, solo admin.
- Nuovi invii in gw_email_sends; richieste e solleciti associativi riutilizzano gw_membership_contacts.
- Migrazione 028 se la 027 resta l'ultima, con rollback .down.sql e notify finale; mai applicarla automaticamente.
- Layout HTML uniforme con tabelle, soli stili inline, larghezza massima 680 px, escaping di tutti i testi, date corrette tra mesi, omissione di sezioni vuote.
- Copia clipboard rich text (text/html e text/plain), fallback, immagini pubbliche con URL assoluti, non base64.
- Server actions e pagine riservate all'admin, 404 per organizzatrice.
- Spostare le azioni associazione dal tab Partecipanti solo dopo avere completato la nuova logica e verificato la conservazione dello storico.

## Usability in parallelo
- Partecipanti: tre filtri principali, altri filtri espandibili, ricerca per nome/nickname/email.
- Riepilogo workshop: numero di iscrizioni da verificare e di persone senza indirizzo, calcolati dai dati reali.
- Conti: riepilogo prima dei dettagli, calcoli intatti.

## Test prima del merge
Destinatari proposti e casi limite, partner aggiunto dopo la richiesta, modifica della validità associativa, storico pregresso, numerazione dei solleciti, rollback invii, escaping HTML, date, copia Gmail desktop e telefono, permessi admin/organizzatrice. Eseguire tsc, lint, build, test:gestionale e test:gestionale:sql.

## Modelli recuperati
I tre file originali sono stati recuperati dalle risorse del progetto e aggiunti a docs/gestionale/email/. I due asset del modello HTML sono disponibili in public/email/ (logo PNG e foto JPEG). Creati i generatori HTML condivisi in src/lib/gestionale/email/ e test statici in email-html.test.ts. Restano da implementare persistenza, gestione invii per partner/dettagli e interfaccia completa; non considerare ancora completata la FASE 7.
