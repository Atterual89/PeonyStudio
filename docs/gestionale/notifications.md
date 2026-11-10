# Notifiche nuove iscrizioni e nuovi contatti di Alessandra

## Funzionamento

- Trigger PostgreSQL soltanto `AFTER INSERT` su `gw_bookings` (per operatrice `organizzatrice`) e `gw_ale_contacts`. Le modifiche e gli import idempotenti non generano avvisi.
- Ogni admin attivo riceve una propria riga di `gw_admin_notifications`, con `read_at` individuale.
- Campanella visibile solo nella sessione admin, aggiornata ogni 30 secondi.
- Toccando la notifica si apre la riga dell'iscrizione, espansa anche se fuori dal filtro corrente, oppure il contatto nel matching di Alessandra.
- Su ciascun browser gli admin possono abilitare o disabilitare le push e inviare una push di prova. Le notifiche push contengono soltanto titolo generico e collegamento al gestionale, non recapiti o dati fiscali.
- Il sistema funziona senza permesso push: la campanella resta sempre disponibile.

## Attivazione su Netlify

Applicare la migrazione `041_gw_ale_admin_notifications.sql` al database Peony e configurare **solo nel contesto server** le variabili Netlify:

```sh
# Eseguire una sola volta in un terminale con Node
node scripts/gestionale/generate-vapid.mjs
```

Copiarne l'output nelle variabili di ambiente Netlify: `GW_VAPID_PUBLIC_KEY`, `GW_VAPID_PRIVATE_KEY`, `GW_VAPID_SUBJECT`. **Non versionare le chiavi private nel repository**. Non cambiare VAPID dopo aver attivato dispositivi, altrimenti bisogna disattivare e riattivare le sottoscrizioni. Riavviare il deploy Netlify affinché le variabili siano disponibili alle Server Actions.

Da ciascun telefono: aprire `https://peonystudio.net/gestione`, entrare come admin, aprire **Notifiche → Attiva push**, autorizzare il browser e premere **Prova push**. Le push richiedono HTTPS, Service Worker e autorizzazione sul dispositivo. Su iPhone/iPad è richiesta l'app web aggiunta alla schermata Home; su Android Chrome supporta push anche via browser. La campanella non richiede installazione.

## Controlli

1. Inserire da Ale un'iscrizione in un workshop KL; verificare due record `ale_booking` (uno per admin) e avviso push su ogni dispositivo autorizzato.
2. Importare un contatto inedito: due record `ale_contact` con link alla relativa scheda nel matching.
3. Modificare iscrizione e contatto e reimportare lo stesso CSV: nessuna nuova notifica.
4. Segnare una notifica come letta con un admin: resta non letta per l'altro.
5. Revocare il permesso push sul browser e verificare che la campanella rimanga fruibile.

## Note tecniche

Le push usano VAPID / Web Push (`aes128gcm`) senza dipendenze npm. Gli endpoint sono accettati solo se HTTPS e associati a servizi push noti, per prevenire SSRF; ogni richiesta è autenticata come admin, i dati sono salvati solo tramite service role, con RLS attivo e permessi `anon` / `authenticated` revocati. La consegna Web Push è *best effort*: il servizio del browser può essere offline o rifiutare notifiche, senza invalidare l'inserimento di Ale. Gli avvisi della campanella invece sono persistenti.

La consegna delle push in sospeso viene avviata al termine delle creazioni di Ale; per importazioni molto grandi la funzione elabora fino a 200 notifiche per chiamata, lasciando le altre in coda per una successiva creazione. Gli admin possono sempre consultare tutte le notifiche nella campanella.
