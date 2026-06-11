# TASK: Nuovo endpoint `/api/admin/ticket-tailor/sync-profiles`

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Contesto

Esiste già `/api/admin/ticket-tailor/sync-orders` che sincronizza gli ordini da Ticket Tailor in `ticket_tailor_orders`. Esiste già la logica in `src/lib/personal-area.ts` che crea profili ed enrollment quando un utente fa login.

Vogliamo un nuovo endpoint che faccia la stessa cosa **in bulk** per tutti gli ordini già presenti in `ticket_tailor_orders`, senza aspettare che ogni utente faccia login.

---

## Crea il file

`src/app/api/admin/ticket-tailor/sync-profiles/route.ts`

Segui esattamente lo stesso pattern di `sync-participants/route.ts`:
- Auth via header `x-admin-sync-secret`
- `createSupabaseAdminClient()`
- `export const dynamic = "force-dynamic"`
- Risposta JSON con statistiche

---

## Logica dell'endpoint

### Step 1 — Leggi tutti gli ordini da `ticket_tailor_orders`

```ts
SELECT ticket_tailor_order_id, ticket_tailor_event_id, event_id, 
       buyer_email, buyer_first_name, buyer_last_name, raw_payload
FROM ticket_tailor_orders
WHERE buyer_email IS NOT NULL
RANGE 0-999
```

### Step 2 — Per ogni ordine, crea il profilo se non esiste

Per ogni `buyer_email`:
1. Cerca in `profiles` per email
2. Se non esiste → inserisci `{ email: buyer_email, first_name: buyer_first_name, last_name: buyer_last_name, role: 'user' }`
3. Se esiste già → skip (non sovrascrivere dati esistenti)
4. Salva il `profile.id` per lo step successivo

**Nota:** questi profili NON hanno un `auth.users` associato — l'`id` va generato con `uuid_generate_v4()` o lasciato al default del DB. NON usare `user.id` da Supabase Auth.

### Step 3 — Pre-compila nickname dal raw_payload

Se il profilo è appena creato (o ha nickname null), cerca in `raw_payload.buyer_details.custom_questions` la domanda che contiene "nickname" e salva la risposta in `profiles.nickname`.

### Step 4 — Crea enrollment in `user_event_enrollments` se non esiste

Per ogni ordine con `event_id` valorizzato:
1. Cerca in `user_event_enrollments` per `ticket_tailor_order_id`
2. Se non esiste → inserisci:
```ts
{
  profile_id: profile.id,
  event_id: order.event_id,
  ticket_tailor_event_id: order.ticket_tailor_event_id,
  ticket_tailor_order_id: order.ticket_tailor_order_id,
  enrollment_status: 'active'
}
```
3. Se esiste già → skip

### Step 5 — Pre-compila partner dall'enrollment

Per ogni enrollment appena creato (o con partner_email e partner_name entrambi null):
- Cerca in `raw_payload.buyer_details.custom_questions` la domanda che contiene "partner" OR "persona con cui verrai"
- Se la risposta contiene `@` → salva in `partner_email`
- Altrimenti → salva in `partner_name`
- Non sovrascrivere valori già presenti

---

## Statistiche da restituire

```ts
{
  ok: boolean,
  ordersRead: number,
  profilesCreated: number,
  profilesSkipped: number,
  enrollmentsCreated: number,
  enrollmentsSkipped: number,
  partnerPrefilled: number,
  errors: { level, message, orderId? }[]
}
```

---

## Aggiungi il pulsante nell'admin UI

In `src/app/admin/ticket-tailor/page.tsx` (o dove sono gli altri pulsanti di sync), aggiungi un pulsante "Sync Profili" che chiama il nuovo endpoint con il secret. Stesso stile degli altri pulsanti sync esistenti.

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
FILES MODIFICATI/CREATI:
- [file]: [descrizione]

LOGICA:
- Come vengono gestiti i profili duplicati
- Come viene gestito il partner

ERRORI RESIDUI:
- [errore]: [motivo]
```
