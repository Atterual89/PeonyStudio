# TASK: Dashboard Eventi — campo partner

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Contesto

Nel dashboard area personale, la sezione Eventi mostra le iscrizioni dell'utente. Alcuni eventi richiedono un partner (campo `requires_partner = true` nella tabella `events`). Per questi eventi vogliamo mostrare un campo compilabile dove l'utente può indicare email e nome del partner.

---

## Step 1 — Migrazione DB

Aggiungi due colonne a `user_event_enrollments`:

```sql
ALTER TABLE user_event_enrollments ADD COLUMN IF NOT EXISTS partner_email text;
ALTER TABLE user_event_enrollments ADD COLUMN IF NOT EXISTS partner_name text;
```

Crea il file `supabase/migrations/007_add_partner_to_enrollments.sql` con queste query.

---

## Step 2 — Aggiornare il tipo e la query in `personal-area.ts`

Nel tipo `Enrollment` aggiungi:
```ts
partner_email: string | null;
partner_name: string | null;
```

Nella select di `user_event_enrollments` aggiungi `partner_email,partner_name`.

Nel join con `events` aggiungi `requires_partner` alla select:
```ts
"id,title,starts_at,ends_at,category,booking_url,requires_partner"
```

Aggiorna il tipo dell'oggetto `events` dentro `Enrollment`:
```ts
events: {
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  category: string | null;
  booking_url: string | null;
  requires_partner: boolean | null;
} | null;
```

---

## Step 3 — UI nel bottom sheet evento

Nel componente che mostra i dettagli dell'evento (bottom sheet o card espandibile), dopo "Verifica gli orari definitivi" e prima di "Apri Ticket Tailor":

**Se `enrollment.events.requires_partner === true`**, mostra un blocco:

```
┌─ 👥 Il tuo partner ──────────────────┐
│  [Se non compilato]:                  │
│  ⚠️ Non hai ancora indicato il tuo   │
│  partner per questo evento.           │
│                                       │
│  [Se già compilato]:                  │
│  ✓ [partner_name o partner_email]    │
│  link "Modifica"                      │
│                                       │
│  Form (visibile se non compilato      │
│  o se si clicca Modifica):            │
│  Label "Email partner" + input email  │
│  Label "Nome partner" + input text    │
│  Bottone "Salva"                      │
└───────────────────────────────────────┘
```

- Entrambi i campi sono facoltativi (basta compilarne uno)
- Al click Salva: `supabase.from('user_event_enrollments').update({ partner_email, partner_name }).eq('id', enrollment.id)`
- Usa il client Supabase browser
- Feedback "Salvato ✓" per 2 secondi
- Dopo il salvataggio aggiorna lo stato locale dell'enrollment senza ricaricare la pagina
- Se entrambi i campi vengono svuotati e salvati, torna allo stato "non compilato"

---

## Step 4 — Policy RLS

Aggiungi policy Supabase per permettere all'utente di aggiornare il proprio enrollment:

```sql
CREATE POLICY "Users can update own enrollments"
ON user_event_enrollments
FOR UPDATE
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);
```

Aggiungila nella migration `007_add_partner_to_enrollments.sql`.

---

## Stile

- Coerente con il resto del bottom sheet del dashboard
- Sfondo blocco partner: `bg-white/5` o leggermente più chiaro dello sfondo
- Icona 👥 o `Users` da Lucide React
- Warning ⚠️ in arancione tenue, non allarmistico
- Input: stesso stile del campo nickname nel profilo

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

LOGICA PARTNER:
- Come viene mostrato/nascosto il blocco
- Come viene salvato

ERRORI RESIDUI:
- [errore]: [motivo]
```
