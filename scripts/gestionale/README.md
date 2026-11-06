# Script operatori del gestionale

Gli operatori del gestionale (`/gestione`) si gestiscono **solo da qui**: nel sito non c'è un'interfaccia per crearli o cambiarne il PIN.

## Prerequisiti

- Node.js 22.18 o successivo (verifica con `node -v`).
- Il file `.env.local` nella cartella del progetto deve contenere `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- La migrazione `supabase/migrations/010_gw_schema_v1.sql` deve essere già stata applicata.
- Usa **PowerShell** o il **Prompt dei comandi**. In Git Bash l'inserimento nascosto del PIN non funziona (servirebbe `winpty node ...`).

Apri il terminale nella cartella del progetto:

```powershell
cd "C:\Users\peony\Desktop\Peony Studio\peony-studio"
```

## Comandi

| Cosa fai | Comando |
|---|---|
| Crei un operatore o ne cambi il PIN | `npm.cmd run gw:set-pin -- Laura` |
| Disconnetti un operatore da tutti i dispositivi | `npm.cmd run gw:revoke-sessions -- Laura` |
| Togli tutti i blocchi di accesso | `npm.cmd run gw:unlock` |
| Vedi l'elenco degli operatori | `npm.cmd run gw:list-operators` |
| Cambi il nome di un operatore | `npm.cmd run gw:rename-operator -- "Vecchio" "Nuovo"` |
| Cambi il ruolo di un operatore | `npm.cmd run gw:set-role -- "Laura" admin` |

Il `--` prima del nome serve a npm per passare il nome allo script. I nomi con spazi vanno tra virgolette: `npm.cmd run gw:set-pin -- "Nome Cognome"`.

In alternativa puoi lanciare gli script direttamente con node:

```powershell
node --env-file=.env.local scripts/gestionale/set-pin.mjs Laura
```

In questo caso Node mostra un avviso `MODULE_TYPELESS_PACKAGE_JSON`: è innocuo. Gli script `npm.cmd run gw:*` lo nascondono.

## set-pin

```powershell
npm.cmd run gw:set-pin -- Laura
```

1. Se l'operatore non esiste lo crea; se esiste ne sostituisce il PIN. I nomi non distinguono maiuscole e minuscole: `laura` e `Laura` sono lo stesso operatore.
2. Ti chiede il PIN due volte. Mentre scrivi non compare nulla: è normale.
3. Rifiuta:
   - i PIN che non sono di 6 cifre;
   - i PIN banali: sei cifre uguali (`000000`, `777777`) o in sequenza (`123456`, `654321`, `012345`);
   - un PIN già usato da un altro operatore, perché all'accesso è il PIN da solo a identificare la persona.
4. Disconnette tutti i dispositivi dell'operatore: dovrà rientrare con il nuovo PIN.

Il PIN non va mai scritto come argomento del comando, così non finisce nella cronologia del terminale.

## revoke-sessions

```powershell
npm.cmd run gw:revoke-sessions -- Laura
```

Disconnette l'operatore da tutti i dispositivi senza cambiare il PIN. Utile se un telefono viene perso: in quel caso conviene però anche cambiare il PIN con `set-pin`.

## unlock

```powershell
npm.cmd run gw:unlock
```

Dopo troppi PIN sbagliati l'accesso si blocca:

- **dallo stesso dispositivo/rete**: dopo 5 errori, per 15 minuti; ogni blocco successivo dura il doppio (30 min, 1 h, 2 h…) fino a 24 ore. Un accesso riuscito azzera il conteggio;
- **per tutti**: dopo più di 30 errori in un'ora, da qualunque rete, nessuno può entrare per 1 ora. Chi è già dentro continua a lavorare.

`unlock` azzera tutti questi blocchi subito.

## rename-operator

```powershell
npm.cmd run gw:rename-operator -- "RedSabbath" "Ale"
```

Cambia il nome visualizzato di un operatore (es. quello mostrato dopo l'accesso: "Ciao, Ale"). Il PIN e le sessioni aperte non cambiano. Il vecchio nome non distingue maiuscole e minuscole; il nuovo non può essere già usato da un altro operatore. La modifica resta nello storico.

Richiede la migrazione `012_gw_correzioni_v2b.sql`.

## set-role

```powershell
npm.cmd run gw:set-role -- "Laura" admin
npm.cmd run gw:set-role -- "Ale" organizzatrice
```

Ruoli (D18):

- **admin**: vede e fa tutto.
- **organizzatrice**: vede la dashboard dei workshop e, nel workshop, solo i tab Iscrizioni, Conti e Info. Non vede anagrafica, libro soci, stato socio, Cerca e Persone.

I nuovi operatori creati con `set-pin` sono **organizzatrice** (privilegio minimo): per un nuovo admin lancia anche `set-role`. Il ruolo nuovo vale subito, anche sui dispositivi già collegati. La modifica resta nello storico.

Richiede la migrazione `013_gw_ruoli_pagamenti_v3.sql`.

## list-operators

```powershell
npm.cmd run gw:list-operators
```

Mostra per ogni operatore: nome, ruolo, stato, ultimo accesso, sessioni attive e data dell'ultimo cambio PIN.
