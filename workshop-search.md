# TASK: Aggiungi ricerca per parola chiave nella pagina Workshop

**Modalità:** Esegui in silenzio. Mostra SOLO il report finale.

## File da modificare

`src/components/workshop/WorkshopPageClient.tsx`
`src/app/workshop/page.tsx`

---

## Modifiche

### 1. Aggiungi `description` a WorkshopCardData

In `WorkshopPageClient.tsx`, aggiungi al tipo:

```ts
type WorkshopCardData = {
  // campi esistenti...
  description?: string;
}
```

In `src/app/workshop/page.tsx`, in `buildLiveCard` aggiungi:

```ts
description: event.shortDescription ?? event.description,
```

### 2. Stato ricerca

Aggiungi uno stato `searchQuery` con `useState`:

```ts
const [searchQuery, setSearchQuery] = useState("");
```

### 3. Filtro cards

```ts
const filteredCards = searchQuery.trim()
  ? cards.filter(c =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.teachers?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  : cards;
```

Filtra su titolo, teachers e descrizione.

### 4. Barra di ricerca

Inserisci la barra **tra la hero section e le card**:

```tsx
<div className="px-4 pb-4">
  <div className="flex items-center gap-2 rounded-full border border-[#211815]/15 bg-white/70 px-4 py-2.5">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5e4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
    <input
      type="search"
      placeholder={dict.workshop?.searchPlaceholder ?? "Cerca workshop..."}
      value={searchQuery}
      onChange={e => setSearchQuery(e.target.value)}
      className="flex-1 bg-transparent text-sm text-[#211815] placeholder:text-[#8b5e4a]/60 outline-none"
    />
    {searchQuery && (
      <button onClick={() => setSearchQuery("")} className="text-[#8b5e4a]/60 hover:text-[#8b5e4a]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    )}
  </div>
</div>
```

### 5. Stato vuoto ricerca

Se `filteredCards.length === 0` e `searchQuery` non è vuota:

```tsx
<p className="px-4 text-sm text-[#6b5c52]">
  Nessun workshop trovato per "{searchQuery}".
</p>
```

### 6. Dictionary

Aggiungi in `src/i18n/dictionaries/it.ts` e `en.ts` sotto `workshop`:

```ts
// it.ts
searchPlaceholder: "Cerca workshop..."

// en.ts
searchPlaceholder: "Search workshops..."
```

Se `workshop` non esiste nel dictionary, usa il fallback inline già nel JSX (`?? "Cerca workshop..."`).

---

## Dopo le modifiche

```
npx.cmd tsc --noEmit
npm.cmd run lint
```

---

## Report finale

```
FILES MODIFICATI:
- [file]: [cosa cambiato]

ERRORI RESIDUI:
- [errore]: [motivo]
```
