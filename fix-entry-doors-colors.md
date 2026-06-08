# TASK: Sezione Orientamento — colori in linea con il sito

In `src/components/home/EntryDoorsSection.tsx`:

## 1. Sfondo della sezione
Il wrapper esterno della sezione ha probabilmente `bg-[#1a1410]` o simile nero/quasi nero. Sostituiscilo con `bg-[#f0ebe4]` (lo stesso beige chiaro del resto della home).

## 2. Colori card
Sostituisci i colori delle 4 card con questi — toni caldi e medi, non scuri:

```ts
const CARD_COLORS = [
  { bg: '#e8ddd4', text: '#2a1f1a' },  // 01 — beige caldo
  { bg: '#dde4d8', text: '#1e2a1e' },  // 02 — salvia chiaro
  { bg: '#d8d4e8', text: '#1e1a2a' },  // 03 — lavanda chiaro
  { bg: '#e8d4de', text: '#2a1a20' },  // 04 — rosa antico chiaro
]
```

## 3. Testi nella sezione
- L'eyebrow "ORIENTAMENTO" deve usare `text-[#b07a5a]`
- Il titolo "Scegli come entrare..." deve usare `text-[#2a1f1a]`
- I numeri (01, 02...) e le sottotitoli delle card devono usare il colore `text` della card corrispondente con `opacity-60`

## 4. Icone e `+`
Le icone circolari e il `+` nelle card devono usare il colore `text` della card (scuro su sfondo chiaro).

```
npm.cmd run build
```

Report: colori applicati + eventuali errori.
