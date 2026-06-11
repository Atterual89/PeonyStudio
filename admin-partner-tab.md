# TASK: Admin — tab Gestione Tessere / Gestione Partner + bottone Conferma partner

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Parte 1 — Tab switcher nella pagina admin

In `src/app/admin/ticket-tailor/page.tsx`, aggiungi in cima alla pagina (sopra il riepilogo del processo) un tab switcher con due voci:

- **GESTIONE TESSERE** — mostra tutto il contenuto attuale della pagina
- **GESTIONE PARTNER** — mostra la nuova sezione (vedi Parte 2)

Stile: tab pills o underline, coerente con il resto della pagina admin. Usa uno stato `activeTab: 'tessere' | 'partner'`.

---

## Parte 2 — Sezione Gestione Partner

Quando `activeTab === 'partner'`, mostra una sezione con:

### Intestazione
- Titolo: "Gestione Partner"
- Sottotitolo: "Enrollment che richiedono un partner. Evidenziati quelli con dati da Ticket Tailor ancora da confermare."

### Caricamento dati
Bottone **"Carica partner"** che chiama l'endpoint esistente `/api/admin/participants` o direttamente Supabase per caricare:

```ts
SELECT 
  ue.id,
  ue.ticket_tailor_order_id,
  ue.partner_email,
  ue.partner_name,
  ue.partner_source,
  ue.enrollment_status,
  p.email as buyer_email,
  p.first_name as buyer_first_name,
  p.last_name as buyer_last_name,
  p.nickname as buyer_nickname,
  e.title as event_title,
  e.starts_at as event_starts_at
FROM user_event_enrollments ue
LEFT JOIN profiles p ON ue.profile_id = p.id
LEFT JOIN events e ON ue.event_id = e.id
WHERE e.requires_partner = true
ORDER BY 
  CASE WHEN ue.partner_source = 'ticket_tailor' THEN 0 ELSE 1 END,
  e.starts_at DESC
```

Usa `createClient` browser con le credenziali pubbliche (è una pagina admin autenticata), oppure crea un nuovo endpoint `/api/admin/partner-enrollments` che esegue questa query con il service role key e restituisce i dati.

### Lista enrollment

Per ogni enrollment mostra una card/riga con:

- **Nome acquirente**: `buyer_nickname || buyer_first_name || buyer_email`
- **Email acquirente**
- **Evento**: `event_title` + data formattata
- **Partner indicato**: 
  - Se `partner_source = 'ticket_tailor'`: badge giallo "Da Ticket Tailor" + valore
  - Se `partner_source = 'user'`: badge verde "Confermato" + valore
  - Se null: badge grigio "Non indicato"
- **Campo editabile**: input per modificare `partner_name` o `partner_email` + bottone Salva
- Il salvataggio dall'admin imposta sempre `partner_source = 'user'`

### Statistiche in cima
- Totale enrollment con partner richiesto
- Di cui: da confermare (ticket_tailor), confermati (user), non indicati (null)

---

## Parte 3 — Bottone "Conferma" nel badge del dashboard utente

In `src/app/area-personale/PersonalAreaDashboard.tsx`, nel badge che mostra `partner_source === 'ticket_tailor'`:

Aggiungi un bottone piccolo **"Conferma"** accanto al testo "Conferma o modifica il partner".

Al click:
```ts
await supabase
  .from('user_event_enrollments')
  .update({ partner_source: 'user' })
  .eq('id', enrollment.id)
```
- Aggiorna lo stato locale immediatamente (partner_source → 'user')
- Badge diventa ✓ verde senza aprire il form
- Nessun cambio a partner_email o partner_name

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

ERRORI RESIDUI:
- [errore]: [motivo]
```
