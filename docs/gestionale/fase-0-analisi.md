# Gestionale Workshop — FASE 0: Analisi (solo lettura)

Leggi prima `docs/gestionale/00-contesto.md` e `docs/gestionale/specifica.md`.

**In questa fase NON modificare codice, configurazione o dipendenze.** L'unico file che puoi creare è `docs/gestionale/analisi.md`. Non creare il branch.

Lavora in silenzio. Mostra solo il report finale.

---

## Cosa verificare nel repository

Per ogni punto riporta il percorso dei file e una riga di conclusione.

1. **Next.js:** versione, App Router o Pages Router, presenza di `src/`, gruppi di rotte esistenti.
2. **Layout radice:** dove sono montati header, footer e BottomNav pubblici. Come nasconderli su `/gestione` con la modifica minima.
3. **Middleware:** esiste `middleware.ts`? Qual è il `matcher`? `/gestione` verrebbe intercettato?
4. **Area admin esistente:** rotte, come è protetta (ruolo, tabella, claim). Conferma che `/gestione` non entra in conflitto.
5. **Supabase:** dove sono creati i client (browser/server), nomi esatti delle variabili d'ambiente, presenza della service role key lato server e dove viene usata.
6. **Migrazioni:** esiste una cartella migrazioni? Come vengono applicate oggi (CLI, SQL editor, nessuna)? Convenzione dei nomi.
7. **Tabelle esistenti** rilevanti: profili, associati, Peony Card, ordini Ticket Tailor. Esiste già un elenco di persone o associati riutilizzabile per l'anagrafica?
8. **TeamArtist:** cerca nel codice (`teamartist`, `team-artist`, `team artist`, nessuna distinzione maiuscole/minuscole). Esiste un'integrazione? Non cercare API sul web: segnala solo cosa c'è nel codice.
9. **Netlify:** `netlify.toml`, versione di Node, runtime Next. `crypto.scrypt` e le route handler Node sono disponibili? (Non usare l'Edge runtime per il login.)
10. **Test:** esiste un test runner? Quale? Come si esegue?
11. **UI riutilizzabile:** pulsanti, input, card, modali, toast, font e token colore Tailwind già definiti.
12. **Sitemap e robots:** come sono generati, come escludere `/gestione`.

## Verifica delle decisioni

Per ciascuna decisione D1–D10 di `00-contesto.md` scrivi **OK** oppure **PROBLEMA**, con il motivo e un'alternativa concreta.

Verifica anche l'architettura delle sezioni 4.1 e 4.2: se qualcosa non è compatibile con il repository (es. la service role key non è disponibile, il middleware non si può limitare), segnalalo.

---

## Output

Scrivi `docs/gestionale/analisi.md` con tutte le risposte. Poi mostrami SOLO:

```
ARCHITETTURA ATTUALE (5 righe max):
- ...

PUNTI DI INTEGRAZIONE:
- Layout/BottomNav: [dove e come escludere /gestione]
- Middleware: [...]
- Supabase server: [file + nome variabile service role]
- Migrazioni: [cartella + metodo di applicazione]
- Test runner: [presente/assente]

DATI RIUTILIZZABILI PER L'ANAGRAFICA:
- ...

TEAMARTIST NEL CODICE:
- ...

DECISIONI:
- D1: OK / PROBLEMA — [motivo, alternativa]
- ...
- D10: ...

BLOCCHI CHE RICHIEDONO UNA MIA SCELTA:
- [solo quelli reali; "nessuno" se non ce ne sono]
```

Poi fermati. Non iniziare la Fase 1.
