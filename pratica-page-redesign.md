# TASK: Redesign pagina /pratica

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## Contesto

La pagina `/pratica` esiste già. Va migliorata visivamente e arricchita con frequenza attività e sistema icone al posto dei badge testuali.

Non cambiare: routing, LanguageProvider, SiteHeader, BottomNav, Supabase, auth, admin, logica calendario.
Usa la struttura i18n esistente: `useLanguage()`, dizionari `it.ts` e `en.ts`.

---

## Modifiche da fare

### 1. Titolo e sottotitolo

- Eyebrow: `PRATICA E SOCIALITÀ` / `PRACTICE & COMMUNITY`
- Titolo IT: `Pratica e socialità` / EN: `Practice & Community`
- Sottotitolo: rimuovi qualsiasi riferimento a "studio" — sostituisci con "spazio"
- Sottotitolo IT: `Spazi ricorrenti per allenarsi, consolidare, incontrare persone e partecipare alla vita dello spazio.`
- Sottotitolo EN: `Regular sessions to train, consolidate, meet people and take part in the life of the venue.`

---

### 2. Sistema icone — sostituisce i badge testuali

Rimuovi completamente i badge testuali attuali ("Anche per single", "Aperta a chi inizia", ecc.).

Sostituiscili con icone da **lucide-react** nell'angolo in basso a sinistra di ogni card.

**Set icone (usa esattamente questi componenti lucide-react):**

| Icona | Lucide component | Significato IT | Significato EN |
|---|---|---|---|
| Persona singola | `User` | Anche per single | You can join solo |
| Coppia | `Users` | Per coppie | For couples |
| Germoglio | `Sprout` | Aperta a chi inizia | Open to beginners |
| Libro | `BookOpen` | Richiede basi | Some experience needed |
| Nastro | `Ribbon` | Anche per bottom | Also for bottoms |
| Occhio | `Eye` | Observer ammessi | Observers welcome |

**Legenda:** aggiungi una legenda discreta una volta sola sopra le card (non ripetuta per ogni card). Mostra tutte e 6 le icone con il loro significato in una riga orizzontale scrollabile. Font piccolo, colore muted, stile coerente col sito.

**Assegnazione icone per attività:**
- Pratica assistita → `User`, `BookOpen`, `Sprout`
- Classi tematiche → `Users`, `BookOpen`, `Sprout`
- Rope Jam → `Eye`, `Sprout`, `User`
- Open Day → `Eye`, `Sprout`, `User`
- Aperibottom → `Ribbon`, `Sprout`, `User`

---

### 3. Frequenza attività

Aggiungi sotto il titolo di ogni card (prima della descrizione) una riga con la frequenza, in stile discreto (font piccolo, colore muted, con icona `Calendar` da lucide-react):

- Pratica assistita → IT: `Una volta al mese` / EN: `Once a month`
- Classi tematiche → IT: `Ogni due mesi` / EN: `Every two months`
- Rope Jam → IT: `Una volta al mese` / EN: `Once a month`
- Open Day → IT: `4 volte all'anno` / EN: `4 times a year`
- Aperibottom → IT: `Ogni due mesi` / EN: `Every two months`

---

### 4. Struttura due colonne Pratica / Socialità

Mantieni il filtro/toggle esistente con i due blocchi separati: **Pratica** e **Socialità**.

- Pratica: Pratica assistita, Classi tematiche
- Socialità: Rope Jam, Open Day, Aperibottom

Se il filtro attuale funziona già bene, non cambiare la logica — aggiungi solo le icone e la frequenza alle card.

---

### 5. i18n

Aggiungi in `it.ts` e `en.ts` nella sezione `practice`:
- Tutte le stringhe nuove (frequenze, legenda icone, titolo/sottotitolo aggiornati)
- Usa `useLanguage()` per selezionare la lingua corretta

---

## Controllo qualità

1. Verifica che le icone appaiano correttamente su tutte le card
2. Verifica che la legenda sia visibile e leggibile
3. Verifica che la frequenza appaia su ogni card
4. Cerca "studio" nel contesto visibile della pagina e sostituisci con "spazio"
5. Esegui:
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

BILINGUE:
- [sezione]

PROBLEMI O LIMITI:
- [problema]: [motivo]

ERRORI RESIDUI:
- [errore]: [motivo]
```
