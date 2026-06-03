# TASK: Rimuovi didascalie dalle foto

**Modalità di lavoro:** Esegui in silenzio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## Obiettivo

Rimuovi tutte le didascalie visibili sulle foto in tutta la pagina `/peony` e in qualsiasi altro componente del sito che mostri didascalie sotto o sopra le immagini.

---

## Dove cercare

- `src/components/peony/PeonyPageClient.tsx`
- Componenti gallery, mosaic, immagini dello spazio
- Qualsiasi componente che renderizza `<figcaption>`, testo sovrapposto sull'immagine, label sotto foto, o testo tipo `PXL_20240601_163535630` o nomi file

## Cosa rimuovere

- Testo sovrapposto sulle foto (overlay con nome area, nome file, ecc.)
- `<figcaption>` o equivalenti
- Label tipo "Lounge", "Bamboo / Hashira", "Practice setup" se appaiono come didascalie visibili sopra/sotto/sull'immagine
- Nomi file tipo `PXL_20240601_163535630` o simili

## Cosa NON toccare

- Attributi `alt` delle immagini (accessibilità, non visibili)
- Logica di caricamento immagini
- Layout e dimensioni foto

---

## Controllo

Esegui:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [cosa rimosso]

ERRORI RESIDUI:
- [errore]: [motivo]
```
