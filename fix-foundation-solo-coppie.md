# TASK: Correggere Foundation 1 e Foundation 2 — sono percorsi per coppie, non per singoli

**Modalità di lavoro:** Esegui tutto in silenzio. NON mostrare codice intermedio, NON descrivere ogni modifica. Mostra SOLO il report finale in fondo a questo file. Conferma automaticamente tutte le modifiche ai file.

---

## Contesto

Nella pagina `/percorsi` (tab Percorsi, la corda con i nodi F1/F2/C1/C1+), sotto il nodo "Foundation 1" compare l'icona `User` (Lucide, significa "Anche per single / You can join solo"). È sbagliato: **Foundation 1 e Foundation 2 sono corsi per coppie**, non per chi viene da solo.

Trova dove sono definite le icone/tag per ogni nodo del percorso (probabilmente in un componente tipo `src/components/percorsi/ProgramsProgressPage.tsx`, `ProgramDetailPage.tsx`, o dove sono mappati i nodi F1/F2/C1/C1+ alle icone Lucide `User`, `Users`, `Sprout`, `BookOpen`, `Ribbon`, `Eye`).

## Cosa correggere

1. **Foundation 1**: sostituisci l'icona `User` (singolo) con `Users` (coppia). Mantieni le altre icone eventualmente già corrette (es. `Sprout` se presente resta).
2. **Foundation 2**: verifica lo stesso — se anche qui è presente `User` invece di `Users`, correggi allo stesso modo.
3. **Filtri in alto nella pagina** (quelli visibili come "Anche per single" / "Per coppie" / "Aperta" nello screenshot): se Foundation 1 e/o Foundation 2 risultano inclusi nel filtro "Anche per single" / "singoli", rimuovili da quel filtro — devono comparire solo sotto "Per coppie".
4. Verifica se lo stesso errore è presente anche nelle pagine di dettaglio dedicate `src/app/percorsi/foundation/` e `src/app/percorsi/foundation-2/` (o percorso equivalente), sia nel testo che in eventuali badge/icone.
5. Controlla anche i testi descrittivi di Foundation 1 e Foundation 2 (in `it.ts` / `en.ts`, chiavi tipo `programs.*` o `percorsi.*`): se il copy lascia intendere che si può partecipare da soli, correggi la formulazione per essere chiaro che è richiesta la coppia.

Non toccare Classe 1, Classe 1+, Pratica Assistita, Classi Tematiche, o altri nodi: la correzione riguarda **solo Foundation 1 e Foundation 2**.

Non toccare routing, layout, Ticket Tailor, Supabase, login/area admin.

---

## Controllo qualità

```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILE MODIFICATI:
- [file]: [descrizione breve del fix]

CORREZIONI APPLICATE:
- Icona Foundation 1: [prima → dopo]
- Icona Foundation 2: [prima → dopo, o "già corretta"]
- Filtro "Anche per single": [Foundation 1/2 rimossi? si/no]
- Testi descrittivi: [modificati o "già corretti"]

ERRORI RESIDUI:
- [errore]: [motivo]
```
