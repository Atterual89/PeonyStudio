# TASK: Dashboard redesign — fix navigazione, grafica e sezioni

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## Contesto

Il dashboard esiste e funziona. Non toccare logica Supabase, auth, Ticket Tailor, admin.

---

## 1. Colore sfondo

Schiarisci leggermente il colore di sfondo dell'area personale. Attualmente è quasi nero — portalo a un marrone scuro più caldo, tipo `#2a1a0e` o `#251508`. Aggiorna tutte le occorrenze del colore sfondo nei componenti del dashboard.

---

## 2. Navigazione — struttura definitiva

```
[Header: ← Torna al sito  |  Ciao [nome] + avatar animale guida]
[☰ menu hamburger — apre drawer con: Home, Eventi, Guida, Percorso, Profilo]
[Contenuto sezione attiva]
[BottomNav pubblica del sito — invariata, sempre visibile in basso]
```

- Rimuovi le tabs orizzontali (Home/Eventi/Guida/Percorso/Profilo) sempre visibili
- La navigazione interna va SOLO nel drawer hamburger
- Il drawer apre dallo stesso lato del bottone hamburger
- Header fisso in alto con: `← Torna al sito` (link a `/`) a sinistra, `Ciao [nome]` + avatar animale guida a destra
- Avatar animale guida: immagine quadrata piccola (`rounded-lg`, ~36px) da `public/images/animal-guides/[nome-animale].png`
- BottomNav pubblica resta invariata in basso — non toccarla

---

## 3. Sezione Home (Overview)

Struttura compatta mobile-first:
- Nessun titolo enorme — solo saluto discreto nell'header
- Card prossimo evento (se presente) con: nome, data, ora in fuso orario italiano
- Card animale guida compatta: immagine + nome + badge livello — NO descrizione (c'è nella sezione Guida)
- Link rapidi a Eventi, Percorso, Profilo — semplici righe cliccabili, non card grandi

---

## 4. Sezione Guida — fix ripetizioni

Struttura:
- Immagine animale guida grande ma non a tutto schermo (max 200px)
- **IMPORTANTE:** il nome e il badge livello appaiono SOLO come testo sotto l'immagine, NON anche dentro l'immagine (le immagini hanno già il testo stampato sopra — non aggiungere testo duplicato)
- Riga orizzontale compatta: `Presenze: [N]` — non "presenze considerate"
- Riga orizzontale compatta: `Prossima evoluzione a [N] presenze` — scritta UNA VOLTA SOLA
- Nessuna card separata che ripete le stesse informazioni

Layout righe: usa struttura orizzontale `label — valore` su una riga, non blocchi verticali separati.

---

## 5. Sezione Eventi — redesign

### Card evento iscritto
Mostra per ogni evento:
- Nome evento
- Data e ora (sempre in fuso orario italiano, formato: `gio 28 feb · ore 20:00`)
- Tipo evento (badge: Workshop / Classe / Rope Jam / ecc.)
- Bottone `Dettagli →` che apre una modal

### Modal dettagli evento
Contenuto della modal (prendi i dati dalla descrizione evento Ticket Tailor se disponibili):
- Nome evento + data/ora
- Prerequisiti e cosa portare (dalla descrizione evento)
- Sezione `Informazioni spazio` apribile — vedi testo fisso sotto

### Card fissa in fondo alla sezione eventi: "Informazioni spazio"
Card apribile (accordion o modal), sempre presente, con questo contenuto fisso:

---
**Peony Studio**
Via Vandalino 85/38, Torino (Citofono: UR Expression). Piano -1.
[Aprici su Google Maps](https://maps.app.goo.gl/CnoZpoZmgzP3Absg9)

**Come accedere**
- In metro: fermata Marche, uscita Via Eritrea — 5 minuti a piedi
- In auto: parcheggio su strada nei dintorni

**Indicazioni per l'arrivo**
- Non sostare in gruppo davanti all'ingresso
- Citofono: UR Expression
- Piano -1 (il piano terra è 0) — cerca la porta con una peonia
- Silenzio nelle scale: il palazzo è abitato da persone anziane

**Cerchi partner per l'evento?**
Lascia una richiesta nel [canale Telegram Peony Calls](https://t.me/+7a88epSRmP04MzA0) o compila il [modulo partner](https://forms.gle/8FtNkM9A6Phdegb26)

**Regole dello spazio**
- Spazio senza scarpe: toglile all'ingresso
- Borse nell'area indicata dallo staff
- Vietato fumare all'interno (incluso vape) — uscire dal palazzo
- No drink aperti nell'area workshop/corde: solo contenitori chiusi
- Acqua potabile disponibile in cucina
- [Vademecum completo](https://www.peonystudio.net/vademecum-rope-jam)

**Contatto emergenza**
+39 320 6486577 — WhatsApp/Telegram

**Pagamento quota**
Puoi pagare sul posto oppure via [Satispay](https://web.satispay.com/download/qrcode/S6Y-CON--992EF584-115F-4A05-8B24-E650872EB2A8?locale=it) (oggetto: nome evento + nome cognome)

**Iscrizione associazione**
Se hai acquistato un biglietto "Non associati" e non sei ancora iscritto ad UR Expression, completa l'iscrizione prima dell'evento:
[Modulo iscrizione](https://forms.gle/f6osniuC39UhXGoV8)
Se hai iscritto anche il/la partner, condividi il link del modulo.
---

**Nota:** aggiungi in cima alla card un avviso discreto: `Verifica gli orari definitivi — potrebbero variare.`

---

## 6. Sezione Profilo — verifica tessera

Aggiungi in cima alla sezione Profilo un banner stato tessera:
- Leggi il campo tessera/membership da Supabase (usa il campo esistente — non aggiungere colonne)
- Se tessera valida: banner verde discreto `✓ Tessera aggiornata`
- Se tessera scaduta o non presente: banner arancione `⚠ Verifica la tua tessera — contattaci per aggiornarla`
- Se non ci sono dati: nessun banner (non mostrare errori)

---

## 7. i18n

Aggiorna `it.ts` e `en.ts` con tutte le stringhe nuove:
- "Torna al sito" / "Back to site"
- Label sezioni, stati vuoti, titoli card
- Testi tessera: "Tessera aggiornata" / "Membership up to date", "Verifica la tua tessera" / "Check your membership"
- Il testo della card informazioni spazio può restare solo in italiano (è contenuto operativo locale)

---

## Controllo qualità

1. Verifica navigazione: hamburger apre drawer, BottomNav pubblica visibile
2. Verifica avatar animale guida nell'header
3. Verifica che nella sezione Guida il testo non sia duplicato rispetto all'immagine
4. Verifica card informazioni spazio nella sezione eventi
5. Verifica banner tessera nel profilo
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

FUNZIONA:
- [feature]

PROBLEMI O LIMITI:
- [problema]: [motivo]

ERRORI RESIDUI:
- [errore]: [motivo]
```
