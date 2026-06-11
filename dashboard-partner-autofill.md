# TASK: Dashboard — pre-compilazione automatica campo partner da Ticket Tailor

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Contesto

In `user_event_enrollments` esistono già le colonne `partner_email` e `partner_name`. Quando un utente acquista un biglietto su Ticket Tailor, può indicare il partner nella custom question che contiene la parola "partner" in `raw_payload.buyer_details.custom_questions`.

Vogliamo pre-compilare automaticamente `partner_email` al caricamento del dashboard, se il campo è ancora vuoto, leggendo la risposta dal `raw_payload` dell'ordine corrispondente.

---

## Dove intervenire

In `src/lib/personal-area.ts`, nella funzione `loadEnrollments` o in una nuova funzione `ensurePartnerData` chiamata dopo `loadEnrollments`.

---

## Logica

Per ogni enrollment che:
- Ha `partner_email` null o vuoto
- Ha un `ticket_tailor_order_id` valorizzato
- Ha `enrollment.events.requires_partner === true`

Cerca in `ticket_tailor_orders` l'ordine con quel `ticket_tailor_order_id` e leggi:

```ts
const questions = order.raw_payload?.buyer_details?.custom_questions ?? []
const partnerQ = questions.find((q: any) => {
  if (typeof q.question !== 'string') return false
  const q_lower = q.question.toLowerCase()
  return q_lower.includes('partner') || q_lower.includes('persona con cui verrai')
})
const partnerAnswer = partnerQ?.answer?.trim()
```

Se `partnerAnswer` è presente e non vuoto:
- Salvalo in `user_event_enrollments.partner_email` via UPDATE
- Aggiorna l'enrollment in memoria per restituirlo già compilato

---

## Note importanti

- Usa `createSupabaseAdminClient()` — siamo in un file server-only
- Processa solo gli enrollment con `requires_partner = true` per evitare query inutili
- Se l'ordine non ha risposta alla domanda partner, lascia il campo null — non forzare nulla
- Non sovrascrivere un `partner_email` già presente (compilato manualmente dall'utente)

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

LOGICA PARTNER AUTO:
- Dove viene chiamata la funzione
- Cosa succede se la risposta non c'è

ERRORI RESIDUI:
- [errore]: [motivo]
```
