# Gestionale Peony — flusso admin essenziale

Revisione 9 novembre 2026. La navigazione quotidiana ha **tre aree**, con
azioni avanzate e impostazioni accessibili senza duplicare i flussi.

## Mappa delle schermate

| Da | Azione principale | Dove si conclude | Esito da verificare |
|---|---|---|---|
| Eventi | Apri evento Peony | Evento → Partecipanti | Ticket Tailor aggiorna solo i biglietti; ordine cronologico dall'acquisto |
| Eventi | Apri workshop KL | Workshop → Partecipanti | Lista cronologica, ricerca, stato socio, partner e presenze |
| Workshop KL | Apri riquadro partecipante | Nello stesso riquadro | Modifica, ricerca associativa e Quota OK, senza cambio pagina obbligato |
| Evento Peony | Apri biglietto | Nello stesso riquadro | Collega intestatario/partner, quota e dati ticket |
| Evento | Apri persona | Persone → Scheda | Identità ufficiale, nickname, quote e storico già collegati |
| Persone | Cerca anche per alias | Elenco Persone | Un risultato, senza duplicare la persona |
| Persone | + Nickname | Elenco | Salvataggio alias; non verifica l'identità né il pagamento |
| Persone | Collega o crea anagrafica | Elenco → Scheda | Ricerca e conferma esplicita; blocco duplicati |
| Persone | Quota OK | Elenco / Scheda | Scrittura persistente per l'annualità; aggiornamento stato |
| Verifiche | Abbinamenti da confermare | Stessa schermata | Non unire omonimi senza conferma |
| Verifiche | Pagamenti email | Stessa schermata | Abbinamento a quota annuale, niente duplicati |
| Verifiche | Aggiorna moduli Google | Stessa schermata | Registrazione permanente, anteprima; sicurezza sui dati parziali |
| Verifiche | Sincronizzazioni e manutenzione | Pannello avanzato | Azioni sporadiche nascoste nel flusso quotidiano |
| Verifiche | Altre impostazioni | Impostazioni | Email, storico operazioni, accesso |

## Stati associativi: contratto operativo

- **Verde**: iscrizione associativa accertata E quota dell'annualità dell'evento verificata; oppure libro soci che attesta una tessera vigente.
- **Giallo**: iscrizione già accertata, ma quota dell'annualità richiesta non verificata.
- **Rosso**: iscrizione non attestata da una fonte associativa; una quota manuale isolata non basta.
- **Grigio**: tessera non richiesta (observer, Aperi-Bottom/free); se la persona è già in regola, mantenere verde.

Il **modulo non scade**. Un record storico del libro soci verificato o scaduto
mantiene la prova di iscrizione, ma non il pagamento di una nuova annualità.

## Regole comuni per tutti i pulsanti

1. La ricerca accetta nome/cognome, nickname parziale e email. Le identità ufficiali non sono sovrascritte da nickname o nomi digitati in Ticket Tailor.
2. Salvataggio ed esito devono restare visibili nella stessa schermata; un errore non cancella la ricerca già effettuata.
3. Collegare una persona non conferma una quota; spuntare Quota OK non crea un modulo.
4. Un omonimo, email condivisa o un profilo già collegato richiede verifica e confronto, non unione automatica.
5. I dati fiscali sono visibili solo nelle schede autorizzate. L'organizzatrice non può accedere ai registri associativi, mentre l'admin non può svolgere le operazioni economiche riservate al suo ruolo.
6. Un aggiornamento Google parziale non deve cancellare registrazioni precedenti.
7. Liste di partecipanti: ordinare per acquisto Ticket Tailor, oppure per data/ora di creazione manuale. Un secondo criterio è applicato solo in caso di parità.

## Controlli manuali dopo il deploy

- Aprire **Eventi** e passare da Peony a KL. Verificare conteggi e accesso ad ogni scheda.
- Aprire un evento Peony, cercare il nominativo, espandere la scheda e verificare stato, collegamento, quota e invio email.
- Aprire un workshop KL 2027: una tessera 2026 scaduta deve mostrare **quota mancante**, non **modulo assente**.
- Verificare che il nome visualizzato come nickname non nasconda una tessera già collegata alla persona ufficiale.
- Su **Persone**, cercare nome, nickname e alias; collegare una registrazione esistente e verificare il refresh.
- Cercare un omonimo, provare a creare o collegare: nessuna unione automatica.
- Spuntare **Quota OK**, aggiornare la pagina e ricontrollare lo stato.
- Su **Verifiche**, controllare sincronizzazione Gmail, anteprima Google, revisioni quote e errori sicuri.
- Verificare i permessi accedendo con il ruolo di Alessandra (nessuna schermata di associazione o dati Peony riservati all'admin).
