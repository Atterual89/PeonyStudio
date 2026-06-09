# TASK: Dashboard — nickname utente da Ticket Tailor

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## Contesto

Il dashboard mostra il nome dell'utente loggato. Vogliamo mostrare il **nickname** al posto del nome proprio, pescandolo dal `raw_payload` degli ordini Ticket Tailor salvati in Supabase.

Il nickname è facoltativo — non tutti gli utenti lo hanno. La logica di priorità è:
1. `profiles.nickname` (se presente e non vuoto)
2. `profiles.first_name`
3. email dell'utente (fallback finale)

---

## Step 1 — Migrazione DB: aggiungere colonna `nickname` a `profiles`

Esegui questa query SQL su Supabase tramite il client (o crea una migration):

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname text;
```

Se il progetto usa migration files (cartella `supabase/migrations/`), crea il file appropriato. Altrimenti esegui la query direttamente nel client Supabase.

---

## Step 2 — Popolare `nickname` al login / al caricamento del dashboard

Nel punto in cui vengono caricati i dati utente per il dashboard (cerca dove viene fatto `supabase.from('profiles').select(...)` o simile), aggiungi questa logica **dopo** aver caricato il profilo:

Se `profile.nickname` è null o vuoto:
1. Cerca in `ticket_tailor_orders` il primo ordine dove `buyer_email = user.email`
2. Leggi `raw_payload.buyer_details.custom_questions`
3. Trova l'elemento il cui campo `question` contiene (case-insensitive) la parola `"nickname"`
4. Se `answer` è presente e non vuoto (dopo trim), salva il valore in `profiles.nickname` via upsert
5. Usa quel valore come nickname corrente

Esempio logica estrazione:

```ts
const orders = await supabase
  .from('ticket_tailor_orders')
  .select('raw_payload')
  .eq('buyer_email', userEmail)
  .not('raw_payload', 'is', null)
  .limit(5)

for (const order of orders.data ?? []) {
  const questions = order.raw_payload?.buyer_details?.custom_questions ?? []
  const nicknameQ = questions.find((q: any) =>
    q.question?.toLowerCase().includes('nickname')
  )
  const nickname = nicknameQ?.answer?.trim()
  if (nickname) {
    await supabase
      .from('profiles')
      .update({ nickname })
      .eq('email', userEmail)
    break
  }
}
```

---

## Step 3 — Usare il nickname nel dashboard

Ovunque nel dashboard venga mostrato il nome dell'utente (header "Ciao [nome]", eventuale sezione profilo, etc.), sostituisci con questa logica:

```ts
const displayName = profile.nickname || profile.first_name || user.email
```

---

## Controllo qualità

```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [descrizione]

LOGICA NICKNAME:
- Dove viene estratto e salvato
- Dove viene usato nel display

ERRORI RESIDUI:
- [errore]: [motivo]
```

---

## Step 4 — Modifica nickname dalla sezione Profilo

Nella sezione **Profilo** del dashboard, aggiungi un campo editabile per il nickname:

- Campo di testo con label "Nickname" e valore corrente `profile.nickname` (o vuoto se non impostato)
- Placeholder: "Come vuoi essere chiamato/a?"
- Bottone "Salva" che esegue:

```ts
await supabase
  .from('profiles')
  .update({ nickname: nuovoNickname.trim() || null })
  .eq('email', userEmail)
```

- Dopo il salvataggio aggiorna il `displayName` nel dashboard senza ricaricare la pagina
- Feedback visivo: messaggio "Salvato" per 2 secondi dopo il salvataggio, errore se fallisce
- Se l'utente svuota il campo e salva, `nickname` torna `null` e il display ricade su `first_name`
- Stile coerente col resto del profilo (sfondo dashboard, testo chiaro)
