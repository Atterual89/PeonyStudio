# Collegamento Gmail per la verifica quote Peony

Il gestionale legge solo la casella `peony.studio.turin@gmail.com` e solo dopo che un amministratore ha autorizzato l'accesso. La connessione Gmail usata dentro ChatGPT **non** dà accesso automaticamente al sito.

## Preparazione su Google Cloud (una tantum)

1. Accedi alla [Google Cloud Console](https://console.cloud.google.com/) con l'account proprietario.
2. Seleziona o crea un progetto, abilita **Gmail API**.
3. In **Google Auth Platform**, configura branding/consenso OAuth per uso privato dell'associazione.
4. Crea un **client OAuth 2.0 di tipo applicazione web** con redirect URI esattamente uguale all'indirizzo effettivo del sito più `/api/gestione/gmail/callback` (es. `https://peonystudio.net/api/gestione/gmail/callback` se quello è l'host del gestionale).
5. Nelle variabili protette dell'**hosting effettivo** (non nelle variabili `NEXT_PUBLIC_*`) configura:
   - `GMAIL_PAYMENTS_CLIENT_ID`: ID del client web Google.
   - `GMAIL_PAYMENTS_CLIENT_SECRET`: segreto del client web Google.
   - `GMAIL_PAYMENTS_REDIRECT_URI`: URI di callback configurato al punto 4.
   - `GMAIL_PAYMENTS_TOKEN_KEY`: stringa Base64 di 32 byte casuali per cifrare il refresh token; generabile localmente con `openssl rand -base64 32`.
6. Pubblica la configurazione con un nuovo deploy. Con PIN amministratore: apri **Quote associative → Collega Gmail Peony Studio**, scegli **peony.studio.turin@gmail.com** e approva il solo permesso Gmail di lettura.

**Non incollare token, client secret o chiavi nella chat, in GitHub, in issue o in log.**

Google può richiedere la verifica OAuth per l'ambito `gmail.readonly` (ambito soggetto a restrizioni). Un'app con consenso *Testing* per utenti esterni rilascia normalmente refresh token che scadono dopo **7 giorni**; per un uso continuativo valutare le opzioni di pubblicazione e le eccezioni per uso personale/ristretto previste da Google.

Documentazione Google: https://developers.google.com/identity/protocols/oauth2/ e https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification

## Protezione dati e controllo

- Solo `admin` può iniziare OAuth, sincronizzare email, leggere notifiche di pagamento e confermare abbinamenti.
- I token OAuth sono cifrati sul server con AES-256-GCM e custoditi in `gw_gmail_connections`, tabella senza accesso pubblico; nessun token è inviato al browser dopo il callback.
- Non sono archiviate intere email, allegati o la cronologia generale: soltanto ID Gmail, dati di pagamento estratti e stato di revisione.
- Gli importi di 15 / 30 / 45 euro e i netti PayPal sono **candidati**, non conferme automatiche. Stripe è escluso.
- Il primo import inizia dalla data scelta dall'admin. Le scansioni successive usano checkpoint persistenti, con sovrapposizione di sicurezza.
- Non effettuare il primo import prima di aver verificato una data ragionevole e la connessione corretta.
