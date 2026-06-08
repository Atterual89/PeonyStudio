# TASK: Sposta "Chiedi informazioni" in fondo alla pagina Percorsi

## Problema
Il bottone "Chiedi informazioni" è stato inserito dentro il componente del dettaglio percorso (dove appaiono le date e il bottone Prenota). Va rimosso da lì.

## Modifica

1. **Rimuovi** il bottone "Chiedi informazioni" e il testo "Hai domande sui percorsi?" da dentro il componente dettaglio percorso (il blocco con "PROSSIME DATE", date, e bottone Prenota)

2. Apri il file della pagina `/percorsi` — probabilmente `src/app/percorsi/page.tsx` o `src/components/programs/ProgramsPage.tsx` — quello che compone l'intera pagina con i tab (Inizia / Percorsi / Workshop / Socialità / Altro)

3. Nel tab "PERCORSI", dopo che sono stati renderizzati tutti i componenti (nodi, dettaglio percorso, pratica assistita, classi tematiche), aggiungi come **ultimissimo elemento** prima della chiusura del tab:

```tsx
<div className="mt-10 px-4 pb-4">
  <p className="text-xs text-[#6b5a4e] mb-3">
    Hai domande sui percorsi? Scrivici direttamente.
  </p>
  <button
    onClick={() => setContactModalOpen(true)}
    className="w-full border border-[#2a1f1a] text-[#2a1f1a] text-sm py-3 rounded-full"
  >
    Chiedi informazioni
  </button>
</div>
```

Se `setContactModalOpen` è definito in un componente figlio, spostalo (con tutta la modale) nel componente padre della pagina percorsi, oppure usa un approccio con prop callback.

```
npx.cmd tsc --noEmit
npm.cmd run build
```

Report: da dove è stato rimosso + dove è stato aggiunto.
