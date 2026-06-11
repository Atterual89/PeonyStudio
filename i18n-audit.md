# TASK: Audit i18n — verifica completo cambio lingua IT/EN

**Modalità di lavoro:** Esegui in silenzio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## Obiettivo

Verificare che selezionando EN dal selettore lingua, tutte le pagine pubbliche cambino lingua correttamente. Correggere le stringhe italiane rimaste.

---

## Step 1 — Audit visivo (senza modificare nulla)

Simula la selezione della lingua EN e controlla ogni pagina/componente:

### Pagine da verificare:
- `/` (home)
- `/percorsi` (tutti e 4 i tab: Inizia, Percorsi, Workshop, Socialità)
- `/workshop`
- `/peony` (tutti i tab: About, Spazio, Team, Community)
- `/shop`
- `/calendario`
- Footer globale
- SiteHeader / menu navigazione

### Componenti specifici da controllare:
- Modal degli eventi (apertura dettagli evento)
- Card degli eventi nel calendario
- Stati vuoti ("Nessun evento", "Nessun workshop", ecc.)
- Badge e label sulle card (es. "Internazionale", "Solo coppie", ecc.)
- CTA e bottoni
- Accordion (es. "Come arrivare" in /peony)
- Quiz in tab Inizia
- Schede nodi in /percorsi (Foundation 1, ecc. — i testi descrittivi)
- Binario parallelo "In più:" / Pratica Assistita / Classi Tematiche

### Cosa cercare:
- Stringhe italiane hardcoded nei componenti `.tsx`
- Testi che vengono da `src/content/*.ts` senza selezione `it/en`
- Props con testo italiano hardcoded passate ai componenti
- Testi negli eventi Ticket Tailor (questi NON vanno tradotti — sono dati esterni)
- Modal o overlay con testo italiano fisso

---

## Step 2 — Correzioni

Per ogni stringa italiana trovata:
- Se è in un componente `.tsx` → spostala nel dizionario e usa `useLanguage()`
- Se viene da `src/content/*.ts` → aggiungi struttura `it/en` e seleziona in base alla lingua
- Se è un testo di evento Ticket Tailor → lasciala invariata (dati esterni, non traducibili)
- Se è un nome proprio o formato ufficiale (Foundation 1, Rope Jam, ecc.) → lasciala invariata

**Non tradurre:**
- Titoli di eventi da Ticket Tailor
- Nomi propri: Peony Studio, Foundation 1/2, Classe 1/1+, Rope Jam, Open Day, Aperibottom, Kurogami & Shiawase, Wildties & RedSabbath, Peter Soptik & Sansei, KinbakuLuXuria

---

## Step 3 — Controllo qualità

Esegui in sequenza:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
STRINGHE ITALIANE TROVATE E CORRETTE:
- [file]: [stringa] → [soluzione]

STRINGHE ITALIANE LASCIATE INVARIATE (e perché):
- [file]: [stringa]: [motivo]

PAGINE ORA COMPLETAMENTE BILINGUE:
- [pagina]

PAGINE/SEZIONI ANCORA PARZIALMENTE IN ITALIANO:
- [pagina/sezione]: [cosa resta]

ERRORI RESIDUI:
- [errore]: [motivo]
```
