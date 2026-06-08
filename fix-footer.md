# TASK: Fix footer — rimuovi duplicato, layout a 2 colonne, email visibile

**Modalità:** Silenzio. Solo report finale.

---

## Problemi da risolvere

1. Il footer appare **due volte** nella pagina — una istanza va eliminata
2. Il layout deve essere a **2 colonne** su mobile (non 3 colonne verticali)
3. L'email `peony.studio.turin@gmail.com` non è visibile — colore troppo simile allo sfondo

---

## 1. Rimuovi il duplicato

Cerca nel codice dove viene renderizzato `GlobalFooter` (o il componente footer). Probabilmente è incluso sia nel layout globale (`src/app/layout.tsx`) che in qualche pagina specifica. Rimuovi la seconda occorrenza, tieni solo quella nel layout globale.

---

## 2. Layout a 2 colonne

In `src/components/layout/GlobalFooter.tsx`, modifica il layout delle colonne così:

```tsx
// Sostituisci il wrapper delle colonne con:
<div className="grid grid-cols-2 gap-6">
  {/* Colonna sinistra: brand + social */}
  <div>
    <p className="text-xs tracking-widest uppercase font-medium mb-1">Peony Studio</p>
    <p className="text-xs text-[#9a8a7e] mb-4">Kinbaku venue · Torino</p>
    {/* icone social */}
  </div>

  {/* Colonna destra: link Studio + link Attività */}
  <div className="space-y-4">
    <div>
      <p className="text-xs tracking-widest uppercase text-[#b07a5a] mb-2">Studio</p>
      {/* Peony, Come iniziare, Calendario */}
    </div>
    <div>
      <p className="text-xs tracking-widest uppercase text-[#b07a5a] mb-2">Attività</p>
      {/* Percorsi, Workshop, Socialità, Shop, Area personale */}
    </div>
  </div>
</div>
```

Sotto le due colonne, full-width, metti l'email e il copyright.

---

## 3. Email visibile e cliccabile

L'email deve avere colore ben visibile. Usa esattamente:

```tsx
<a
  href="mailto:peony.studio.turin@gmail.com"
  className="text-sm text-[#c9a98a] underline underline-offset-2 mt-6 block"
>
  peony.studio.turin@gmail.com
</a>
```

Assicurati che non sia sovrascritta da classi ereditate che la rendono color sfondo.

---

## Verifica

```
npx.cmd tsc --noEmit
npm.cmd run build
```

---

## Report finale

```
DUPLICATO RIMOSSO DA: [file]
LAYOUT: [2 colonne applicato / non applicato + motivo]
EMAIL COLORE: [classe colore usata]
ERRORI: [eventuale]
```
