# TASK: Aggiungere login via codice OTP a 6 cifre (alternativa al magic link)

**Modalità di lavoro:** Esegui tutto in silenzio. NON mostrare codice intermedio, NON descrivere ogni modifica. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche ai file.

---

## Contesto

L'area personale (`/area-personale/login`) usa attualmente `supabase.auth.signInWithOtp` per inviare un magic link via email. L'email contiene sia il link cliccabile sia, automaticamente generato da Supabase, un codice numerico a 6 cifre (`{{ .Token }}`) — ma il template email attuale mostra solo il link.

Alcuni utenti non riescono a completare il login cliccando il link (probabile prefetch/scansione automatica del link da parte di alcuni client email, che "consuma" il token prima del click reale). Vogliamo offrire un **secondo metodo di accesso**: inserimento manuale del codice a 6 cifre, mantenendo il link come fallback.

File coinvolti:
- `src/app/area-personale/login/LoginForm.tsx`
- `src/i18n/dictionaries/it.ts`
- `src/i18n/dictionaries/en.ts`
- `src/lib/supabase/client.ts` (solo lettura, per verificare il tipo di client usato)
- `src/app/auth/callback/route.ts` — NON modificare, resta com'è come fallback per chi clicca il link

Non cambiare routing, non cambiare `/auth/callback`, non toccare calendario/Ticket Tailor/Supabase config lato dashboard, non cambiare layout grafico generale della pagina (solo il contenuto del form).

---

## Modifiche richieste

### 1. `LoginForm.tsx` — nuovo flusso a due step

**Step 1 (invio):** resta come oggi (campo email + submit → `signInWithOtp`), ma il messaggio di successo deve indicare che l'email contiene sia un link sia un codice di accesso.

Dopo l'invio riuscito, il form passa allo **Step 2** mantenendo lo stesso stile (input + bottoni pillola, palette esistente `#211815` / `#f4efe8` / `#8b5e4a`, classi Tailwind coerenti con quelle già presenti nel file).

**Step 2 (verifica codice):**
- Testo di istruzioni: invita a inserire il codice a 6 cifre ricevuto via email, oppure a cliccare il link nell'email.
- Campo input testo, `maxLength={6}`, `inputMode="numeric"`, `pattern="[0-9]*"`, stile coerente con l'input email esistente ma con `letter-spacing` ampio e testo centrato (vedi mockup: font più grande, centrato, spaziatura tra le cifre).
- Bottone primario "Verifica codice" (stesso stile del bottone pillola scuro esistente).
- Bottone secondario "Invia un nuovo codice" (outline, colore `#8b5e4a`), che richiama di nuovo `signInWithOtp` con la stessa email e resetta il campo codice. Aggiungi un piccolo cooldown (es. 30 secondi) durante il quale il bottone resend è disabilitato, con countdown testuale.
- Link/azione per tornare allo Step 1 (cambiare email).

**Verifica codice:**
```ts
const { data, error } = await supabase.auth.verifyOtp({
  email: normalizedEmail,
  token: code,
  type: "email",
});
```
- Se `error`: mostra messaggio di errore (codice errato/scaduto), non cambiare step, permetti nuovo tentativo.
- Se successo: la sessione viene impostata lato browser. Verifica come è creato `createSupabaseBrowserClient` in `src/lib/supabase/client.ts` (deve usare `@supabase/ssr` con `createBrowserClient`, che sincronizza i cookie leggibili dal server/middleware). Dopo la verifica, fai redirect a `/area-personale` usando `router.push` + `router.refresh()` (Next.js `useRouter` da `next/navigation`), così il middleware/server rilegge la sessione dai cookie aggiornati.

**Stato/UX generale:**
- Gestisci stati di loading separati per: invio email, verifica codice, resend codice.
- Mantieni la gestione errori esistente (`logAuthError`) per i nuovi path.
- Validazione codice: solo cifre, esattamente 6 caratteri prima di abilitare il bottone "Verifica codice".

### 2. Dizionari `it.ts` / `en.ts`

Nell'oggetto `login`, aggiungi (mantenendo lo stile delle chiavi esistenti, es. `dictionary.login.xxx`):

- `successWithCode` — messaggio step 1 aggiornato (menziona link + codice)
- `codeStepIntro` — istruzioni step 2
- `codeLabel` — label campo codice (es. "Codice di accesso" / "Access code")
- `codePlaceholder`
- `verifyButton` — "Verifica codice" / "Verify code"
- `verifying` — stato loading verifica
- `resendButton` — "Invia un nuovo codice" / "Resend code"
- `resendCooldown` — testo con countdown (es. "Puoi richiederne un altro in {seconds}s" / "You can request another in {seconds}s" — usa placeholder semplice da interpolare in JS)
- `resendSuccess` — conferma nuovo codice inviato
- `invalidCode` — errore codice errato/scaduto
- `changeEmail` — link/azione per tornare allo step 1 (es. "Cambia email" / "Change email")

Non rimuovere o rinominare chiavi esistenti (`emailLabel`, `submit`, `success`, `error`, `invalidEmail`, ecc.) — vengono ancora usate nello Step 1.

### 3. Email template Supabase (azione manuale, NON nel codice)

Non è possibile modificare il template email da codice (è configurazione nel dashboard Supabase). Nel report finale, includi il testo suggerito per il template "Magic Link" da incollare manualmente nel dashboard Supabase (Authentication → Emails → Magic Link), in italiano, che mostri sia `{{ .ConfirmationURL }}` che `{{ .Token }}` in modo chiaro (es. "Clicca il link per accedere: ... — oppure inserisci questo codice nell'app: {{ .Token }}").

---

## Controllo qualità

Dopo tutte le modifiche, esegui in sequenza e correggi tutti gli errori:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI/CREATI:
- [file]: [descrizione breve]

NUOVE CHIAVI DIZIONARIO (IT/EN):
- [chiave]: [it] / [en]

TEMPLATE EMAIL SUPABASE DA AGGIORNARE MANUALMENTE:
[testo suggerito IT, pronto da incollare]

NOTE/RISCHI:
- [eventuali note, es. cooldown resend, edge case gestiti]

ERRORI RESIDUI:
- [errore]: [motivo]
```
