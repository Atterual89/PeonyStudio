# Fase C — Verifica soci dalla pagina evento

Migrazione: `supabase/migrations/051_gw_person_sources_live.sql` (rollback: `051_gw_person_sources_live.down.sql`). Richiede la 050.

## Cosa cambia

**Con l'interruttore spento non cambia nulla di visibile.** Cambia solo che il registro `gw_person_sources` (Fase B) resta aggiornato da solo:

| Fonte | Come entra nel registro |
| --- | --- |
| Moduli Google | Il trigger della 045 ora registra anche la riga, compresi i casi dubbi che prima andavano persi |
| Iscrizioni di Ale | Trigger su `gw_booking_participants`: il registro rispecchia l'abbinamento. Solo un abbinamento **confermato** è un collegamento; quello automatico (nickname o nome uguale, di solito senza email) resta giallo con la proposta |
| Biglietti Ticket Tailor | Dopo ogni sincronizzazione e alla prima apertura dell'evento; trigger su intestatario e partner |
| Contatti dell'Excel di Ale | Trigger su `gw_ale_contacts`; chiusi da soli quando email **e** nome+cognome indicano una sola persona |
| Quote da email | Trigger sulle allocazioni (anche quando una quota viene tolta) |
| Quote "Quota ok" e moduli cartacei | Registrati prima di ogni calcolo (`gw_register_pending_member_rows`) |

Una decisione esplicita (confermato o rifiutato) non viene mai sovrascritta da un ricalcolo.

**Con l'interruttore acceso** (`GW_LINKED_MEMBERSHIP=1`), nelle pagine evento (workshop KL, scheda Partecipanti, e eventi Peony) compare in cima la sezione "Verifica soci":

- conteggi In regola · Non in regola · Da chiarire, filtro "Solo rossi e gialli";
- un pallino per persona con il motivo; il colore viene dai collegamenti salvati, non dal confronto di email e nomi;
- una riga gialla si apre sul posto: persona proposta con "È lei", ricerca nell'anagrafica, oppure "È una persona nuova" con nome, cognome ed email;
- "Copia email dei rossi".

La scelta usa i flussi già esistenti (abbinamento delle iscrizioni, intestatario e partner dei biglietti), quindi è la stessa che faresti dalla scheda dell'iscrizione o dal biglietto.

Ale non vede la sezione (solo admin).

## Come provarla

1. **Applica la 051** nell'SQL editor di Supabase (dopo la 050). In fondo esegue `gw_refresh_person_sources()` e restituisce quante righe ha registrato: biglietti, quote, contatti di Ale chiusi.
2. **Guarda il confronto** in *Verifiche → Confronto stato soci* (`/gestione/altro/soci/confronto`): per gli eventi degli ultimi 30 giorni e dei prossimi 60 elenca chi cambierebbe colore. Funziona anche con l'interruttore spento.
3. **Accendi l'interruttore solo in anteprima:** in Netlify → *Site configuration → Environment variables*, aggiungi `GW_LINKED_MEMBERSHIP` = `1` con contesto **Deploy previews**, poi riapri l'anteprima della PR.
4. Quando il confronto ti convince, aggiungi la stessa variabile per **Production** e ripubblica.

Per spegnere: togli la variabile e ripubblica. Il registro continua ad aggiornarsi.

## Rollback

`051_gw_person_sources_live.down.sql` rimette la funzione del trigger moduli com'era nella 045 e toglie trigger e funzioni nuove. Le righe del registro restano (si tolgono con il rollback della 050).

## Limiti noti

- **"Chiedi ad Ale nome e cognome"** non c'è: le notifiche del gestionale sono visibili solo agli admin, quindi Ale non le riceverebbe. Serve una casella notifiche anche per lei.
- **"Prepara richiesta"** non c'è nella sezione: c'è "Copia email dei rossi". La richiesta di iscrizione si prepara come oggi dai contatti della persona.
- **Partner indicati solo su Ticket Tailor** (senza abbinamento salvato nel gestionale) risultano gialli finché qualcuno non li collega.
- La pagina evento calcola ancora anche il vecchio stato socio (serve al resto della pagina): la velocità migliorerà quando il vecchio calcolo verrà tolto (Fase F).
