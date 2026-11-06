# Gestionale Workshop — Analisi del repository (Fase 0)

Data: 2026-10-27 · Branch analizzato: `main` (commit `235a66c`) · Nessun file modificato oltre a questo.

---

## 1. Next.js

- `package.json`: `next` **16.2.6**, `react` 19.2.4, Tailwind 4, TypeScript 5. Build: `next build --webpack`.
- **App Router**, con cartella `src/` (`src/app`). Nessun Pages Router.
- Nessun gruppo di rotte `(…)`: tutte le pagine sono figlie dirette di `src/app/layout.tsx`.
- Rotte esistenti: `/`, `/admin/ticket-tailor` (+ `/advanced`), `/api/admin/*`, `/api/dev/auth-link`, `/api/supabase/health`, `/api/ticket-tailor/products`, `/area-personale` (+ `/login`), `/auth/callback`, `/calendario`, `/come-iniziare`, `/dashboard`, `/eventi/[slug]`, `/peony`, `/percorsi/*`, `/pratica`, `/programmi`, `/shop`, `/workshop`, `/workshop/[slug]`, `/workshop-exploration`.
- Nota Next 16: `middleware.ts` è **deprecato e rinominato `proxy.ts`** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`); il Proxy gira di default sul runtime **Node.js**.

**Conclusione:** `/gestione` non esiste ed è libera; si crea `src/app/gestione/` con layout proprio.

## 2. Layout radice

- `src/app/layout.tsx` monta per **tutte** le pagine: `LanguageProvider`, `ScrollProgress`, un wrapper `<div className="pb-16 md:pb-0">`, `GlobalFooter` (`src/components/layout/GlobalFooter.tsx`) e `BottomNav` (`src/components/layout/BottomNav.tsx`).
- L'header (`SiteHeader`) **non** è nel layout radice: è importato pagina per pagina → su `/gestione` non compare.
- `GlobalFooter` ha già un'uscita anticipata: `if (pathname.startsWith("/area-personale")) return null;`.

**Modifica minima proposta (Fase 1):** stessa riga di guardia in `BottomNav.tsx` e `GlobalFooter.tsx`: `if (pathname.startsWith("/gestione")) return null;` (in `BottomNav` va messa dopo gli hook). `ScrollProgress` è una barra sottile: si può lasciare o escludere allo stesso modo. Il `pb-16` del wrapper resta e torna utile per la nav del gestionale. Nessuna alternativa a costo minore (spostare le pagine in un gruppo di rotte toccherebbe tutto il sito).

## 3. Middleware / Proxy

- Nessun `middleware.ts` né `proxy.ts` (né in radice né in `src/`).

**Conclusione:** oggi nulla intercetta `/gestione`. Il redirect "cookie mancante → login" va fatto in un nuovo `src/proxy.ts` (non `middleware.ts`, deprecato) con `matcher: ['/gestione/:path*']`, escludendo `/gestione/login`. Il matcher limita il Proxy al solo gestionale: il resto del sito non è toccato.

## 4. Area admin esistente

- Pagine: `src/app/admin/ticket-tailor/page.tsx`, `src/app/admin/ticket-tailor/advanced/page.tsx` (client component, **pagine non protette**: l'operatore inserisce un segreto in un campo).
- API: `src/app/api/admin/**/route.ts` protette da header `x-admin-sync-secret` confrontato con `ADMIN_SYNC_SECRET` (segreto condiviso, nessun ruolo).
- Nel DB esiste `public.is_admin()` (`supabase/migrations/002_enable_personal_area_rls.sql`) basata su `profiles.role = 'admin'`, usata dalle policy RLS delle tabelle del sito.
- L'area personale usa Supabase Auth (OTP/magic link, `src/app/auth/callback/route.ts`, `src/lib/personal-area.ts`).

**Conclusione:** `/gestione` non condivide prefisso, cookie né controllo d'accesso con `/admin` o `/area-personale`. Nessun conflitto.

## 5. Supabase

| File | Tipo | Variabili |
|---|---|---|
| `src/lib/supabase/client.ts` | browser (`@supabase/ssr`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `src/lib/supabase/server.ts` | server con cookie, `import "server-only"` | stesse (anon) |
| `src/lib/supabase/admin.ts` | **service role**, `import "server-only"`, `createSupabaseAdminClient()` | `NEXT_PUBLIC_SUPABASE_URL`, **`SUPABASE_SERVICE_ROLE_KEY`** |
| `src/lib/supabase/retry.ts` | retry per errore "JWT issued at future" (PGRST303) | — |

- La service role key è usata solo lato server: tutte le route `src/app/api/admin/**`, `src/app/api/dev/auth-link`, `src/app/api/supabase/health`, `src/lib/personal-area.ts`.
- `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (utilizzabili dagli script `node --env-file=.env.local`). `NEXT_PUBLIC_SUPABASE_ANON_KEY` **non** è in `.env.local` (presumibilmente solo su Netlify): non serve al gestionale.
- `server-only` non è installato come pacchetto ma Next lo risolve internamente (già usato e la build passa).

**Conclusione:** l'architettura 4.1 è compatibile. Il gestionale può avere un proprio `src/lib/gestionale/server/db.ts` (`import 'server-only'`) che crea il client service role con le stesse variabili, oppure riusare `createSupabaseAdminClient()`. Conviene un client proprio per non dipendere da file del sito.

## 6. Migrazioni

- Cartella: `supabase/migrations/`.
- Nomi: `NNN_descrizione_snake_case.sql` a 3 cifre (`002`, `003`, `004`, `005`, `007`, `008`, `009`; mancano `001` e `006`). Nessun file di rollback.
- Nessun `supabase/config.toml`, nessuna CLI Supabase nelle dipendenze, nessuno script npm → le migrazioni sono applicate **a mano dal SQL editor** di Supabase.
- Il commit `4039797` (validazione manuale associati) non ha migrazione: riusa `association_members` con `source = 'manual_override'`.

**Conclusione:** nuove migrazioni da `010_gw_….sql` con accanto `010_gw_….down.sql`, da incollare nel SQL editor.

## 7. Tabelle esistenti rilevanti

(dedotte da migrazioni e query nel codice; lo schema iniziale `001` non è nel repo)

- `profiles` — utenti del sito (id = `auth.uid()`, `email`, `first_name`, …, `role`).
- `events` — eventi sincronizzati da Ticket Tailor.
- `ticket_tailor_orders`, `ticket_tailor_issued_tickets` — ordini e biglietti TT.
- `event_participants` — partecipanti agli eventi TT (`first_name`, `last_name`, `email`, `association_status`, `association_expires_at`, `checked_in`, `partner_status`, `notes_admin`).
- `user_event_enrollments` — iscrizioni dell'area personale, con `partner_name`, `partner_email`, `partner_source`.
- **`association_members`** — anagrafica associati UR Expression APS: `first_name`, `last_name`, `email`, `contact`, `fiscal_code`, `birth_date`, `membership_card_number`, `membership_status`, `membership_starts_at`, `membership_expires_at`, `source` (`google_sheet`, libro soci, `manual_override`), `notes_admin`. Popolata da Google Sheet (`src/lib/association/members-sync.ts`) e da upload del libro soci (`src/lib/association/members-book-sync.ts`). Logica di stato in `src/lib/association/membership-state.ts`.

**Conclusione:** `association_members` è l'elenco riutilizzabile per suggerire/precompilare l'anagrafica `gw_people` (nome, cognome, email) e per lo stato associativo per anno (Fase 5). Va letta in sola lettura. Nota fuori ambito: nelle migrazioni del repo `association_members` non ha RLS attivata — da verificare sul DB (non toccata).

## 8. TeamArtist

- Ricerca case-insensitive di `teamartist` / `team-artist` / `team artist` in `src/`, `scripts/`, `supabase/`, `package.json`: **nessun risultato**. Compare solo nei documenti `docs/gestionale/*`.

**Conclusione:** nessuna integrazione TeamArtist nel codice. Lo stato associativo oggi arriva da Google Sheet + libro soci (`association_members`).

## 9. Netlify

- Nessun `netlify.toml`, nessun `.nvmrc`/`.node-version`, nessun campo `engines`, nessun `@netlify/plugin-nextjs` nelle dipendenze → build e runtime configurati dalla UI Netlify con l'adapter Next automatico (OpenNext). Node locale: v24.15.0.
- Route handler e server action girano come funzioni Node (nessun file del progetto imposta `runtime = 'edge'`); il Proxy di Next 16 è Node di default.
- `crypto.scrypt`, `randomBytes`, `timingSafeEqual`, `createHash` sono disponibili in ogni Node ≥ 18.

**Conclusione:** compatibile. Da verificare nella UI Netlify che la versione Node sia ≥ 20 (non ricavabile dal repo). IP del client: su Netlify leggere `x-nf-client-connection-ip`, poi `x-forwarded-for` come ripiego.

## 10. Test

- Nessun test runner (niente jest/vitest/playwright in `package.json` o `node_modules/.bin`), nessuno script `test`.

**Conclusione:** si aggiunge `vitest` come devDependency (pre-approvato) e uno script `test` in Fase 1.

## 11. UI riutilizzabile

- Componenti generici: quasi nessuno. `src/components/ui/IconTooltip.tsx` è l'unico in `ui/`. Niente Button/Input/Card/Modal/Toast condivisi: il sito usa classi Tailwind inline.
- Icone: `lucide-react` già installato. Animazioni: `framer-motion`.
- Font (`src/app/layout.tsx`, `next/font/google`): **Cormorant Garamond** (`--font-serif`) e **DM Sans** (`--font-sans`). **Lora non è caricato.**
- Token Tailwind (`src/app/globals.css`, `@theme inline`): solo `--color-background #f4efe8`, `--color-foreground #211815`, `--font-sans`, `--font-serif`. Colori più usati come valori arbitrari: `#211815` (testo), `#f4efe8` (fondo), `#8b5e4a` (accento), `#5f524c` (testo secondario), `#efe4d7` (fondo footer). `#a8583e` e `#f2ede3` della specifica compaiono 2 e 1 volte.

**Conclusione:** i componenti del gestionale vanno scritti in `src/components/gestionale/`. Per i titoli: caricare Lora con `next/font/google` solo nel layout `/gestione` (nessuna dipendenza nuova), oppure usare il `--font-serif` esistente (Cormorant). Palette: usare i valori indicati in specifica come costanti locali del gestionale; sono vicini a quelli del sito.

## 12. Sitemap e robots

- `src/app/sitemap.ts`: elenco statico `publicRoutes` → `/gestione` è già esclusa (non va aggiunta).
- `src/app/robots.ts`: in produzione `disallow: ["/admin/", "/api/", "/area-personale/"]`; nelle preview `disallow: "/"`.

**Conclusione:** aggiungere `"/gestione/"` all'array `disallow` di `robots.ts` (una riga) + `metadata.robots = { index: false, follow: false }` nel layout `/gestione`. Facoltativo: header `X-Robots-Tag: noindex` impostato dal Proxy.

---

## Verifica delle decisioni

| # | Esito | Note |
|---|---|---|
| D1 | **OK** | Rotta libera, nessun conflitto con `/admin`. Esclusione: robots (1 riga), noindex nel layout, sitemap già esclusa, BottomNav/Footer con guardia su pathname. |
| D2 | **OK** | Unicità del PIN non imponibile con indice unico (hash con salt): la impone `set-pin.mjs` confrontando con tutti gli hash. Costo: login = N × scrypt (N=2^15 ≈ 30–60 ms ciascuno, 32 MB di memoria): con 3–5 operatori resta sotto ~300 ms. Eseguire gli scrypt in sequenza, non in parallelo, per non superare la memoria della funzione. |
| D3 | **OK** | Gli script trovano `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; Node 24 supporta `--env-file`. |
| D4 | **OK** | Service role disponibile lato server. Le nuove tabelle in `public` ricevono i grant di default di Supabase verso `anon`/`authenticated`: i `REVOKE` previsti in 4.1 sono indispensabili (anche per le sequenze, se usate, e per le funzioni). |
| D5 | **OK** | Enum `gw_party` (`peony`, `redsabbath`). |
| D6 | **OK** | Formula chiara e testabile. |
| D7 | **OK** | Campo testo su `gw_workshops`. |
| D8 | **OK** | `exceljs` gira in una route handler Node; la stampa PDF non richiede dipendenze. |
| D9 | **OK** | — |
| D10 | **OK** | — |

### Architettura 4.1 / 4.2 — punti di attenzione

1. **Cookie `Path=/gestione`**: il browser non lo invia a `/api/...`. Tutte le route handler del gestionale (login, logout, export xlsx) devono stare **sotto `/gestione/`** (es. `src/app/gestione/api/…/route.ts`), oppure si usano solo server action invocate da pagine `/gestione`. Compatibile, ma vincolante.
2. **`middleware.ts` → `proxy.ts`**: in Next 16 il file si chiama `src/proxy.ts` (export `proxy`); il nome `middleware` è deprecato.
3. **Sale per l'hash degli IP**: serve una nuova variabile d'ambiente server (es. `GW_IP_HASH_SALT`) da aggiungere in `.env.local` **e su Netlify** prima del deploy.
4. **IP del client** su Netlify: `x-nf-client-connection-ip` (fallback `x-forwarded-for`, primo valore).
5. **Font**: la specifica chiede Lora, il sito usa Cormorant Garamond. Scelta conservativa: Lora via `next/font/google` solo nel layout del gestionale.
6. **Stato associativo (Fase 5)**: i dati associativi esistono già in `association_members` (Google Sheet + libro soci). `gw_membership_records` prevede `source` `csv | teamartist | manuale`: valutare di leggere `association_members` (sola lettura, abbinando per email o nome) invece di un nuovo import CSV.
7. Nessun altro blocco: service role disponibile, Proxy limitabile con `matcher`, runtime Node garantito.
