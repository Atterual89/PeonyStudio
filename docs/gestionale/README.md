# Gestionale workshop

Gestionale interno dei workshop LuXuria: iscrizioni, pagamenti, spese, divisione Peony / Ale, stato associativo dei partecipanti.

- **Dove:** `/gestione` sul sito (es. `https://<dominio>/gestione`). Fuori da `/admin`, con un proprio accesso a PIN. Non indicizzato (`noindex`, escluso da robots e sitemap), nessun link dal sito pubblico.
- **Chi lo usa:**
  - **admin** (Laura, Andrea): vede e fa tutto — partecipanti, anagrafica, libro soci, email, conti, storico completo.
  - **organizzatrice** (Ale): tab Iscrizioni, Conti e Info; vede le persone solo come le ha scritte lei, mai anagrafica né libro soci. Guida: [`guida-ale.md`](guida-ale.md).
- **Documenti:** decisioni in [`00-contesto.md`](00-contesto.md) (fonte di verità), revisioni in `revisione.md` e `revisione-ale.md`. La specifica originale (`specifica.md`) resta solo in locale (esclusa da git).

## Migrazioni

Cartella `supabase/migrations/`. Ognuna ha il suo rollback `<nome>.down.sql`. Tutte toccano solo oggetti `gw_` (eccezione: la 022 aggiunge righe `manual_override` ad `association_members`, convertendo le vecchie correzioni "in regola").

| # | File | Cosa fa |
|---|---|---|
| 010 | `010_gw_schema_v1.sql` | Tabelle, enum, RLS e permessi di base; operatori, sessioni, tentativi di accesso, storico. |
| 011 | `011_gw_functions_v2.sql` | Funzioni di workshop, persone e iscrizioni. |
| 012 | `012_gw_correzioni_v2b.sql` | Workshop collegati agli eventi Ticket Tailor, stati Acconto/Saldato, rinomina operatori. |
| 013 | `013_gw_ruoli_pagamenti_v3.sql` | Ruoli admin/organizzatrice, iscrizioni di Ale con abbinamento automatico, pagamenti con tipo. |
| 014 | `014_gw_correzioni_admin_v3b.sql` | Correzioni admin: campi vuoti completati dal libro soci, note dell'iscrizione. |
| 015 | `015_gw_quota_workshop_v3c.sql` | Il prezzo delle iscrizioni segue quello del workshop, salvo prezzo speciale. |
| 016 | `016_gw_soci_fonti_admin.sql` | Collegamento al libro soci con la stessa chiave della pagina admin (email). |
| 017 | `017_gw_riga_persona.sql` | Riga persona semplificata, conferma automatica degli abbinamenti. |
| 018 | `018_gw_consuntivo_v4.sql` | Spese, trasferimenti, riporti, consuntivo, note fiscali di Ale, export. |
| 019 | `019_gw_pagamenti_stato.sql` | Iscrizione con primo pagamento, stato che apre il pagamento. |
| 020 | `020_gw_eliminazioni.sql` | Eliminazione logica con "Annulla". |
| 021 | `021_gw_recap_economico.sql` | Recap economico della home in una sola lettura. |
| 022 | `022_gw_quota_ok.sql` | "Quota ok" condivisa con la pagina admin (righe `manual_override`). |
| 023 | `023_gw_richieste_associazione.sql` | Richieste di associazione e solleciti, altri nomi, email scritta da Ale. |
| 024 | `024_gw_correzioni_revisione.sql` | Correzioni della revisione: rimborso del pagato, stati del consuntivo, anteprima. |
| 025 | `025_gw_anteprima_moduli.sql` | "Incassato da" per ogni pagamento del box di testo. |
| 026 | `026_gw_data_pagamento_facoltativa.sql` | Data del pagamento facoltativa. |
| 027 | `027_gw_functions_v5.sql` | Presenze per iscrizione e storico filtrato per ruolo. |

**Come applicarle:** Supabase → progetto → **SQL Editor** → incolla il contenuto del file → **Run**, una alla volta e in ordine. Ogni migrazione controlla di essere applicata dopo quella giusta e si ferma con un messaggio se manca qualcosa. Per tornare indietro si esegue il `.down.sql`, partendo dall'ultima.

**Controllo (sola lettura):** query "Migrazioni applicate" e "Sicurezza" in fondo a questo file.

## Variabili d'ambiente

| Variabile | Dove | A cosa serve |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | locale + Netlify (c'è già) | Indirizzo del progetto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | locale + Netlify (c'è già) | Chiave del server. **Mai** con prefisso `NEXT_PUBLIC_`. |
| `GW_IP_HASH_SALT` | locale + **Netlify (da aggiungere)** | Sale per l'hash degli IP nei tentativi di accesso. Stringa casuale di almeno 16 caratteri, uguale in tutti gli ambienti in cui vuoi che i blocchi valgano. Senza, il login non funziona. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_RANGE`, `GOOGLE_MEMBERS_BOOK_RANGE` (e, se usati, `GOOGLE_ENGLISH_SHEET_*`) | locale + Netlify (ci sono già, servono alla pagina admin) | Lettura live del modulo e del libro soci per lo stato associativo. |

Per generare il sale in PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Su Netlify: **Site configuration → Environment variables → Add a variable**, poi un nuovo deploy perché la variabile venga letta.

## Script operatori (Windows)

Da PowerShell, nella cartella del progetto, con `.env.local` che contiene `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (in Git Bash il PIN nascosto non funziona). Dettagli in [`scripts/gestionale/README.md`](../../scripts/gestionale/README.md). **Questi comandi scrivono sul database reale.**

| Cosa fai | Comando |
|---|---|
| Crei un operatore o ne cambi il PIN (lo chiede nascosto, due volte) | `npm.cmd run gw:set-pin -- "Laura"` |
| Cambi il ruolo | `npm.cmd run gw:set-role -- "Laura" admin` (oppure `organizzatrice`) |
| Rinomini un operatore | `npm.cmd run gw:rename-operator -- "Vecchio" "Nuovo"` |
| Togli tutti i blocchi di accesso | `npm.cmd run gw:unlock` |
| Disconnetti un operatore da tutti i dispositivi | `npm.cmd run gw:revoke-sessions -- "Laura"` |
| Elenco operatori (ruolo, stato, ultimo accesso, sessioni) | `npm.cmd run gw:list-operators` |

Un operatore nuovo nasce **organizzatrice**: per un admin serve anche `gw:set-role`.

## Se un PIN viene compromesso

1. Cambia subito il PIN: `npm.cmd run gw:set-pin -- "<nome>"`. Disconnette anche tutti i dispositivi di quell'operatore.
2. Se il PIN era di un admin, controlla lo storico (`/gestione/altro/storico`, filtro per operatore) per vedere cosa è stato fatto.
3. Se c'è stato un tentativo di indovinare i PIN (troppi errori), i blocchi si tolgono da soli; per toglierli subito: `npm.cmd run gw:unlock`.
4. Telefono perso senza PIN compromesso: basta `npm.cmd run gw:revoke-sessions -- "<nome>"`; conviene comunque cambiare il PIN.

## Backup

Le tabelle `gw_` stanno nello stesso progetto Supabase del sito.

- **Backup automatici:** dipendono dal piano Supabase (Dashboard → **Database → Backups**). Nel piano Free non ci sono backup scaricabili dalla dashboard; dal piano Pro ci sono backup giornalieri (7 giorni). Verifica lì cosa è attivo sul progetto: da qui non è stato possibile controllarlo.
- **Esportazione manuale (sempre possibile):** Dashboard → **Table Editor** → tabella `gw_…` → **Export → CSV**, una tabella alla volta. Le più importanti: `gw_workshops`, `gw_bookings`, `gw_booking_participants`, `gw_payments`, `gw_expenses`, `gw_transfers`, `gw_carryovers`, `gw_people`, `gw_audit_log`.
- **Copia completa:** con la stringa di connessione (Dashboard → **Connect**) e `pg_dump` installato: `pg_dump "<stringa di connessione>" --table="public.gw_*" --file=gestionale.sql`.
- Per ogni workshop chiuso, l'Excel del tab Conti è anche una copia leggibile dei conti.

## Promemoria gennaio 2027

- **Libro soci:** il caricatore `src/lib/google/members-book.ts` legge la colonna dell'anno sociale corrente ("Anno sociale 2026"). Quando nel libro soci compare la colonna del 2027, aggiorna il caricatore perché legga quella del 2027 (e verifica la pagina admin).
- **Periodi associativi:** controlla `src/lib/association/membership-periods.ts` — primo periodo pagamenti dal 01/09/2025, validi fino al 31/12/2026; dal 2027 anno solare. Se l'associazione cambia regola, si cambia solo lì.

## Test

```powershell
npm.cmd run test:gestionale       # logica, ruoli, azioni (vitest)
npm.cmd run test:gestionale:sql   # migrazioni e funzioni gw_* su Postgres in memoria (PGlite)
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

I test non toccano mai il database reale. Il lint ha 2 errori già presenti nel sito (`src/app/admin/ticket-tailor/page.tsx`, `src/components/programs/ProgramsProgressPage.tsx`): non bloccano il build, perché `next build` (Next 16) non esegue il lint.

## Query di controllo (sola lettura)

Da incollare nel **SQL Editor** di Supabase. Non modificano nulla.

**Migrazioni applicate** — ogni riga deve dire `applicata`:

```sql
with f as (select proname, prosrc from pg_proc where pronamespace = 'public'::regnamespace),
c as (select table_name, column_name, is_nullable from information_schema.columns where table_schema = 'public')
select m.migrazione, case when m.ok then 'applicata' else 'MANCA' end as stato
from (values
  ('010_gw_schema_v1', to_regclass('public.gw_operators') is not null),
  ('011_gw_functions_v2', exists (select 1 from f where proname = 'gw_create_booking')),
  ('012_gw_correzioni_v2b', exists (select 1 from c where table_name = 'gw_workshops' and column_name = 'event_id')),
  ('013_gw_ruoli_pagamenti_v3', exists (select 1 from c where table_name = 'gw_operators' and column_name = 'role')),
  ('014_gw_correzioni_admin_v3b', exists (select 1 from f where proname = 'gw_fill_person_from_member')),
  ('015_gw_quota_workshop_v3c', exists (select 1 from f where proname = 'gw_sync_workshop_fee')),
  ('016_gw_soci_fonti_admin', exists (select 1 from c where table_name = 'gw_people' and column_name = 'membership_email')),
  ('017_gw_riga_persona', exists (select 1 from f where proname = 'gw_confirm_person_matches')),
  ('018_gw_consuntivo_v4', to_regtype('public.gw_expense_category') is not null),
  ('019_gw_pagamenti_stato', exists (select 1 from f where proname = 'gw_create_registration')),
  ('020_gw_eliminazioni', exists (select 1 from c where table_name = 'gw_bookings' and column_name = 'deleted_at')),
  ('021_gw_recap_economico', exists (select 1 from f where proname = 'gw_economic_overview')),
  ('022_gw_quota_ok', exists (select 1 from f where proname = 'gw_log_member_validation')),
  ('023_gw_richieste_associazione', to_regclass('public.gw_membership_contacts') is not null),
  ('024_gw_correzioni_revisione', exists (select 1 from f where proname = 'gw_refund_booking')),
  ('025_gw_anteprima_moduli', exists (select 1 from f where proname = 'gw_import_roster' and prosrc like '%v_payment->>''received_by''%')),
  ('026_gw_data_pagamento_facoltativa', exists (select 1 from c where table_name = 'gw_payments' and column_name = 'paid_on' and is_nullable = 'YES')),
  ('027_gw_functions_v5', exists (select 1 from c where table_name = 'gw_bookings' and column_name = 'present'))
) as m(migrazione, ok)
order by 1;
```

**Sicurezza** — la colonna `problemi` deve essere vuota in ogni riga:

```sql
select 'tabelle gw_ senza RLS' as controllo,
       (select string_agg(relname, ', ') from pg_class
         where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'gw\_%' and not relrowsecurity) as problemi
union all
select 'policy sulle tabelle gw_',
       (select string_agg(tablename || '.' || policyname, ', ') from pg_policies where schemaname = 'public' and tablename like 'gw\_%')
union all
select 'tabelle gw_ leggibili o scrivibili da anon/authenticated',
       (select string_agg(relname, ', ') from pg_class
         where relnamespace = 'public'::regnamespace and relkind in ('r', 'S') and relname like 'gw\_%'
           and (has_table_privilege('anon', oid, 'select,insert,update,delete')
                or has_table_privilege('authenticated', oid, 'select,insert,update,delete')))
union all
select 'funzioni gw_ eseguibili da public/anon/authenticated',
       (select string_agg(p.oid::regprocedure::text, ', ') from pg_proc p
         where p.pronamespace = 'public'::regnamespace and p.proname like 'gw\_%'
           and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
union all
select 'association_members: RLS',
       (select case when relrowsecurity then null else 'RLS SPENTA' end from pg_class where oid = 'public.association_members'::regclass)
union all
select 'association_members: privilegi di anon/authenticated',
       (select string_agg(r || ':' || p, ', ') from unnest(array['anon', 'authenticated']) r,
               unnest(array['select', 'insert', 'update', 'delete', 'truncate']) p
         where has_table_privilege(r, 'public.association_members', p))
union all
select 'association_members: policy (informativo)',
       (select string_agg(policyname, ', ') from pg_policies where schemaname = 'public' and tablename = 'association_members');
```

**Workshop non collegati a Ticket Tailor** (es. quello di prova):

```sql
select id, name, starts_on, created_at from gw_workshops where event_id is null and deleted_at is null;
```

Si eliminano dal tab Info del workshop ("Elimina workshop", solo admin).
