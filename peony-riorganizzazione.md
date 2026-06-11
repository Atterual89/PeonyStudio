# TASK: Pagina Peony — riorganizzazione sezioni

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## File da modificare

- `src/components/peony/PeonyPageClient.tsx`
- `src/content/peony-about.ts` (se necessario)

---

## Modifiche richieste

### 1. Rimuovi il blocco nero nella tab ABOUT (L.131)

Rimuovi il blocco `bg-[#211815]` con `p.studioCommunity` e `p.studioText` e le decorazioni SVG assolute. Mantieni tutto il resto della tab ABOUT invariato.

**NON rimuovere** il blocco nero in tab COMMUNITY (L.303, Final CTA) — quello rimane.

---

### 2. Rimuovi le card Tecnica / Connessione / Estetica (L.141–148)

Rimuovi le 3 card `bg-white/42` generate da `content.approach.pillars.map(...)` nella colonna destra del grid hero. Se il grid diventa vuoto, rimuovi anche il grid e lascia solo la colonna sinistra (o rimuovi entrambe le colonne se erano solo per il blocco nero + pillars).

---

### 3. Correggi il testo della sezione Approccio

In `src/content/peony-about.ts`, nella sezione `approach`:
- Il campo `text` (o `textIt`) deve mostrare la poesia EN anche per la versione IT:

```
Kinbaku is going for depth.
It's not pride but sadness.
It's not a show of strength, it's sympathy.
It's not commanding, it's asking.
It's elegance, it's tact.
It's not tying a body, it's tying a person.
Kinbaku is offering something.
Kinbaku doesn't change anything.
It reveals what people have inside.
Kinbaku is educating.

Kinbaku is writing a letter: rope is just the pen we use.
```

Questo testo va usato sia per IT che per EN — è una citazione in inglese che rimane in inglese in entrambe le versioni.

---

### 4. Tab SPAZIO — sostituisci ImageMosaic con 3 blocchi foto cliccabili

Nella tab SPAZIO, sostituisci `<ImageMosaic />` con 3 blocchi verticali (uno per riga su mobile, affiancati su desktop) associati alle card esistenti:

- **Main workshop area** → foto `/images/peony-gallery/sala.jpg`
- **Lounge & kitchen** → foto `/images/peony-gallery/lounge.jpg`  
- **Comfort** → foto `/images/peony-gallery/comfort.jpg`

Ogni blocco ha:
- Foto cliccabile (larghezza piena, aspect-ratio 4/3 o 16/9, `object-cover`)
- Al click si apre un lightbox/modal con la foto ingrandita e un bottone × per chiudere
- Sotto la foto: titolo e descrizione della card corrispondente
- Mantieni la `<CardGrid numbered />` esistente OPPURE integrala dentro questi blocchi — scegli la soluzione più pulita

Il lightbox deve:
- Coprire tutto lo schermo con overlay scuro `bg-black/80`
- Mostrare la foto centrata con `max-h-screen max-w-screen object-contain`
- Chiudersi cliccando sull'overlay o sul bottone ×
- Usare stato React `lightboxImage: string | null`

---

### 5. Aggiungi id="gallery" alla sezione Gallery

Al `SectionShell` della gallery (L.208), passa `id="gallery"` così è navigabile con anchor.

---

### 6. Sposta "Dove siamo" dalla tab SPAZIO alla tab ABOUT

- Copia la `<section>` "Dove siamo" (L.216–254) dentro la tab ABOUT, in fondo (dopo tutte le sezioni esistenti)
- Rimuovila dalla tab SPAZIO

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
