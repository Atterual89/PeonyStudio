# Notifiche nuove iscrizioni e nuovi contatti di Alessandra

## Funzionamento

- Trigger PostgreSQL soltanto `AFTER INSERT` su `gw_bookings` (per operatrice `organizzatrice`) e `gw_ale_contacts`. Le modifiche e gli import idempotenti non generano avvisi.
- Ogni admin attivo riceve una propria riga di `gw_admin_notifications`, con `read_at` individuale.
- Campanella visibile solo nella sessione admin, aggiornata ogni 30 secondi.
- Toccando la notifica si apre la riga dell'iscrizione, espansa anche se fuori dal filtro corrente, oppure il contatto nel matching di Alessandra.
- Su ciascun browser gli admin possono abilitare o disabilitare le push e inviare una push di prova. Le notifiche push contengono soltanto titolo generico e collegamento al gestionale, non recapiti o dati fiscali.
- Il sistema funziona senza permesso push: la campanella resta sempre disponibile.

## Attivazione push senza configurare Netlify

Le chiavi VAPID sono state generate una sola volta e memorizzate in modo
**cifrato su Supabase Vault** (progetto `PeonyStudioWebSite`).
Il server Next.js recupera le chiavi con la RPC `gw_get_vapid_config`
autorizzata esclusivamente al ruolo `service_role`, già usato dal
gestionale. Il browser riceve soltanto la chiave pubblica.

**Non è necessario configurare variabili su Netlify e non è necessario
eseguire lo script locale.** Le eventuali variabili `GW_VAPID_*`
continuano a funzionare come override server-side, ma non servono.

Da ciascun telefono: aprire `https://peonystudio.net/gestione`,
entrare come admin, aprire **Notifiche → Attiva push**, autorizzare
il browser e premere **Prova push**.

Le push richiedono HTTPS, Service Worker e autorizzazione del browser.
Su iPhone/iPad bisogna aggiungere l'app web alla schermata Home;
su Android Chrome supporta Web Push dal browser. La campanella
non richiede alcuna installazione.

## Controlli

1. Inserire da Ale un'iscrizione in un workshop KL; verificare due record `ale_booking` (uno per admin) e avviso push su ogni dispositivo autorizzato.
2. Importare un contatto inedito: due record `ale_contact` con link alla relativa scheda nel matching.
3. Modificare iscrizione e contatto e reimportare lo stesso CSV: nessuna nuova notifica.
4. Segnare una notifica come letta con un admin: resta non letta per l'altro.
5. Revocare il permesso push sul browser e verificare che la campanella rimanga fruibile.

## Note tecniche

Le push usano VAPID / Web Push (`aes128gcm`) senza dipendenze npm. Gli endpoint sono accettati solo se HTTPS e associati a servizi push noti, per prevenire SSRF; ogni richiesta è autenticata come admin, i dati sono salvati solo tramite service role, con RLS attivo e permessi `anon` / `authenticated` revocati. La consegna Web Push è *best effort*: il servizio del browser può essere offline o rifiutare notifiche, senza invalidare l'inserimento di Ale. Gli avvisi della campanella invece sono persistenti.

La consegna delle push in sospeso viene avviata al termine delle creazioni di Ale; per importazioni molto grandi la funzione elabora fino a 200 notifiche per chiamata, lasciando le altre in coda per una successiva creazione. Gli admin possono sempre consultare tutte le notifiche nella campanella.
