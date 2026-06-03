# TASK: Rendere bilingui i content file delle pagine pubbliche

**Modalità di lavoro:** Esegui tutto in silenzio. NON mostrare codice intermedio, NON descrivere ogni modifica. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche ai file.

---

## Contesto

La struttura i18n funziona. NON toccare: LanguageProvider, LanguageSelector, SiteHeader, routing, architettura i18n.

Usa SOLO: `useLanguage()`, `dictionary`, `src/i18n/dictionaries/it.ts`, `src/i18n/dictionaries/en.ts`.

---

## Obiettivo

Rendere bilingui i content file che ancora alimentano pagine pubbliche in italiano.

---

## Content file da rendere bilingui (in ordine di priorità)

### 1. `howToStartContent`
- `entryPaths`
- `preview.cards`
- Quiz: domande, risposte, rami, risultati

### 2. `programsContent`
- Titoli e descrizioni step: Foundation 1, Foundation 2, Classe 1, Classe 1+
- Attività parallele: Pratica assistita, Classi tematiche
- Quiz orientamento: domande, risposte, risultati

### 3. `practiceContent`
- Descrizioni attività: Pratica assistita, Classi tematiche, Rope Jam, Open Day, Aperibottom, altri eventi presenti
- Card, CTA, badge, testi descrittivi

### 4. `shopContent`
- Peony Card dettagli
- Modalità corde
- Quiz card
- Form richiesta corde
- Testi descrittivi e CTA

### 5. `peonyAboutContent`
- nameStory, approach, space
- Community cards
- Insegnanti resident/ospiti se presenti
- CTA e label editoriali

---

## Struttura da usare per i content bilingui

Preferisci una di queste due opzioni, scegli in base a quanto già fatto nel progetto:

**Opzione A** — Content file bilingue con `it` / `en`:
```ts
export const myContent = {
  it: { title: "Titolo", cta: "Scopri" },
  en: { title: "Title", cta: "Discover" }
}
```
Il componente seleziona `myContent[lang]` dove `lang` viene da `useLanguage()`.

**Opzione B** — Spostamento nei dizionari `it.ts` / `en.ts`, se più coerente con quanto già fatto.

Mantieni la compatibilità con i componenti esistenti. Non cambiare nomi tecnici delle chiavi se non necessario.

---

## Traduzioni standard da usare (obbligatorie)

| Italiano | Inglese |
|---|---|
| percorsi | Learning Programs / Programs (in base al contesto) |
| pratica assistita | Assisted Practice |
| classi tematiche | Themed Classes |
| corde | ropes |
| biglietti | tickets |
| senza partner | without a partner |
| anche per single | You can join without a partner |
| Scopri | Discover / Explore |
| Vedi | View / See |
| Inizia | Start / Begin |
| Domanda | Question |
| Risultato | Result |
| Come arrivare | How to get here |
| Vai alla sezione | Go to section |

## Nomi da NON tradurre (invariati in EN)

- Peony Studio
- Foundation 1, Foundation 2
- Classe 1, Classe 1+ (se sono nomi format ufficiali del sito)
- Kurogami & Shiawase
- Riccardo Wildties & RedSabbath
- Peter Soptik & Sansei
- Rope Jam
- Open Day
- Aperibottom

---

## Regole

- Non cambiare layout, routing, logica Ticket Tailor, Supabase, calendario, login, area admin
- Usa inglese naturale, non traduzione letterale
- Non tradurre nomi propri o format ufficiali elencati sopra
- Non correggere commenti, nomi variabili o testi admin interni

---

## Controllo qualità

Dopo le modifiche, cerca queste stringhe italiane visibili nei componenti/content pubblici e correggile se trovate:
`"Scopri"`, `"Vedi"`, `"Inizia"`, `"Percorso"`, `"Pratica"`, `"Domanda"`, `"Risultato"`, `"Corde"`, `"Come arrivare"`, `"Vai alla sezione"`, `"biglietti"`, `"senza partner"`, `"anche per single"`

Poi esegui in sequenza e correggi tutti gli errori:
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

PAGINE ORA COMPLETAMENTE BILINGUE:
- [pagina]

NOMI INVARIATI INTENZIONALMENTE:
- [nome]: [motivo]

CONTENUTI ITALIANI ANCORA PRESENTI:
- [file/sezione]: [cosa resta e perché]

ERRORI RESIDUI:
- [errore]: [motivo]
```
