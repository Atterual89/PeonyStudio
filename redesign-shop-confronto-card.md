# TASK: Redesign sezione confronto Peony Card / Token / Gift Card nello shop

**Modalità di lavoro:** Esegui tutto in silenzio. NON mostrare codice intermedio, NON descrivere ogni modifica. Mostra SOLO il report finale in fondo a questo file. Conferma automaticamente tutte le modifiche ai file.

---

## Contesto

Nella pagina shop (`src/app/shop/page.tsx` o componente collegato — cercalo tu, probabilmente si chiama qualcosa come `ComparisonSection` o è inline nella pagina) esiste una sezione "Differenze in breve" con 3 box: Peony Card, Peony Token, Gift Card / Voucher. Va ridisegnata seguendo lo stile qui sotto, mantenendo la struttura dati esistente e lo stack del progetto (Next.js, TypeScript, Tailwind, `useLanguage()` / dizionari `it.ts` / `en.ts`).

Non toccare Ticket Tailor, calendario, Supabase, login, routing, area admin. Non introdurre librerie esterne oltre a `lucide-react` (già in uso).

---

## Parte 1 — Sezione "Differenze in breve" (sempre visibile)

Tre card affiancate (stack verticale su mobile), ciascuna con:

- **Icona in cerchio colorato tenue** in alto:
  - Peony Card → icona `IdCard` (lucide-react), cerchio `bg-[#f0e0d3]`, icona `text-[#a8583e]`
  - Peony Token → icona `Ticket`, cerchio `bg-[#e9ecdf]`, icona `text-[#6b7a4f]`
  - Gift Card → icona `Gift`, cerchio `bg-[#f2e2e8]`, icona `text-[#9c5570]`
- **Titolo** in Lora, 18–20px, colore `#2a1f1a`
- **Tag "per chi..."** sotto il titolo, pillola arrotondata (`border-radius: 20px`), stesso colore di sfondo del cerchio icona, testo scuro coordinato:
  - Peony Card: "Per chi frequenta spesso"
  - Peony Token: "Per chi vuole flessibilità"
  - Gift Card: "Per chi vuole regalare"
- **Descrizione breve** (quella già esistente, non riscrivere il copy)
- **3 bullet con icona `Check`** (dallo stesso colore dell'icona della card), sotto un separatore sottile:
  - Peony Card: "Accesso prioritario" · "Sconti su workshop" · "Valida una stagione"
  - Peony Token: "Nessun abbonamento" · "Usa quando vuoi" · "Valido 12 mesi"
  - Gift Card: "Regalo pronto all'uso" · "Importo flessibile" · "Facile da usare"

**Elemento firma:** dietro le tre card, un filo SVG sottile e tratteggiato che le collega (richiamo alla corda, coerente col tema kinbaku). Stroke `#c9a688`, width 1.5px, `stroke-dasharray: 1 7`, posizionato assoluto dietro alle card (z-index inferiore), curva leggera tipo `Q` che passa da sinistra a destra. Deve restare molto discreto, non deve mai sovrapporsi al testo.

Sfondo generale della sezione: `#f2ede3` (o la variabile Tailwind già in uso per lo sfondo crema del sito, se esiste — usa quella invece dell'hex letterale). Card: sfondo `#faf7f0`, bordo `1px solid #e1d6c3`, radius `14px`.

---

## Parte 2 — Dettagli livelli (due box separati, ciascuno con il proprio accordion, chiusi di default)

Sotto la Parte 1, aggiungi **due box distinti**, ognuno con il proprio titolo e il proprio toggle indipendente (aprire l'uno non deve aprire l'altro):

**Box 1 — "Livelli Peony Card"**
- Header: titolo "Livelli Peony Card" in Lora (19px, `#2a1f1a`) a sinistra, toggle a destra
- Stato chiuso: testo "Vedi i dettagli" con icona `ChevronDown`
- Stato aperto: testo "Nascondi i dettagli" con icona `ChevronUp`
- Contenuto: la tabella livelli (vedi 2a)

**Box 2 — "Pacchetti Peony Token"**
- Header: titolo "Pacchetti Peony Token" in Lora (19px, `#2a1f1a`) a sinistra, toggle a destra
- Stesso comportamento di apertura/chiusura del Box 1, indipendente
- Contenuto: le card dei pacchetti + i chip dei token (vedi 2b)

Ogni box è un contenitore con sfondo `#faf7f0`, bordo `0.5px solid #e1d6c3`, radius `14px`, `overflow: hidden`. Il titolo resta sempre visibile anche a box chiuso (non sparisce con il contenuto).

Animazione di apertura leggera (max-height o Framer Motion, già in uso nel progetto — usa quello che è già presente per coerenza).

### 2a. Tabella livelli Peony Card

All'interno del Box 1, sopra la tabella aggiungi la didascalia "L'intensità del colore segue il livello" (13px, `#8a7a68`).

Tabella con 4 colonne (Bronze, Silver, Gold, Platinum) e queste righe (colonna sinistra = etichetta):

| Benefit | Bronze | Silver | Gold | Platinum |
|---|---|---|---|---|
| Quota associativa 2027 | ✓ | ✓ | ✓ | ✓ |
| Rope Jam e Open Day | ✓ | ✓ | ✓ | ✓ |
| Pratica Assistita e Classi Tematiche | — | ✓ | ✓ | ✓ |
| Sconto sui workshop | — | 5% | 10% | 10% |
| Coaching con Kurogami | — | — | 3h | 3h |
| Lezione privata Kurogami e Shiawase | — | — | — | 3h |
| Sconto sulle corde | — | — | — | 10% |

Stile:
- Nome del livello in Lora, con colore che si scurisce progressivamente da Bronze a Platinum (es. `#8a5a3a` → `#7a4a2a` → `#63381c` → `#3f2210`) per comunicare visivamente la progressione
- Check (`Check` icon) colore `#a8583e`
- Trattino (`Minus` icon) colore `#b4a998` per i benefit non inclusi
- Righe alternate leggermente (zebra: `#faf7f0` / `#f5f0e6`)
- Su mobile: scroll orizzontale della tabella (non impilare le colonne)

### 2b. Pacchetti Peony Token

All'interno del Box 2, sopra le card aggiungi la didascalia "Stesso costo per attività in tutti i pacchetti" (13px, `#8a7a68`).

Tre mini-card affiancate (6 / 12 / 24 crediti), **tutte uguali, nessuna evidenziata**:
- Sfondo `#f5f0e6`, bordo `0.5px solid #e1d6c3`, radius `14px`, stesso stile per tutte e tre
- Titolo "X crediti" in Lora
- "Massimo X utilizzi"
- "Validità 12 mesi"

Sotto le tre card, un blocco con:
- Etichetta "Quanti token servono per attività" (testo piccolo, colore `#4a3f35`, sempre visibile sopra i chip)
- Riga di chip arrotondati (`bg-[#f0e0d3]`, testo `#8a4126`): "Rope Jam / Peer Rope — 1 token" · "Open Day — 2 token" · "Pratica Assistita — 3 token" · "Classe Tematica — 4 token"
- Nota piccola sotto: "Richiede quota associativa valida, da completare separatamente" (colore `#a89b8a`)

---

## i18n

Tutte le nuove stringhe (tag "per chi...", bullet, etichette tabella, nomi livelli se non già presenti, chip token, toggle accordion) vanno aggiunte a `src/i18n/dictionaries/it.ts` e `src/i18n/dictionaries/en.ts` seguendo la struttura esistente, e lette tramite `useLanguage()` / `dictionary`. Non hardcodare testo IT nel componente.

Per l'inglese, traduci in modo naturale (es. "Per chi frequenta spesso" → "For regular attendees"), mantenendo i nomi propri (Rope Jam, Open Day, Peony Card, Peony Token, Kurogami, Shiawase) invariati.

---

## Controllo qualità

Dopo tutte le modifiche:
1. Verifica che la sezione resti identica nei contenuti numerici (percentuali, ore, numero di token) rispetto a questo file — sono dati reali delle membership su Ticket Tailor, non vanno alterati
2. Esegui in sequenza e correggi tutti gli errori:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILE MODIFICATI/CREATI:
- [file]: [descrizione breve]

COMPONENTI NUOVI:
- [nome componente]: [cosa fa]

STRINGHE AGGIUNTE A it.ts / en.ts:
- [elenco chiavi]

ERRORI RESIDUI:
- [errore]: [motivo]
```

---

FILE MODIFICATI/CREATI:
- `src/components/shop/ShopProducts.tsx`: aggiornata la sezione "Differenze in breve" con card visuali, filo SVG, due accordion indipendenti, tabella livelli Peony Card e dettagli pacchetti Peony Token.
- `src/i18n/dictionaries/it.ts`: aggiunte le stringhe italiane per card confronto, titoli box, toggle, caption, tabella livelli e dettagli token.
- `src/i18n/dictionaries/en.ts`: aggiunte le stringhe inglesi per card confronto, titoli box, toggle, caption, tabella livelli e dettagli token.
- `redesign-shop-confronto-card.md`: aggiunto questo report finale in fondo al file.

COMPONENTI NUOVI:
- `ComparisonDetailsBox`: contenitore accordion riusabile per i due box dettagli, con toggle indipendente.
- `CardLevelsTable`: tabella comparativa Bronze/Silver/Gold/Platinum con caption, zebra rows, scroll orizzontale mobile, icone Check/Minus.
- `TokenPackagesDetails`: dettagli pacchetti 6/12/24 crediti, caption, chip attività e nota associativa.

STRINGHE AGGIUNTE A it.ts / en.ts:
- `comparisonCards`
- `cardLevelsTitle`
- `tokenPackagesTitle`
- `comparisonDetailToggleShow`
- `comparisonDetailToggleHide`
- `cardLevelsCaption`
- `tokenPackagesCaption`
- `comparisonBenefitLabel`
- `comparisonLevels`
- `comparisonBenefitRows`
- `tokenCreditsLabel`
- `tokenMaxUsesLabel`
- `tokenValidityLabel`
- `tokenActivityLabel`
- `tokenActivityChips`
- `tokenAssociationNote`

ERRORI RESIDUI:
- Nessun errore residuo. `npx.cmd tsc --noEmit`, `npm.cmd run lint` e `npm.cmd run build` completati. `lint` segnala solo warning preesistenti in file fuori scope.
