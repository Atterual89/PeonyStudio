# Branch aperti su GitHub

Inventario in sola lettura, 11 novembre 2026 (Fase A). Nessun branch è stato eliminato.

Il repository ha 94 branch oltre a `main`. **92 sono già stati fusi in `main` tramite pull request** e possono essere eliminati senza perdere nulla: il loro contenuto è in `main`. Restano **2 pull request aperte**.

## Pull request aperte (da decidere)

| Branch | PR | Ultimo commit | Commit propri / dietro a `main` | Migrazioni | Consiglio |
| --- | --- | --- | --- | --- | --- |
| `feature/unified-people-membership-directory` | #51 "Unifica anagrafica e libro soci e dai precedenza alla prova email" | 2026-11-08 | 31 / 61 | `031_gw_email_manual_evidence_priority.sql` (numero già usato due volte in `main`), `035_gw_email_payment_over_manual.sql` (versione diversa da quella in `main`) | **Chiudere senza fondere.** È rimasta indietro di 61 commit, tocca gli stessi file dell'anagrafica che il refactor riscriverà e introdurrebbe un terzo file 031. |
| `fix/quote-causali-beneficiari-audit` | #88 "Quote: causali PayPal, beneficiari terzi e verifica pagamenti eventi" | 2026-11-10 | 11 / 24 | nessuna | **Valutare.** Riguarda il parser delle email di pagamento (causali PayPal, beneficiari terzi), non l'anagrafica. Se serve, va aggiornata su `main` e fusa prima della Fase B; altrimenti chiudere. |

## Branch già fusi (eliminabili)

Ordinati per data di fusione. Su GitHub: *Settings → General → Automatically delete head branches* evita che si accumulino di nuovo.

| Branch | PR | Fuso il |
| --- | --- | --- |
| `fix/personal-area-ticket-history` | #1 | 2026-09-30 |
| `fix/show-ticket-tailor-sync-errors` | #2 | 2026-09-30 |
| `fix/order-based-ticket-sync` | #3 | 2026-09-30 |
| `fix/remove-studio-payment-membership-info` | #4 | 2026-09-30 |
| `feat/home-membership-status` | #5 | 2026-09-30 |
| `feat/simplify-admin-home` | #6 | 2026-09-30 |
| `feat/admin-partner-row` | #7 | 2026-09-30 |
| `fix/membership-book-name-matching` | #8 | 2026-09-30 |
| `fix/import-both-registration-forms` | #9 | 2026-09-30 |
| `fix/membership-name-fallback` | #10 | 2026-09-30 |
| `fix/membership-sync-diagnostics` | #11 | 2026-09-30 |
| `fix/membership-self-healing-sync` | #12 | 2026-09-30 |
| `fix/membership-stale-records` | #13 | 2026-09-30 |
| `feature/admin-upload-members-book` | #14 | 2026-09-30 |
| `fix/supabase-jwt-clock-skew` | #15 | 2026-10-02 |
| `fix/partner-lookup-live-membership-sources` | #16 | 2026-10-02 |
| `feature/partner-membership-badge` | #17 | 2026-10-02 |
| `feature/manual-membership-validation` | #18 | 2026-10-02 |
| `fix/use-webpack-production-build` | #19 | 2026-10-02 |
| `feature/manual-validation-marker` | #20 | 2026-10-02 |
| `feat/gestionale-usability-email` | #21 | 2026-11-06 |
| `feat/gestionale-eventi-peony` | #22 | 2026-11-07 |
| `fix/gestionale-event-tabs` | #23 | 2026-11-07 |
| `fix/peony-roster-membership-partner-email` | #24 | 2026-11-07 |
| `feat/peony-gestionale-sync-ticket-tailor` | #25 | 2026-11-07 |
| `ux/compact-peony-cards-ale-dashboard` | #26 | 2026-11-07 |
| `fix/gestionale-workshop-membership-fallback` | #27 | 2026-11-07 |
| `ux/peony-compact-attendees-and-email` | #29 | 2026-11-07 |
| `feature/gestione-soci-quota-teamartist` | #30 | 2026-11-07 |
| `fix/peony-association-owner-and-form-sync` | #31 | 2026-11-07 |
| `feature/gestione-persone-unificata` | #32 | 2026-11-07 |
| `feature/peony-coppie-partner-anagrafica` | #33 | 2026-11-07 |
| `fix/peony-ricerca-soci-intestatario-duplicati` | #34 | 2026-11-07 |
| `fix/ticket-tailor-sync-batches-and-book-align-visibility` | #35 | 2026-11-07 |
| `fix/persist-member-name-links-and-refresh` | #36 | 2026-11-07 |
| `feature/ale-simple-entry-accounts-dashboard` | #37 | 2026-11-07 |
| `feat/actual-settlements-editable-and-carryovers` | #38 | 2026-11-08 |
| `fix/ale-registration-cards-focus-collapse` | #39 | 2026-11-08 |
| `fix/soci-hide-already-verified-matches` | #40 | 2026-11-08 |
| `fix/soci-partial-nickname-search-gaia-2027` | #41 | 2026-11-08 |
| `feat/association-email-verification` | #42 | 2026-11-08 |
| `fix/inline-gmail-sync` | #43 | 2026-11-08 |
| `fix/member-link-search-retry` | #44 | 2026-11-08 |
| `fix/manual-quota-state-refresh` | #45 | 2026-11-08 |
| `feat/gmail-sync-all-association-checks` | #46 | 2026-11-08 |
| `feature/anagrafica-condivisa-ale-email` | #47 | 2026-11-08 |
| `fix/gmail-oauth-session-bridge` | #48 | 2026-11-08 |
| `fix/quote-email-assignment-feedback-20261108` | #49 | 2026-11-08 |
| `fix/unified-payment-person-search-20261108` | #52 | 2026-11-08 |
| `fix/persone-quick-member-link-and-performance` | #53 | 2026-11-08 |
| `fix/member-search-complete-name-and-surname` | #54 | 2026-11-08 |
| `fix/member-identity-canonical-and-duplicate-period-ux` | #55 | 2026-11-08 |
| `fix/unified-directory-shared-membership-groups` | #57 | 2026-11-08 |
| `fix/couple-participant-editor` | #56 | 2026-11-08 |
| `fix/link-nickname-to-existing-member-profile` | #58 | 2026-11-08 |
| `fix/rope-jam-observer-ticket-roles` | #59 | 2026-11-08 |
| `ui/compact-membership-status-dots-free-aperibottom` | #60 | 2026-11-09 |
| `ui/quota-ok-checkbox-compact` | #61 | 2026-11-09 |
| `refactor/association-google-registration-email-quota` | #62 | 2026-11-09 |
| `feat/billing-directory-excel-alessandra` | #63 | 2026-11-09 |
| `fix/official-book-membership-status-20261109` | #64 | 2026-11-09 |
| `fix/peony-linked-identity-and-member-profile` | #65 | 2026-11-09 |
| `feat/actionable-admin-people-directory-20261109` | #66 | 2026-11-09 |
| `refactor/admin-workflows-simplified-20261109` | #67 | 2026-11-09 |
| `feat/unified-peony-kl-person-workflow-20261109` | #68 | 2026-11-09 |
| `fix/peony-kl-person-card-parity-20261109` | #69 | 2026-11-09 |
| `feat/ale-staged-directory-admin-manual-match-20261109` | #70 | 2026-11-09 |
| `feat/ale-workshop-participant-manual-match-20261109` | #71 | 2026-11-09 |
| `fix/ale-enrollment-search-imported-contacts-20261109` | #72 | 2026-11-09 |
| `feat/peony-modular-email-templates` | #73 | 2026-11-09 |
| `feat/ale-admin-push-notifications` | #74 | 2026-11-10 |
| `feat/vapid-supabase-vault` | #75 | 2026-11-10 |
| `fix/quota-settembre-validita-annosuccessivo` | #76 | 2026-11-10 |
| `fix/gestionale-anagrafiche-verifiche-loading` | #77 | 2026-11-10 |
| `fix/forms-payments-primary-remove-teamartist-sync` | #78 | 2026-11-10 |
| `fix/google-form-sync-unique-count` | #79 | 2026-11-10 |
| `feat/revisione-anagrafiche-prima-quote` | #80 | 2026-11-10 |
| `feat/central-identity-form-payments-audit-2024` | #81 | 2026-11-10 |
| `fix/association-payment-shared-email-identity` | #82 | 2026-11-10 |
| `fix/gmail-historical-from-2025-september` | #83 | 2026-11-10 |
| `feat/auto-anagrafica-da-moduli-quote` | #84 | 2026-11-10 |
| `fix/payment-count-unique-slots` | #85 | 2026-11-10 |
| `fix/audit-duplicate-label-historic-progress` | #86 | 2026-11-10 |
| `fix/quote-suggestions-show-form-from-central-person` | #87 | 2026-11-10 |
| `feat/payment-allocation-corrections-20261110` | #89 | 2026-11-10 |
| `feat/manage-membership-verification-20261110` | #90 | 2026-11-10 |
| `feat/payment-missing-form-review-20261110` | #91 | 2026-11-10 |
| `fix/form-check-type-netlify-20261110` | #92 | 2026-11-10 |
| `feat/actionable-google-form-duplicates-20261110` | #93 | 2026-11-10 |
| `fix/google-form-revisions-20261110` | #94 | 2026-11-10 |
| `fix/ale-workshop-linked-identity` | #95 | 2026-11-11 |
| `fix/ale-match-save-feedback` | #96 | 2026-11-11 |
