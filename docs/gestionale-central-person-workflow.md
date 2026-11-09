# Anagrafica centrale: flusso unico Peony / Kinbaku LuXuria

## Contratto funzionale

```text
Ticket Tailor ─────────┐
                       ├──> gw_people (identità canonica)
Iscrizione Kinbaku KL ─┘          ├─ nickname e alias
                                  ├─ modulo/registro soci (acquisito)
                                  ├─ quota per annualità evento (rinnovabile)
                                  └─ partecipazioni e provenienza
```

- Conservare **sempre** nome/email inseriti nel biglietto o da Alessandra come dati dell'iscrizione.
- Non utilizzare il nome o email del compratore per sovrascrivere l'anagrafica: email del compratore può essere condivisa.
- Un biglietto Peony mostra la persona canonica solo quando esiste un collegamento esplicito, un riferimento associativo confermato univoco, o email *e* nome/nickname esatto univoci. In caso contrario, offre «Collega anagrafica».
- Scegliere una registrazione associativa Peony salva anche `person_id` quando la corrispondenza è *già confermata e univoca*. Il riferimento originale `member_row_id` resta intatto. Nessun inserimento massivo e nessuna unione automatica di omonimi.
- KL continua a puntare a `gw_booking_participants.person_id`. Non modificare pagamenti, fatture, ruoli di Alessandra o presenze.
- Entrambi usano `deriveMembershipState` come motore dello stato associativo, per la data dell'evento. Nessuna conferma della quota a partire dal solo nickname.
- La stessa componente `UnifiedParticipantCard` gestisce l'espansione in entrambi gli eventi. Le operazioni specifiche (quota workshop KL, observer, Ticket Tailor) rimangono proprie della fonte.
- Persone: la vista principale elenca i profili `gw_people`; le prove associative non collegate sono mostrate in «Da sistemare» / «Solo registro soci». La ricerca esplicita attraversa entrambe.

## Revisione dati senza scritture automatiche

Per ciascun biglietto non identificato:
1. Ricercare la persona usando nome e nickname, quindi email.
2. Selezionare la scheda già esistente e confermare.
3. Solo se davvero assente, creare una nuova scheda in Persone; controllare prima omonimi ed email condivise.
4. Ripetere la verifica di modulo permanente e quota per il periodo dell'evento.
5. Verificare la stessa persona in Peony, KL e Persone senza duplicazione di anagrafiche.

## Smoke test UI dopo il deploy

- Un biglietto Peony con identificativo confermato mostra lo stesso nome e stato della persona in KL.
- Un biglietto con email di acquisto condivisa **non** collega automaticamente la persona.
- I pulsanti «Cerca», «Collega», «Quota OK» aggiornano la scheda senza cambiare i dati originali del biglietto.
- Un observer RJ mantiene il grigio se non associato; un iscritto verificato mantiene verde.
- KL mantiene stato prenotazione/acconto/saldo indipendente dai pallini associativi.
- Entrambi gli elenchi usano lo stesso riquadro, con ricerca e ordinamento cronologico.
- In Persone, il filtro Anagrafiche non mostra 500+ righe del solo registro. «Da sistemare» le rende raggiungibili.
- Ricerca per alias storico restituisce la stessa scheda senza dedurre automaticamente l'identità ufficiale.
