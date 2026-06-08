# TASK: Tab bar /peony — copia ESATTA da /percorsi

**Modalità:** Silenzio. Solo report finale.

---

## Obiettivo

La tab bar della pagina `/peony` deve diventare identica visivamente a quella di `/percorsi` (screenshot di riferimento: contenitore beige/grigio con bordi arrotondati, tab attivo = pill bianco con ombra, testo uppercase tracking-wide, font piccolo).

---

## Istruzioni

1. Apri il file che contiene la tab bar di `/percorsi` (probabilmente `src/components/programs/ProgramsPage.tsx` o `SectionTabSwitcher.tsx`)

2. Copia **esattamente** il JSX del contenitore tab bar e tutte le classi Tailwind usate, incluse:
   - classe del wrapper esterno (sfondo, padding, border-radius)
   - classe del tab inattivo
   - classe del tab attivo (pill bianco, shadow)
   - font size, tracking, uppercase

3. Apri `src/components/peony/PeonyPageClient.tsx`

4. Trova la tab bar esistente e **sostituiscila integralmente** con il codice copiato al punto 2, cambiando solo:
   - I nomi dei tab: `['About', 'Spazio', 'Team', 'Community']`
   - La variabile di stato `activeTab`

5. Non modificare nient'altro nella pagina.

---

## Verifica

Dopo la modifica:
- La tab bar di `/peony` deve essere visivamente indistinguibile da quella di `/percorsi`
- Il tab attivo deve avere il pill bianco con ombra
- Il contenitore deve avere lo sfondo beige/grigio arrotondato

```
npx.cmd tsc --noEmit
npm.cmd run build
```

---

## Report finale

```
FILE SORGENTE (percorsi): [nome file e riga da cui hai copiato]
FILE MODIFICATO (peony): [nome file]
CLASSI WRAPPER COPIATE: [elenca le classi Tailwind del wrapper]
CLASSE TAB ATTIVO: [classi del pill attivo]
ERRORI: [eventuale]
```
