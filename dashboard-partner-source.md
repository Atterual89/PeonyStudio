# TASK: Dashboard — badge partner con partner_source

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Contesto

In `user_event_enrollments` esiste ora la colonna `partner_source` (text, nullable) con valori:
- `'ticket_tailor'` — pre-compilato dalla sync
- `'user'` — inserito/modificato manualmente dall'utente
- `null` — nessun partner indicato

---

## Modifiche richieste

### 1. Aggiornare il tipo `Enrollment` in `personal-area.ts`

Aggiungere `partner_source: string | null` al tipo `Enrollment` e alla select di `user_event_enrollments`.

### 2. Aggiornare il badge sulla card evento in `PersonalAreaDashboard.tsx`

La logica del badge per eventi con `requires_partner = true` deve essere:

**Caso 1 — nessun partner** (`partner_email` e `partner_name` entrambi null/vuoti):
- Icona `⚠️` + `Users` in giallo/ambra
- Testo: `Indica il tuo partner`

**Caso 2 — partner da Ticket Tailor** (`partner_source === 'ticket_tailor'`):
- Icona `!` + `Users` in giallo/ambra  
- Testo: `Conferma o modifica il partner`
- Mostra il valore attuale in piccolo sotto (partner_name o partner_email)

**Caso 3 — partner confermato dall'utente** (`partner_source === 'user'`):
- Icona `✓` + `Users` in verde
- Testo: il valore salvato (partner_name se presente, altrimenti partner_email)

### 3. Aggiornare il salvataggio del partner in `PersonalAreaDashboard.tsx`

Quando l'utente clicca "Salva" nel form partner, aggiungere `partner_source: 'user'` all'update:

```ts
await supabase
  .from('user_event_enrollments')
  .update({ 
    partner_email: ..., 
    partner_name: ...,
    partner_source: 'user'
  })
  .eq('id', enrollment.id)
```

### 4. Aggiornare `sync-profiles/route.ts`

Quando viene pre-compilato il partner dalla sync, aggiungere `partner_source: 'ticket_tailor'` all'update:

```ts
const updateData = partnerAnswer.includes('@')
  ? { partner_email: partnerAnswer, partner_source: 'ticket_tailor' }
  : { partner_name: partnerAnswer, partner_source: 'ticket_tailor' }
```

### 5. Aggiornare `personal-area.ts` — `ensurePartnerData`

Se esiste questa funzione, aggiungere `partner_source: 'ticket_tailor'` quando viene pre-compilato il partner al login.

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

ERRORI RESIDUI:
- [errore]: [motivo]
```
