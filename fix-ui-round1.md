# TASK: Correzioni grafiche e contenuto — round 1

**Modalità:** Esegui tutto in silenzio. NON mostrare codice intermedio. Solo report finale.

---

## 1. HOME — Sezione Orientamento (EntryDoorsSection)

I colori delle 4 card sono fuori palette rispetto al resto del sito. Sostituiscili con varianti della palette calda del sito (beige scuro, tortora, rosa antico, bordeaux morbido). Usa questi valori:
- Card 01 (bussola): `#3d2f24`
- Card 02 (percorso): `#2e3020`  
- Card 03 (workshop): `#252030`  
- Card 04 (community): `#321a28`

Questi sono già i valori correnti — se lo sono, tenta invece questo set alternativo più in linea con la palette generale:
- Card 01: `#4a3728`
- Card 02: `#3a3a2a`
- Card 03: `#2e2a3a`
- Card 04: `#3a2434`

In ogni caso, abbassa leggermente la saturazione e avvicina i toni al marrone-rosato dominante nel sito (`#c9a98a`, `#e8ddd4`). Le card devono sembrare parte della stessa pagina, non elementi estranei.

---

## 2. HOME — Sezione "Prossimi Appuntamenti"

Le card degli eventi e il titolo della sezione sono troppo piccoli. Intervieni su:

- **Eyebrow "PROSSIMI APPUNTAMENTI"**: aumenta da `text-xs` a `text-sm`, letterspacing invariato
- **Titolo evento nelle card** (es. "Pratica guidata - Lev UP"): porta a `text-lg font-medium` (era probabilmente `text-sm` o `text-base`)
- **Data e categoria nelle card**: porta a `text-sm` (da `text-xs`)
- **Larghezza card**: se sono su scroll orizzontale, aumenta la larghezza minima da ~160px a ~200px o più, in modo che i testi abbiano respiro

---

## 3. HOME — Footer

Il footer è troppo alto verticalmente. Compatta:
- Riduci padding verticale delle sezioni da `py-10` o simile a `py-6`
- Riduci gap tra colonne e tra elementi interni

**Sezione contatti nel footer:** il link email non è leggibile né cliccabile. Sostituisci il contenuto del blocco contatti con:
```
peony.studio.turin@gmail.com
```
Renderlo come `<a href="mailto:peony.studio.turin@gmail.com">` con colore visibile (usa il colore accent del sito, es. `#c9a98a` o il rosso-bruno usato per i link) e font-size almeno `text-sm`.

---

## 4. PEONY PAGE — Tab bar

La tab bar della pagina `/peony` usa uno stile diverso da quella di `/percorsi` (che ha bordo arrotondato, pill attivo, sfondo bianco/grigio). Allinea lo stile della tab bar di `/peony` esattamente a quello del componente `SectionTabSwitcher` già usato in `/percorsi`. Riusa il componente se possibile, altrimenti clona il CSS esatto.

---

## 5. PEONY PAGE — Sezione Contatti

La sezione contatti in `/peony` (e in tutte le altre pagine dove compare una sezione contatti con Google Form embed) va **sostituita** con un semplice bottone email.

In ogni punto del sito dove esiste una sezione "Contatti" / "Scrivici" con form embed, sostituisci con:

```tsx
<section id="contatti" className="px-5 py-10">
  <p className="text-xs tracking-widest uppercase text-[#b07a5a] mb-2">Contatti</p>
  <h2 className="font-serif text-3xl mb-4">Scrivici.</h2>
  <p className="text-sm text-[#6b5a4e] mb-6">
    Hai domande? Scrivici direttamente via email.
  </p>
  <a
    href="mailto:peony.studio.turin@gmail.com"
    className="inline-block w-full text-center bg-[#2a1f1a] text-white text-sm font-medium py-4 rounded-full"
  >
    peony.studio.turin@gmail.com
  </a>
</section>
```

Applica questa sostituzione in:
- `src/app/peony/page.tsx` (o wrapper client)
- Ogni altro componente che renderizza la sezione contatti con il Google Form embed

---

## 6. PERCORSI — Interazione palla del percorso

Quando l'utente clicca su una palla (nodo) del percorso (es. F1, F2, C1, C1+), il pannello con i dettagli del percorso si apre in basso ma non è evidente. Modifica il comportamento:

**Opzione A (preferita):** Quando si seleziona un nodo, scrolla automaticamente verso il basso fino alla sezione del percorso selezionato usando `scrollIntoView({ behavior: 'smooth', block: 'start' })`. Il nodo selezionato deve avere un anello esterno animato (pulse o scale) per confermare la selezione.

**Opzione B (alternativa):** Quando si seleziona un nodo, il blocco superiore (titolo + descrizione intro) si compatta con un'animazione `max-height` transition, lasciando spazio visibile al pannello del percorso selezionato senza scorrere.

Scegli l'opzione più compatibile con il codice esistente. In ogni caso, aggiungi un feedback visivo chiaro sul nodo selezionato (anello colorato o pulsazione).

---

## 7. PERCORSI — Tab "Altro", icona `+`

Nel tab "Altro" di `/percorsi`, il `+` nelle card espandibili non si vede bene. Assicurati che:
- Il `+` abbia colore esplicito: usa `text-[#b07a5a]` o `text-[#2a1f1a]` (non `text-current` né colori chiari su sfondo chiaro)
- Dimensione almeno `text-xl`
- Se è dentro un cerchio/bordo, assicurati che il bordo sia visibile (`border-[#b07a5a]` o simile)

---

## 8. SPAZIO (tab in /peony) — Titoli "Come arrivare" in italiano

Nella sezione "Come arrivare" del tab Spazio, i titoli delle voci sono in inglese. Sostituiscili:
- "By Plane" → "In aereo"
- "By Train" → "In treno"  
- "Public Transportation" → "Mezzi pubblici"

Questi testi vanno aggiornati sia nel componente che nel dizionario i18n (`it.ts` e `en.ts`). In `en.ts` rimettili in inglese.

---

## 9. SPAZIO — Descrizione "Main workshop area"

Nella card della "Main workshop area" (o equivalente), aggiungi alla descrizione esistente:

> La sala principale è dotata di aria condizionata e ventilazione.

In italiano. Aggiorna anche `en.ts` con:

> The main hall is equipped with air conditioning and ventilation.

---

## Controllo finale

Dopo tutte le modifiche:
```
npx.cmd tsc --noEmit
npm.cmd run lint  
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [cosa è cambiato]

MODIFICHE APPLICATE:
- [punto 1-9]: [stato]

ERRORI RESIDUI:
- [eventuale errore]: [motivo]
```
