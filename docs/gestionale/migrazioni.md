# Registro migrazioni

Stato al 11 novembre 2026 (Fase A). Le migrazioni si applicano a mano dall'SQL editor di Supabase, in ordine di nome file. **Nessun file esistente va rinominato o modificato:** molti sono già applicati in produzione.

## Numeri duplicati

Otto numeri sono usati da due file ciascuno. Nessuna coppia dipende dall'altra (nessuno dei due file crea tabelle o funzioni usate dall'altro), quindi l'ordine dentro la coppia è indifferente. L'ordine alfabetico del nome file resta quello di riferimento.

| Numero | File A | File B |
| --- | --- | --- |
| 029 | `029_gw_association_payment_emails.sql` | `029_gw_peony_event_ops.sql` |
| 030 | `030_gw_gmail_oauth_connection.sql` | `030_gw_peony_email_kinds.sql` |
| 031 | `031_gw_explicit_official_member_link.sql` | `031_gw_peony_booking_partners.sql` |
| 032 | `032_gw_keep_explicit_nominal_links.sql` | `032_gw_peony_booking_holders.sql` |
| 041 | `041_gw_ale_admin_notifications.sql` | `041_gw_workshop_details_reminders.sql` |
| 042 | `042_gw_peony_email_settings.sql` | `042_gw_vapid_vault.sql` |
| 044 | `044_gmail_historical_sync_source.sql` | `044_gw_payment_corrections.sql` |
| 045 | `045_gw_auto_person_from_google_forms.sql` | `045_gw_membership_verification_review.sql` |

I duplicati 046 e 047 sono stati risolti l'11 novembre rinominando i file in `048_repair_email_payment_allocation.sql` e `049_reconcile_payment_provider_reference.sql`. Se in produzione erano già stati applicati con il vecchio nome, **non vanno riapplicati**.

## Elenco completo

Legenda: **Sito** = scrive su tabelle del sito (non `gw_`) o vi aggiunge trigger. **Down** = esiste il file `.down.sql` di rollback.

| File | Cosa fa | Crea / modifica | Sito | Down |
| --- | --- | --- | --- | --- |
| 002 enable_personal_area_rls | RLS area personale | policy su tabelle del sito | sì (sito) | no |
| 003 fix_personal_area_auth_claim | Claim auth area personale | policy | sì (sito) | no |
| 004 create_association_members | Tabella libro soci | `association_members` | sì (sito) | no |
| 005 add_official_members_book_fields | Campi libro ufficiale | `association_members` | sì (sito) | no |
| 007 add_partner_to_enrollments | Partner nelle iscrizioni | `user_event_enrollments` | sì (sito) | no |
| 008 add_partner_source_to_enrollments | Origine partner | `user_event_enrollments` | sì (sito) | no |
| 009 add_checkin_audit_fields | Audit check-in | `event_participants`, `ticket_tailor_issued_tickets` | sì (sito) | no |
| 010 gw_schema_v1 | Schema base gestionale | tabelle `gw_*` | no | sì |
| 011 gw_functions_v2 | Funzioni workshop, persone, iscrizioni | funzioni | no | sì |
| 012 gw_correzioni_v2b | Correzioni D14–D17 | funzioni | no | sì |
| 013 gw_ruoli_pagamenti_v3 | Ruoli, iscrizioni di Ale, pagamenti | tabelle + funzioni | no | sì |
| 014 gw_correzioni_admin_v3b | Correzioni 3b | funzioni | no | sì |
| 015 gw_quota_workshop_v3c | Quota che segue il workshop | funzioni | no | sì |
| 016 gw_soci_fonti_admin | Stato socio dalle fonti admin | `gw_people.membership_email` | no | sì |
| 017 gw_riga_persona | Riga persona semplificata | funzioni | no | sì |
| 018 gw_consuntivo_v4 | Consuntivo e conguagli | funzioni | no | sì |
| 019 gw_pagamenti_stato | Stato pagamenti | funzioni | no | sì |
| 020 gw_eliminazioni | Eliminazioni (D22) | colonne `deleted_at` + funzioni | no | sì |
| 021 gw_recap_economico | Recap economico home | funzioni | no | sì |
| 022 gw_quota_ok | "Quota ok" condivisa col sito | funzioni | **sì: scrive `association_members`** | sì |
| 023 gw_richieste_associazione | Richieste di associazione, alias | `gw_membership_contacts`, `gw_person_aliases` | no | sì |
| 024 gw_correzioni_revisione | Correzioni revisione 4e | funzioni | no | sì |
| 025 gw_anteprima_moduli | Anteprima box di testo | funzioni | no | sì |
| 026 gw_data_pagamento_facoltativa | Data pagamento facoltativa | `gw_payments` | no | sì |
| 027 gw_functions_v5 | Presenze e storico | funzioni | no | sì |
| 028 gw_email | Email workshop | `gw_email_*`, `gw_settings` | no | sì |
| 029 gw_association_payment_emails | Quote da notifiche Gmail | `gw_association_payment_*`, `gw_payment_sync_state` | **sì: scrive `association_members`** | no |
| 029 gw_peony_event_ops | Eventi Peony da Ticket Tailor | `gw_peony_checkins`, `gw_peony_email_*` | no | no |
| 030 gw_gmail_oauth_connection | Connessione Gmail OAuth | `gw_gmail_connections` | no | no |
| 030 gw_peony_email_kinds | Tre modelli email per evento | `gw_peony_email_kinds` | no | no |
| 031 gw_explicit_official_member_link | Collegamento esplicito socio con nickname | funzione | no | no |
| 031 gw_peony_booking_partners | Partner sulla prenotazione TT | `gw_peony_booking_partners` | no | no |
| 032 gw_keep_explicit_nominal_links | Non perdere i collegamenti confermati | `gw_people` + trigger | no | no |
| 032 gw_peony_booking_holders | Intestatario TT → persona/socio | `gw_peony_booking_holders` | no | no |
| 033 gw_name_only_membership_link | Collegamento soci senza email | `gw_people.membership_name_key` | no | no |
| 034 gw_update_transfer_actual | Correzione trasferimenti | funzione | no | no |
| 035 gw_email_payment_over_manual | Quota email prevale su spunta manuale | funzione | **sì: scrive `association_members`** | no |
| 036 gw_update_entered_participant | Correzione nome/email inseriti da Ale | funzione | no | no |
| 037 gw_backfill_ticket_type_names | Nomi tipo biglietto | dati | no | no |
| 038 gw_billing_directory | Anagrafica fiscale (legacy) | `gw_billing_profiles`, `gw_billing_import_reviews` | no | no |
| 039 gw_ale_contacts_admin_matching | Contatti Excel di Ale + abbinamento admin | `gw_ale_contacts`, `gw_ale_contact_match_audit` | no | no |
| 040 gw_organizer_workshop_person_match | Abbinamento persone nelle iscrizioni di Ale | funzioni | no | no |
| 041 gw_ale_admin_notifications | Notifiche agli admin | `gw_admin_notifications`, `gw_admin_push_subscriptions` | no | no |
| 041 gw_workshop_details_reminders | Numerazione promemoria | `gw_email_sends` | no | no |
| 042 gw_peony_email_settings | Lingua e logistica email evento | `gw_peony_email_settings` | no | no |
| 042 gw_vapid_vault | Chiavi VAPID nel Vault | funzione | no | no |
| 043 membership_september_renewal | Regola 1 settembre per le quote | funzione | **sì: scrive `association_members`** | no |
| 044 gmail_historical_sync_source | Analisi storica Gmail dal 2024 | `gw_payment_sync_state` | no | no |
| 044 gw_payment_corrections | Correzioni quote da email | `gw_association_payment_corrections` | **sì: aggiorna e cancella `association_members`** | no |
| 045 gw_auto_person_from_google_forms | Crea persone dai moduli Google | funzioni | **sì: trigger su `association_members`** | no |
| 045 gw_membership_verification_review | Revoca di una verifica | `gw_membership_verification_corrections` | **sì: aggiorna `association_members`** | no |
| 046 gw_google_form_duplicate_consolidation | Consolida copie identiche dei moduli | `gw_google_form_duplicate_archive` | **sì: cancella `association_members`** | no |
| 047 gw_google_form_revision_consolidation | Conserva l'ultima versione del modulo | funzione | **sì: cancella `association_members`** | no |
| 048 repair_email_payment_allocation | Riconcilia una verifica email esistente | funzione | no | no |
| 049 reconcile_payment_provider_reference | Riconcilia riferimento del provider | funzione (legge `association_members`) | no | no |
| 050 gw_person_sources | Fase B: registro unico dei collegamenti fonte → persona, `gw_norm_email`, backfill | `gw_person_sources` + funzioni | no (legge soltanto) | sì |
| 051 gw_person_sources_live | Fase C: registro sempre aggiornato (trigger su tabelle `gw_`), biglietti TT, contatti di Ale, decisioni admin | funzioni + trigger su tabelle `gw_`; nuovo corpo di `gw_google_form_person_trigger` | no (il trigger su `association_members` della 045 resta, cambia solo la funzione `gw_` che chiama) | sì |

## Migrazioni che scrivono su tabelle del sito

Contrastano con la decisione D11 di `00-contesto.md` ("il gestionale non scrive mai su `association_members`"):

- **022** inserisce le righe "Quota ok".
- **029, 035, 043** inseriscono e aggiornano righe `manual_override` alla conferma di una quota da email.
- **044** aggiorna e cancella righe nelle correzioni quote.
- **045 (auto_person)** aggiunge il trigger `gw_create_google_form_person` su `association_members`.
- **045 (verification_review)** aggiorna righe nella revoca di una verifica.
- **046, 047** cancellano righe duplicate dei moduli (con archivio in `gw_google_form_duplicate_archive` per la 046).

Il refactor dell'anagrafica (fasi B–D dell'audit) sposterà queste scritture su tabelle `gw_`.

## Regole da qui in avanti

1. La prossima migrazione è la **052**. Prima di crearne una, controlla questo file e il branch `main`: un numero si usa una volta sola.
2. Ogni migrazione ha il suo `<nome>.down.sql` e entrambi terminano con `notify pgrst, 'reload schema';`.
3. Solo migrazioni additive sulle tabelle del sito; nessuna nuova scrittura su `association_members`.
4. Dopo averla applicata in produzione, aggiungi una riga a questo registro.
