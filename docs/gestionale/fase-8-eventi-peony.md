# Fase 8 — Gestionale unico Peony + Kinbaku LuXuria

## Decisioni approvate

- **Laura e Andrea (admin):** tutti gli eventi Peony Studio, partecipanti, comunicazioni e strumenti associativi; i workshop Kinbaku LuXuria mantengono anche i conti condivisi.
- **Ale (organizzatrice):** esclusivamente workshop Kinbaku LuXuria. Iscrizioni inserite da Ale, quote, pagamenti, spese e conti Peony/Ale. Nessun evento Peony generale.
- **Privacy:** anagrafica condivisa come riferimento; Ale vede solo i dati che ha personalmente inserito, mai gli altri dettagli anagrafici, biglietti Ticket Tailor o storico degli eventi Peony. Verifiche server-side obbligatorie.
- **Eventi Peony non LuXuria:** partecipanti e biglietti **solo** da Ticket Tailor. Nessuna aggiunta o modifica manuale di iscrizioni nel gestionale.
- **Contabilità Peony generale:** non prevista in questa fase. La divisione economica rimane solo sui workshop Kinbaku LuXuria.
- La pagina `/admin/ticket-tailor` **non si rimuove** finché sincronizzazione, verifiche associative e operazioni amministrative non sono migrate e testate.

## Prima implementazione

- Home `/gestione`: due sezioni admin, **Eventi Peony** e **Workshop Kinbaku LuXuria**. La sezione Peony mostra gli eventi Ticket Tailor il cui titolo non contiene `luxuria`, con numero di biglietti attivi.
- Ale continua a vedere solo la dashboard e i tab dei workshop LuXuria già esistenti.
- Dettaglio `/gestione/peony/[id]` disponibile solo agli admin: elenco partecipanti dai ticket emessi (non da prenotazioni gestionali); esclusione di biglietti void/cancelled/refunded, nessuna registrazione manuale.
- Presenza Peony salvata in `gw_peony_checkins`, indipendente dal campo `checked_in` di Ticket Tailor; una sincronizzazione non la sovrascrive. L'indicazione di Ticket Tailor resta visibile come valore di partenza.
- Stato associativo da `association_members` (ultima sincronizzazione), con la stessa funzione `deriveMembershipState` del vecchio Admin e il periodo della data evento. Solo informativo: i requisiti dipendono dal tipo di biglietto; osservatori esenti. Le verifiche live dei moduli Google e le validazioni manuali restano nella pagina Admin esistente.
- Collegamento alla scheda `gw_people` solo con corrispondenza email **univoca**. Nessuna nuova persona creata automaticamente da una visita alla pagina; nessun dato privato passato ad Ale.
- Testi email per evento salvati in `gw_peony_email_templates`; copia HTML formattato per Gmail e destinatari unici in Ccn; la spedizione **non** avviene automaticamente. Storico delle email dichiarate inviate in `gw_peony_email_sends`, con conferma esplicita.
- Le credenziali Google e Ticket Tailor sono ancora configurate nell'hosting esistente (Netlify). Le eventuali funzioni che le richiedono devono avere configurazione equivalente anche su Vercel; la consultazione dei biglietti già sincronizzati usa solo Supabase.

## Migrazione

Prima della pubblicazione applicare `supabase/migrations/029_gw_peony_event_ops.sql`. Le tre nuove tabelle hanno RLS attivo e nessun accesso anon/authenticated. Tutte le query passano dal server con `requireAdmin`.

## Verifiche prima della dismissione dell'Admin

- Verificare eventi presenti e biglietti in un evento che ha iscritti reali.
- Verificare accesso Laura/Andrea e 404 per Ale (anche chiamate dirette alle server actions).
- Verificare presenza manuale e successiva sincronizzazione Ticket Tailor.
- Verificare modello email e storico senza inviare messaggi reali.
- Spostare l'avvio della sincronizzazione ordini, biglietti e partecipanti da `/admin/ticket-tailor` al gestionale autenticato con PIN.
- Spostare la verifica socio live (Google IT/EN, libro soci, validazione e revoca) conservando una sola logica e senza dati sensibili per Ale.
- Integrare gestione note e abbinamento delle persone degli eventi TT, senza creare duplicati nell'anagrafica.
- Solo dopo questi controlli rimuovere la vecchia pagina Admin e il codice di accesso legacy.
