# TASK: Redesign sezione "I possibili punti di partenza" — timeline con icone legenda

**Modalità:** Esegui in silenzio. Mostra SOLO il report finale.

---

## Contesto

La sezione si trova in `src/components/how-to-start/HowToStartPage.tsx` e `HowToStartInline.tsx`. Attualmente mostra una griglia di card numerate piatte. Va sostituita con una **timeline verticale** con linea di connessione, identica nello stile ai percorsi.

---

## Design da implementare

### Layout generale
- Linea verticale sottile `bg-[#c8b49a] w-px` che collega tutti gli step
- Ogni step ha un dot `w-2 h-2 rounded-full bg-[#c8b49a]` sulla linea
- Step attivo: dot `bg-[#8b5e4a]`, card `bg-[#211815]` con testi chiari
- Tap/click su uno step → diventa attivo, gli altri tornano normali
- Un solo step attivo alla volta (useState)

### Legenda icone
Aggiungi sopra la timeline la stessa legenda già presente in `ProgramsProgressPage` — importa gli stessi componenti Lucide (`User, Users, Sprout, BookOpen, Ribbon, Eye`) e usa gli stessi testi dal `dictionary.practice`:
- `iconLegendUser` — Anche per single
- `iconLegendUsers` — Per coppie  
- `iconLegendSprout` — Aperta a chi inizia
- `iconLegendBookOpen` — Richiede basi
- `iconLegendRibbon` — Solo per bottom
- `iconLegendEye` — Observer ammessi

Stesso stile: `overflow-x-auto bg-[#211815]/[0.04] px-4 py-2.5`, icone `size={12} text-[#8b5e4a]/55`, testi `text-[10px] text-[#5f524c]/62`.

### Icone per step
Ogni step mostra le icone rilevanti in basso nella card:

```
01 — Open Day / Rope Jam       → User, Users, Sprout, Eye
02 — Aperibottom               → Ribbon
03 — Foundation 1 / Foundation 2 → Users, Sprout
04 — Pratica assistita / Classi tematiche → Users, BookOpen
05 — Classe 1 / Classe 1+      → Users, BookOpen
06 — Workshop / KL             → Users, BookOpen
```

Icone: `size={12} className="text-[#8b5e4a]/50"` — quando step attivo: `text-[#c8b49a]/60`

### Struttura ogni step card

```
┌─────────────────────────────────────┐
│ 01                                  │  ← 10px, muted
│ Open Day / Rope Jam                 │  ← font-serif 16px
│ Osservare e orientarsi              │  ← 12px, muted
│ [icona] [icona] [icona]             │  ← icone legenda, mt-2
└─────────────────────────────────────┘
```

Card: `rounded-[10px] border border-[#211815]/10 bg-white p-3`, gap `mb-1` tra step.
Step attivo: `bg-[#211815] border-[#211815]`, titolo `text-[#f5ede2]`, testo `text-[#c8b49a]`.

---

## Note implementative

- Il componente deve restare `"use client"` (già lo è)
- Aggiungi `useState<number>(0)` per lo step attivo
- Applica la stessa modifica identica in entrambi i file: `HowToStartPage.tsx` e `HowToStartInline.tsx`
- Non cambiare nulla fuori dalla sezione `entryPaths` (il quiz, l'header, ecc. restano intatti)
- I testi vengono già dal content file `howToStartBilingual` — non cambiarli

---

## Dopo le modifiche

```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale

```
FILES MODIFICATI:
- [file]: [cosa cambiato]

ERRORI RESIDUI:
- [errore]: [motivo]
```
