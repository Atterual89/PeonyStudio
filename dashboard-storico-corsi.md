# TASK: Dashboard — sostituisci "Il tuo percorso" con storico corsi frequentati

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Contesto

La sezione "PERCORSO / Il tuo percorso" nel dashboard mostra Foundation 1/2, Class 1, Class 1+ con stati "SUGGERITO" / "NON ANCORA INIZIATO". Va sostituita con uno storico reale dei corsi frequentati dall'utente, basato sui check-in in `ticket_tailor_issued_tickets`.

---

## Cosa fare

### 1. Aggiornare `personal-area.ts`

Aggiungi una nuova funzione `loadAttendanceHistory` che carica lo storico corsi:

```ts
async function loadAttendanceHistory(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
) {
  const { data, error } = await supabase
    .from('ticket_tailor_issued_tickets')
    .select('event_id, ticket_tailor_event_id, ticket_type_name, events(title, category, starts_at)')
    .eq('holder_email', email)
    .eq('checked_in', true)
    .not('events.category', 'eq', 'community')
    .not('events.category', 'eq', 'system')
    .order('events(starts_at)', { ascending: false })
    .limit(10)

  if (error) return []
  return data ?? []
}
```

**Nota:** se il join con `.not('events.category', ...)` non funziona direttamente, fai prima la select e poi filtra lato JS rimuovendo i record con `category === 'community'` o `category === 'system'`.

Aggiungi `attendanceHistory` al tipo `PersonalAreaData` e al return di `getOrCreatePersonalAreaData`.

Tipo per ogni elemento:
```ts
type AttendanceHistoryItem = {
  event_id: string | null;
  ticket_tailor_event_id: string | null;
  ticket_type_name: string | null;
  events: {
    title: string | null;
    category: string | null;
    starts_at: string | null;
  } | null;
}
```

### 2. Raggruppamento per titolo evento

Nella query o lato JS, raggruppa gli elementi con lo stesso `event_id` (o stesso `events.title`). Se un utente ha partecipato più volte allo stesso evento, mostra una sola riga con il contatore `× N` accanto al titolo.

### 3. Aggiornare `PersonalAreaDashboard.tsx`

Sostituisci la sezione "PERCORSO / Il tuo percorso" (quella con Foundation 1/2, Class 1, Class 1+ e stati SUGGERITO/NON ANCORA INIZIATO) con la nuova sezione "STORICO CORSI".

**Nuovo layout:**

```
STORICO
I corsi che hai frequentato

[Se lista vuota]:
  "Nessun corso frequentato ancora."

[Per ogni elemento raggruppato]:
  Card con:
  - Badge categoria (es. "WORKSHOP", "PERCORSO", "ALTRO") — stesso stile badge esistente
  - Titolo evento (es. "Classe #1")
  - Data evento formattata (es. "28 feb 2026") — da events.starts_at
  - Se count > 1: badge piccolo "× 3" in fondo a destra

Massimo 10 elementi, dal più recente al più vecchio.
```

Stile coerente con le card eventi esistenti nel dashboard (stesso sfondo, font, bordi).

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
