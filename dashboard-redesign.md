# TASK: Redesign Area Personale (Dashboard)

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## Contesto

L'area personale esiste già e funziona. Va migliorata graficamente e corretta nei problemi di layout mobile. Non cambiare la logica Supabase, auth, dati utente, Ticket Tailor.

---

## Problemi da correggere

### 1. Header mobile — contenuto coperto dalla barra di sistema
Aggiungi `padding-top` sufficiente (usa `safe-area-inset-top` o equivalente Tailwind) per evitare che l'header del dashboard venga coperto dalla status bar del telefono.

### 2. Menu — bottone a destra, drawer si apre a sinistra
Correggi: se il bottone menu è in alto a destra, il drawer deve aprirsi da destra. Oppure sposta il bottone a sinistra e il drawer apre da sinistra. Scegli la soluzione più coerente col layout esistente.

### 3. Navigazione — pattern B

**Su mobile:**
- Rimuovi il drawer/menu laterale come navigazione principale su mobile
- La BottomNav pubblica del sito resta invariata in basso (non toccarla)
- Aggiungi nell'header del dashboard un tasto `← Torna al sito` in alto a sinistra che porta a `/` o alla pagina precedente
- La navigazione interna al dashboard (Overview, Eventi, Guida, Percorso, Profilo) va in un **drawer o menu** accessibile da un bottone nell'header, oppure come tabs orizzontali scrollabili sotto l'header

**Su desktop:**
- Il menu laterale sinistro può restare, ma deve includere in cima un link `← Torna al sito`

### 4. Voci menu — rinomina

| Vecchio | Nuovo |
|---|---|
| Overview | Home |
| I miei eventi | Eventi |
| Animale guida | Guida |
| Percorso | Percorso |
| Presenza | **RIMUOVI** |
| Tessera e profilo | Profilo |

---

## Redesign grafico

### Principi generali
- Mantieni il tema scuro (`#1a1008` o equivalente) — è l'identità visiva dell'area personale
- Font: stesso del sito, nessun cambio
- Stile: più moderno e compatto rispetto all'attuale, meno "riquadri vuoti"
- Card più vive ma non grandi: sfondi leggermente diversi tra loro, coerenti con la palette scura (variazioni di marrone scuro, bordeaux molto scuro, antracite)
- Niente colori accesi o fuori palette

### Card e numeri
- Sostituisci i numeri grandi isolati (tipo "1", "0") con stat compatte: numero piccolo + label su una riga, tipo badge o pill
- Esempio: invece di `1` enorme con label sotto → `● 1 presenza` in una riga compatta
- Le card devono avere contenuto visibile, non essere riquadri quasi vuoti

### Animale guida
- Presente nella Home (Overview) come elemento compatto: immagine quadrata media + nome + sottotitolo "presenza iniziale" o equivalente
- Non dominante, non enorme — pensalo come una card tra le altre
- **Avatar quadrati**: usa `rounded-lg` (non `rounded-full`) per tutti gli avatar degli animali guida
- Le immagini sono in `public/images/animal-guides/`
- Nomi file: `cervo-radicato.png`, `elefante-stabile.png`, `formica-esploratrice.png`, `gufo-osservatore.png`, `lupo-di-branco.png`, `tigre-determinata.png`, `volpe-curiosa.png`

### Tipografia
- Riduci l'uso di titoli molto grandi (tipo "Linea principale e corsie parallele" a tutto schermo)
- Usa gerarchie più compatte: eyebrow piccolo + titolo medio + testo breve
- Niente carattere "troppo antico" — se ci sono font serif molto decorativi nei titoli del dashboard, sostituiscili con il font principale del sito in peso normal o medium

### Sezione Home (Overview)
Struttura suggerita (compatta, mobile-first):
- Saluto: `Ciao [nome]` — testo medio, non enorme
- Stat bar compatta: presenze + prossimo evento in una riga
- Card animale guida: immagine quadrata + nome + badge livello
- Card prossimo evento (se presente) o stato vuoto discreto
- Link rapidi alle sezioni principali (Eventi, Percorso, Profilo)

### Rimuovi ripetizioni
- Se lo stesso contenuto appare in Overview e in una sezione dedicata, in Overview mostra solo un riassunto con link "Vai a →"
- Evita card con solo titolo e nessun contenuto reale

---

## i18n
Aggiorna `it.ts` e `en.ts` con tutte le stringhe rinominate (Home, Eventi, Guida, Percorso, Profilo, "Torna al sito" / "Back to site").

---

## Controllo qualità

1. Testa che su mobile l'header non venga coperto
2. Testa che il menu apra dal lato corretto
3. Testa che la BottomNav pubblica sia ancora visibile nell'area personale
4. Testa che il tasto "Torna al sito" funzioni
5. Verifica che le immagini animali guida si carichino correttamente con avatar quadrati
6. Esegui:
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

PROBLEMI CORRETTI:
- [problema]

MIGLIORAMENTI GRAFICI:
- [cosa è cambiato]

PROBLEMI O LIMITI:
- [problema]: [motivo]

ERRORI RESIDUI:
- [errore]: [motivo]
```
