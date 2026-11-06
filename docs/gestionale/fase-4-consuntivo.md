# Gestionale Workshop — FASE 4: Consuntivo e conguagli

Leggi prima `docs/gestionale/00-contesto.md` (fonte di verità: formule della sezione 5, ruoli D18, quota D19, etichette D17).
Prerequisito: migrazioni fino alla 017 applicate.

Lavora sul branch `feat/gestionale`. Esegui in silenzio. Mostra solo il report finale.

**Database:** nuova migrazione `018_gw_consuntivo_v4.sql` (+ `.down.sql`), che termina con `notify pgrst, 'reload schema';`. Non applicarla. **Non eseguire mai comandi che scrivono sul database reale**: prove solo in PGlite.
Dipendenza pre-approvata per questa fase: `exceljs`.

**Etichette:** le due parti sono **Peony** e **Ale** (da `labels.ts`), mai RedSabbath. Il valore interno `redsabbath` non cambia.

**Ruoli (D18):** il tab Conti è visibile ad **admin e organizzatrice** con lo stesso contenuto, salvo le note fiscali (sezione 2, blocco 8). Entrambi i ruoli possono aggiungere e modificare spese, trasferimenti e riporti, cambiare lo stato del consuntivo ed esportare. Le **percentuali** le modificano solo gli admin (Ale le vede in sola lettura). Ogni azione è controllata lato server.

---

## 1. Calcolo

- `src/lib/gestionale/settlement.ts`: funzione pura `computeSettlement(input)`, dove `input` contiene pagamenti, spese, percentuale, trasferimenti e riporti (in entrata e in uscita).
- Restituisce **tutte** le grandezze intermedie della sezione 5 più il residuo e la frase finale ("Ale deve trasferire € X a Peony").
- Le **entrate** sono la somma dei movimenti di `gw_payments` (pagamenti, rimborsi, rettifiche) di tutte le prenotazioni del workshop, cancellate comprese, divise per chi ha incassato.
- Tutti i valori in centesimi. Formattazione in euro (`it-IT`) solo in UI ed export.
- Il server carica i dati e chiama questa funzione. **Nessun calcolo duplicato** in SQL o nei componenti.

## 2. Tab Conti (Laura, Andrea e Ale)

Sostituisci il segnaposto del tab **Conti** (sezione 8 del contesto). Nessuna pagina separata. Il blocco 1 è sempre visibile; i blocchi 2–8 sono sezioni richiudibili, chiuse di default, che mostrano il totale anche da chiuse.

1. **Risultato** in evidenza: chi deve trasferire quanto a chi, oppure "Saldato". Sotto, lo stato del consuntivo. Se c'è un'iscrizione con quota mancante o residuo da incassare, un avviso: "Mancano X € da incassare: il risultato può cambiare".
2. **Entrate**: quanto è entrato in totale. Una riga **per prenotazione** con il **totale pagato** (la coppia è un solo importo; per Ale il nome è `entered_as`, mai dati dell'anagrafica). Sotto: totali per chi ha incassato (Peony / Ale) e per metodo. Solo lettura.
3. **Spese** (voli, cibo, alloggio…): elenco raggruppato per categoria con il totale di ogni categoria + "+ Spesa": **importo**, **categoria** (Viaggi · Vitto · Alloggio · Sala · Materiali · Altro, a pulsanti), **descrizione** breve, **anticipata da** (Peony · Ale), data facoltativa. Stesso stile del modulo di pagamento. Modificabili ed eliminabili dal menu "…" della riga, con storico. Nuova colonna `gw_expenses.category` (enum `gw_expense_category`, default `altro`) nella 018.
4. **Ripartizione**: percentuali (modificabili solo dagli admin; la percentuale di Ale è calcolata), entrate, spese, utile, quota Peony, quota Ale.
   Se l'utile è negativo (D6): al posto delle percentuali compare il riquadro **"Perdita da ripartire"** con il campo "Perdita sostenuta da Peony" (0 … perdita totale), la parte di Ale calcolata accanto e un'anteprima del residuo. Finché il campo è vuoto, il blocco Risultato mostra "Perdita da ripartire" invece del conguaglio.
5. **Posizione per parte**, una colonna per Peony e una per Ale: incassato, spese anticipate, quota utile, spettanza, posizione. "Quota utile" e "Rimborso spese" sono righe separate.
6. **Trasferimenti**: elenco + "+ Trasferimento" (da, a, importo, stato, data). "Segna come eseguito".
7. **Riporti**: in entrata (da altri workshop) e in uscita. "+ Riporta il residuo su un altro workshop" crea un riporto con l'importo e la direzione del residuo attuale, scegliendo il workshop di destinazione.
8. **Note fiscali personali di Ale**: campo di testo separato, con l'etichetta "Non incluse nei calcoli". **Visibile e modificabile solo dall'organizzatrice** (D7): agli admin non compare e i loader admin non lo selezionano.

In fondo: pulsanti di stato (sezione 3) ed export (sezione 4).

Su desktop: i blocchi 4–5 affiancati, i blocchi 2, 3, 6 e 7 in tabelle.

## 3. Stati

- Pulsanti: **Segna come verificato** → **Conguaglio da eseguire** → **Conguaglio eseguito**. Si può sempre tornare a **Provvisorio**.
- "Verificato" salva lo snapshot dei totali (sezione 5 del contesto).
- Se i totali attuali differiscono dallo snapshot: banner "Consuntivo modificato dopo la verifica — da ricontrollare", con l'elenco dei valori cambiati (prima → ora).
- Nessuno stato impedisce le modifiche.
- Nella dashboard la card del workshop mostra lo stato economico: **Aperto** / **Saldato** (saldato = residuo 0 e stato "conguaglio eseguito").

## 4. Esportazioni

- **Excel:** route handler sotto `/gestione/`, protetta da `requireOperator()` che genera un `.xlsx` con `exceljs`. Fogli: Riepilogo, Incassi, Spese, Conguagli. Importi come numeri con formato euro, non come testo. Nome file: `consuntivo-<slug-workshop>-<data>.xlsx`.
- **PDF:** pagina `/gestione/w/[id]/stampa` con layout pulito per A4 (CSS `@media print`), senza navigazione, con data di generazione e nome dell'operatore. Pulsante "Stampa / Salva come PDF" che chiama `window.print()`.
- Entrambi contengono: entrate per prenotazione (nome come `entered_as`, nessun dato anagrafico), spese per categoria, ripartizione dell'utile, posizioni, trasferimenti, riporti e risultato finale. **Non** contengono le note fiscali personali né lo stato socio.
- Ogni export viene registrato nello storico (azione `export`; aggiungila all'enum nella migrazione di questa fase).

## 5. Test

Tutti i 9 casi obbligatori della sezione 5 del contesto, più specifica sez. 18 gruppo "Consuntivo":
- spese anticipate da entrambe le parti
- conguaglio già pagato, poi modifica successiva → nuovo residuo
- utile esattamente zero
- verifica snapshot: modifica dopo la verifica → differenze rilevate

Più: spese per categoria e totali; Ale non può cambiare le percentuali (lato server); gli admin non ricevono le note fiscali (verifica delle chiavi restituite); export senza dati anagrafici.

Aggiungi un test di proprietà: per 200 input casuali (con utile positivo, oppure negativo con `loss_peony_cents` valido), `Posizione_P + Posizione_R = 0` e `Quota_P + Quota_R = Utile`.

---

## Report finale

```
FILES CREATI/MODIFICATI:
- [file]: [descrizione]

MIGRAZIONE DA APPLICARE:
- [file] + [rollback]

DIPENDENZE AGGIUNTE:
- exceljs [versione]

ORA FUNZIONA:
- ...

VERIFICA ESEMPIO SPECIFICA (caso 1): [valori calcolati]
VERIFICA PERDITA (caso 2): [valori calcolati]

TEST:
- [test]: OK/KO

SCELTE FATTE SU CASI AMBIGUI:
- ...

ERRORI RESIDUI:
- ...
```
