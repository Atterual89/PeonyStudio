# TASK: Ristrutturazione navigazione Percorsi — 4 tab, Socialità, icone, footer contatti

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## Contesto

La pagina `/percorsi` ha già tab Percorsi/Workshop. Va estesa con 4 tab, la pagina `/pratica` va eliminata, il footer va reso consistente. Non toccare Supabase, auth, Ticket Tailor, admin.
Usa la struttura i18n esistente: `useLanguage()`, dizionari `it.ts` e `en.ts`.

---

## 1. Tab navigation — 4 tab in `/percorsi`

Sostituisci i tab esistenti con questi 4, nell'ordine:

| IT | EN |
|---|---|
| Inizia | Start |
| Percorsi | Programs |
| Workshop | Workshop |
| Socialità | Social |

**Stile:** stesso stile browser-tab già implementato. Se i 4 tab non entrano, riduci il font-size dei tab (es. `text-sm` o `text-xs`) — non usare scroll orizzontale, tutti e 4 devono essere visibili contemporaneamente.

---

## 2. Tab "Inizia" — contenuto inline da `/come-iniziare`

- Mostra inline il contenuto del componente `HowToStartPage` (o equivalente) già esistente
- NON fare redirect a `/come-iniziare` — renderizza il componente direttamente nel tab
- Da tutte le altre parti del sito dove c'è "Come iniziare" o "Voglio iniziare" come link/bottone, aggiorna la destinazione a `/percorsi?tab=inizia` oppure `/percorsi#inizia` — scegli il pattern più coerente con il routing esistente
- La pagina `/come-iniziare` può restare come redirect a `/percorsi` (tab Inizia) oppure essere mantenuta — non eliminarla, potrebbe avere link esterni

---

## 3. Tab "Percorsi" — aggiungi icone legenda e prossime date

### Legenda icone
Aggiungi la stessa legenda icone già presente in `/pratica` anche nel tab Percorsi, sopra la corda con i nodi.

Le icone da mostrare in legenda:

| Icona Lucide | IT | EN |
|---|---|---|
| `User` | Anche per single | You can join solo |
| `Users` | Per coppie | For couples |
| `Sprout` | Aperta a chi inizia | Open to beginners |
| `BookOpen` | Richiede basi | Some experience needed |
| `Ribbon` | Solo per bottom | For bottoms only |
| `Eye` | Observer ammessi | Observers welcome |

### Icone su ogni blocco
Aggiungi le icone pertinenti su ogni percorso/attività nel tab Percorsi:

- Foundation 1 → `User`, `Sprout`
- Foundation 2 → `User`, `BookOpen`
- Classe 1 → `Users`, `BookOpen`
- Classe 1+ → `Users`, `BookOpen`
- Pratica Assistita (binario parallelo) → `User`, `BookOpen`, `Sprout`
- Classi Tematiche (binario parallelo) → `Users`, `BookOpen`, `Sprout`

### Prossime date
Aggiungi nel tab Percorsi, sotto la scheda del nodo selezionato, un link/bottone:
- IT: `Vedi prossime date →` → link al calendario filtrato per percorsi se possibile, altrimenti `/calendario`
- EN: `View upcoming dates →`

---

## 4. Tab "Socialità" — nuovo tab con contenuto da `/pratica`

Sposta nel tab Socialità le attività social (che erano in `/pratica`):
- Rope Jam
- Open Day  
- Aperibottom
- Incontri bottom

Mantieni per ogni attività:
- Descrizione
- Frequenza (con icona `Calendar`)
- Icone pertinenti:
  - Rope Jam → `Eye`, `Sprout`, `User`
  - Open Day → `Eye`, `Sprout`, `User`
  - Aperibottom → `Ribbon`, `Sprout`, `User`
  - Incontri bottom → `Ribbon`, `Sprout`
- Legenda icone in cima (stessa degli altri tab)
- Bottone `Guarda le prossime date →` → `/calendario`

---

## 5. Elimina pagina `/pratica`

- Elimina o svuota `src/app/pratica/page.tsx` — sostituiscila con un redirect a `/percorsi` (tab Socialità):
```tsx
import { redirect } from 'next/navigation'
export default function PraticaPage() {
  redirect('/percorsi')
}
```
- Aggiorna tutti i link nel sito che puntano a `/pratica` → `/percorsi` (o `/percorsi?tab=socialita` se implementi query param)
- Controlla: menu navigazione, footer, componenti home, pagina peony community tab

---

## 6. "Pronto/a" e "Scrivici su Instagram" — aggiorna link

Cerca in tutto il sito:
- `"Scrivici su Instagram"` → cambia testo in IT: `Scrivici` / EN: `Contact us` e cambia link a `/peony#contatti`
- `"Pronto/a a fare il primo passo?"` o simili CTA → aggiorna il link "Come iniziare" a `/percorsi` (tab Inizia)
- Qualsiasi bottone/link con testo "Come iniziare" → destinazione `/percorsi`

---

## 7. Footer — contatto stabile

Il footer deve essere presente e consistente su tutte le pagine pubbliche. Aggiungi nel footer esistente (non crearne uno nuovo):
- Link `Contattaci` / `Contact` → `/peony#contatti`
- Verifica che il footer sia incluso in `src/app/layout.tsx` o nel layout delle pagine pubbliche — se non è globale, rendilo globale

---

## 8. Sezione home "Guarda prima di scegliere" — sostituisci

Sostituisci la sezione "Guarda prima di scegliere" (Gallery + Social) con una CTA verso la pagina Peony:
- Eyebrow IT: `PEONY STUDIO` / EN: `PEONY STUDIO`
- Titolo IT: `Vuoi saperne di più?` / EN: `Want to know more?`
- Testo IT: `Scopri lo spazio, il team e la community.` / EN: `Discover the space, the team and the community.`
- Bottone IT: `Scopri Peony →` / EN: `Discover Peony →` → link a `/peony`

---

## 9. i18n

Aggiorna `it.ts` e `en.ts` con tutte le stringhe nuove:
- Nomi tab: Inizia/Start, Percorsi/Programs, Workshop/Workshop, Socialità/Social
- Legenda icone (se non già presente)
- CTA home aggiornata
- "Scrivici" / "Contact us"
- "Contattaci" footer / "Contact" footer

---

## Controllo qualità

1. Verifica che tutti e 4 i tab siano visibili senza scroll
2. Verifica che il tab Inizia mostri il contenuto di HowToStart inline
3. Verifica che `/pratica` faccia redirect a `/percorsi`
4. Verifica che tutti i link "Come iniziare" nel sito portino a `/percorsi`
5. Verifica che "Scrivici" porti a `/peony#contatti`
6. Verifica che il footer abbia "Contattaci" su tutte le pagine
7. Esegui:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI/CREATI:
- [file]: [descrizione breve]

FUNZIONA:
- [feature]

LINK AGGIORNATI:
- [da] → [a]

PROBLEMI O LIMITI:
- [problema]: [motivo]

ERRORI RESIDUI:
- [errore]: [motivo]
```

---

## 10. Footer — aggiornamento completo

Aggiorna il footer esistente (non crearne uno nuovo) con questa struttura:

**Layout:** 2 colonne su mobile, 3 colonne su desktop.

**Colonna 1 — Brand:**
- Nome: `PEONY STUDIO`
- Tagline IT: `Kinbaku venue · Torino` / EN: `Kinbaku venue · Turin`
- Icone social con link:
  - Instagram: `https://www.instagram.com/peony.studio.turin`
  - Telegram: `https://t.me/peony_studio_turin`
  - Usa icone lucide-react (`Instagram` non esiste in lucide — usa svg inline o icona `Send` per Telegram, `ExternalLink` per Instagram oppure cerca icone social disponibili nel progetto)

**Colonna 2 — Studio:**
- Eyebrow: `STUDIO`
- `Peony` → `/peony`
- IT: `Come iniziare` / EN: `Get started` → `/percorsi`
- IT: `Calendario` / EN: `Calendar` → `/calendario`

**Colonna 3 — Attività:**
- Eyebrow IT: `ATTIVITÀ` / EN: `ACTIVITIES`
- `Percorsi` / `Programs` → `/percorsi`
- `Workshop` → `/percorsi` (tab Workshop)
- `Socialità` / `Social` → `/percorsi` (tab Socialità)
- `Shop` → `/shop`
- IT: `Area personale` / EN: `My account` → `/area-personale`

**Sotto tutto (full width):**
- Link IT: `Contattaci` / EN: `Contact us` → `/peony#contatti`
- Copyright: `© Peony Studio · Torino`

**Regole:**
- Il footer deve essere nel layout globale (`src/app/layout.tsx`) — visibile su tutte le pagine pubbliche
- NON visibile nell'area personale (`/area-personale`) — escludi con una condizione sul pathname
- Rimuovi "Pratica & Community" e sostituisci con "Socialità"
- Aggiorna `it.ts` e `en.ts` con tutte le label del footer
