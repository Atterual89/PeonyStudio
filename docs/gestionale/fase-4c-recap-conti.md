# Gestionale Workshop — FASE 4c: Home con recap economico e Conti semplificati

Leggi prima `docs/gestionale/00-contesto.md`. Lavora sul branch `feat/gestionale`. Esegui in silenzio. Mostra solo il report finale.
Nessuna scrittura sul database reale. Se serve una migrazione: `021_...` (+ `.down.sql`, notify finale), non applicata. Probabilmente non serve.

Aggiorna `00-contesto.md` (sezioni 8 e 9) con la nuova struttura: decisione **D23**.

---

## D23 — Recap economico in home, Conti per workshop, niente tab Pagamenti

**Definizioni (uguali ovunque, calcolate da `computeSettlement` / funzioni già esistenti, nessun calcolo duplicato):**
- **Entrate** = somma dei movimenti validi dei partecipanti (pagamenti − rimborsi ± rettifiche, esclusi gli eliminati), cancellati compresi.
- **Uscite** = somma delle spese valide.
- **Rimane** = Entrate − Uscite (è l'utile del consuntivo).
- **Da incassare** = somma dei residui positivi delle iscrizioni non cancellate e non in lista d'attesa (con quota definita).

### 1. Home `/gestione` (tutti e tre gli operatori, stesso contenuto)

In cima, **mini dashboard totale** con 4 riquadri: **Entrate · Uscite · Rimane · Da incassare**, sommati su tutti i workshop dell'anno selezionato.
- Selettore d'anno piccolo sopra i riquadri (predefinito: anno corrente; opzione "Tutti"). L'anno è quello della data di inizio del workshop.
- Sotto i riquadri, una riga: "Conguagli da fare: Ale → Peony X € · Peony → Ale Y €" (somma dei residui dei workshop non saldati), solo se diversi da zero.

Sotto, **la lista dei workshop**, in quest'ordine: **In corso** (primo gruppo, aperto, card evidenziata; il gruppo non compare se non ce ne sono), poi **Prossimi** (aperto, dal più vicino), poi **Passati** (chiuso, dal più recente). Se non c'è un workshop in corso, il primo dei Prossimi viene evidenziato allo stesso modo. Ogni card mostra in più una riga economica compatta: **"Entrate 5.200 € · Uscite 1.150 € · Rimane 4.050 €"**, e il badge Aperto / Saldato. Un workshop senza movimenti mostra "Nessun movimento".
- Su desktop la lista diventa una tabella con colonne Workshop · Date · Iscrizioni · Entrate · Uscite · Rimane · Stato, ordinabile, con riga Totale in fondo.
- Per Ale: nessun dato anagrafico (vale già), stessi numeri.
- Prestazioni: i totali di tutti i workshop si calcolano con **una** lettura aggregata lato server (funzione Postgres o query raggruppata), non un caricamento per workshop.

### 2. Tab Conti del workshop (riorganizzato)

In cima, sempre visibili: **Entrate · Uscite · Rimane** (tre riquadri) e sotto, piccolo, "Da incassare ancora: X €".

Poi sezioni richiudibili, chiuse di default, con il totale visibile anche da chiuse:
1. **Entrate dai partecipanti · N iscrizioni** → aperta: una riga per prenotazione "Claudia + Francesco · 450 €" (nome come `entered_as` per Ale). **Tocco sulla riga → dettaglio dei pagamenti** di quella prenotazione (data · tipo · metodo · importo), in sola lettura per gli admin; per Ale un link "Gestisci in Iscrizioni". In fondo: totali per chi ha incassato (Peony / Ale) e per metodo.
2. **Spese · N categorie** → aperta: totale per categoria; tocco sulla categoria → le singole spese, con il menu "…" (Modifica, Elimina) e "+ Spesa".
3. **Divisione Peony / Ale** → il blocco del conguaglio: risultato ("Ale → Peony X €"), ripartizione, posizioni per parte, trasferimenti, riporti, perdita da ripartire se l'utile è negativo, stati del consuntivo.
4. **Note fiscali** (solo Ale, come ora).

In fondo: export Excel e stampa PDF.

### 3. Tab per ruolo

- **Admin:** Partecipanti · Conti · Info. Il tab **Pagamenti viene eliminato**: il suo contenuto è in Conti → Entrate. `?tab=pagamenti` reindirizza a `?tab=conti`.
- **Ale:** Iscrizioni · Conti · Info (invariato).

---

## Test

- I numeri di home, card e tab Conti coincidono per lo stesso workshop (test con dati inventati: iscrizioni, coppie, rimborsi, pagamenti eliminati, spese eliminate, cancellati con soldi).
- Totali della home = somma dei workshop dell'anno; "Tutti" = somma di tutti.
- Workshop senza movimenti; workshop con utile negativo.
- Ale: home e Conti senza dati anagrafici (verifica delle chiavi restituite).
- `?tab=pagamenti` per admin → Conti.

Poi tsc, lint del gestionale, build, `test:gestionale`, `test:gestionale:sql`. Commit "gestionale: recap economico in home e conti semplificati". Niente push. Report breve.
