# TASK: Modifiche UI — tab Inizia, accordion, cerchietto lezioni private

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## File da leggere prima di modificare

- `src/components/how-to-start/HowToStartPage.tsx`
- `src/components/how-to-start/HowToStartInline.tsx`
- `src/components/shop/ShopProducts.tsx`
- `src/components/programs/PrivateLessonsTab.tsx`

---

## Modifica 1 — Tab "Inizia": rimuovere scurimento al click

In `HowToStartPage.tsx` e/o `HowToStartInline.tsx`, nella sezione "possibili punti di partenza" (tab o sezioni cliccabili), rimuovi qualsiasi stile che scurisce la sezione quando viene selezionata/cliccata. Le sezioni devono rimanere visivamente uguali sia selezionate che non selezionate — solo il contenuto cambia, non lo sfondo o il colore.

Cerca classi tipo `bg-black/10`, `bg-[#...]/20`, `opacity`, `brightness` o simili che vengono aggiunte allo stato attivo e rimuovile.

---

## Modifica 2 — Accordion "cosa include": chiude gli altri

In `ShopProducts.tsx`, nella sezione delle Peony Card (o qualsiasi sezione con accordion "cosa include"), implementa logica a fisarmonica:

- Usa uno stato `openIncludesId: string | null`
- Quando si apre un "cosa include", chiudi tutti gli altri
- Quando si clicca di nuovo sullo stesso, si chiude

Stessa logica per gli articoli dello shop: usa uno stato `openProductId: string | null` — quando si apre un articolo, chiudi tutti gli altri.

---

## Modifica 3 — Cerchietto attorno al `+` nelle lezioni private

In `PrivateLessonsTab.tsx`, trova il bottone o elemento che mostra il `+` per espandere le sezioni. Aggiungi un cerchietto attorno al `+` con lo stesso stile della sezione "come arrivare" (cerchio con bordo, es. `rounded-full border border-current w-5 h-5 flex items-center justify-center`).

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
