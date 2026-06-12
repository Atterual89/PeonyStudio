# TASK: Diagnosi e fix — primo accesso area personale (errore 500 + codice OTP "scaduto")

**Modalità di lavoro:** Esegui tutto in silenzio. NON mostrare codice intermedio, NON descrivere ogni passaggio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche ai file.

---

## Contesto

Abbiamo appena introdotto un secondo metodo di login: inserimento di un codice OTP a 6 cifre (`supabase.auth.verifyOtp`), in alternativa al magic link cliccabile, in `src/app/area-personale/login/LoginForm.tsx`.

**Scenario di test riproducibile (account NUOVO, senza login precedenti):**
1. Utente cancellato da Supabase Auth → email inserita nel form di login → Supabase tratta la richiesta come "Confirm signup" (nuovo utente) e invia un'email con link + codice
2. Se l'utente inserisce il codice a 6 cifre → l'app mostra "codice non valido o scaduto" anche se il codice è appena arrivato
3. Se l'utente clicca invece il link → arriva alla pagina `/auth/callback?code=...`, il code exchange sembra avvenire, ma poi appare una schermata di errore generica Next.js: **"This page couldn't load — A server error occurred"** con un digest (es. `4224407886`) — quindi un errore 500 non gestito in una pagina server-side a valle del redirect (probabilmente `/area-personale` o un suo layout/componente server)

**Per utenti GIÀ esistenti** (che hanno già fatto login almeno una volta in passato), magic link e/o codice funzionano correttamente — il problema è specifico del **primo accesso di un account nuovo**.

---

## Parte 1 — Diagnosi (fai questa analisi PRIMA di modificare codice)

1. **Verifica il tipo di token OTP per "Confirm signup"**: in `LoginForm.tsx`, la chiamata a `verifyOtp` usa `type: "email"`. Per un token generato dal flusso "Confirm signup" (nuovo utente), Supabase potrebbe richiedere `type: "signup"` invece di `type: "email"`. Verifica nella documentazione/tipi di `@supabase/supabase-js` quali valori di `type` sono validi per `verifyOtp` e quale corrisponde a un nuovo utente creato via `signInWithOtp` con `shouldCreateUser: true`.

2. **Traccia il flusso server-side dopo il login per un utente nuovo**:
   - `src/app/auth/callback/route.ts` → dopo `exchangeCodeForSession` con successo, redirect a `next` (default `/area-personale`)
   - `src/app/area-personale/page.tsx` e/o `PersonalAreaDashboard.tsx` e qualsiasi `layout.tsx` nel percorso `/area-personale` → identifica TUTTE le query Supabase (es. tabella `profiles`, `members`, o simili) che assumono l'esistenza di un record legato all'utente
   - Identifica il punto esatto in cui, per un utente che ha appena creato l'account (nessun record collegato in tabelle come `profiles`/`members`/altre), il codice potrebbe:
     - chiamare un metodo su `null`/`undefined` (es. `.map()`, accesso a proprietà di un oggetto `null`)
     - lanciare un errore Supabase non catturato (es. query con `.single()` che fallisce se 0 righe)
   - Controlla anche eventuale `middleware.ts` che gestisce sessioni/redirect su `/area-personale`

3. Annota nel report la causa esatta individuata (file + riga + descrizione del problema), PRIMA di passare alla parte 2.

---

## Parte 2 — Fix

### Fix A — `LoginForm.tsx`, verifica codice OTP
Modifica la chiamata `verifyOtp` per gestire sia utenti esistenti che nuovi:
- Prova prima con `type: "email"`
- Se fallisce con errore di token non valido/scaduto, ritenta con `type: "signup"` (stesso `email`, stesso `token`)
- Solo se entrambi falliscono, mostra l'errore `invalidCode` esistente
- Non duplicare codice in modo eccessivo: estrarre la logica in una funzione helper interna al file

### Fix B — crash 500 al primo accesso
In base a quanto trovato nella Parte 1, correggi il/i punto/i che causano il crash per utenti senza record collegato, con l'approccio meno invasivo possibile:
- Se manca un record in una tabella (es. `profiles`), **crealo automaticamente** con valori di default al primo accesso (se ha senso nel contesto), OPPURE
- Se non è possibile/sensato crearlo automaticamente, gestisci il caso con valori di default/fallback nella UI (es. nome vuoto, sezioni vuote) invece di un errore non gestito
- Non cambiare la struttura delle pagine, solo la gestione dei dati mancanti
- Assicurati che il middleware (se presente) non causi redirect loop per utenti senza profilo

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
DIAGNOSI:
- Causa errore 500 (file + riga + descrizione):
- Tipo OTP corretto per nuovo utente (email / signup / altro):

FILES MODIFICATI:
- [file]: [descrizione breve della modifica]

COMPORTAMENTO ATTUALE PER UTENTE NUOVO (dopo fix):
- [descrizione passo-passo di cosa succede ora]

NOTE/RISCHI:
- [eventuali note]

ERRORI RESIDUI:
- [errore]: [motivo]
```
