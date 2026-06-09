# TASK: Dashboard Profilo — campo editabile nickname

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Contesto

La sezione Profilo del dashboard (`src/app/area-personale/PersonalAreaDashboard.tsx`) mostra già nome e email. La colonna `nickname` esiste già in `profiles`. Serve aggiungere un campo editabile per il nickname.

---

## Cosa aggiungere

Nella card "PROFILO" della sezione Profilo, sotto il nome e l'email, aggiungi:

- Label piccola: `NICKNAME`
- Campo input di testo con valore corrente `profile.nickname` (vuoto se null)
- Placeholder: `Come vuoi essere chiamato/a?`
- Bottone `Salva` affiancato al campo
- Al click Salva:
  - Esegui `supabase.from('profiles').update({ nickname: valore.trim() || null }).eq('id', profile.id)`
  - Usa il client Supabase browser (non admin) — il componente è già Client Component
  - Aggiorna il `displayName` nell'header in tempo reale (se esiste già uno stato per il nome visualizzato, aggiornalo)
  - Mostra feedback `Salvato ✓` per 2 secondi accanto al bottone
  - Se il campo viene svuotato e salvato, nickname torna null e il display ricade su first_name

## Stile

- Coerente con le altre card del profilo (stesso sfondo, testo `#f8efe5`)
- Input: bordo sottile, sfondo leggermente più chiaro, `rounded-lg`, `px-3 py-2`
- Bottone: stile outline piccolo, stesso stile degli altri bottoni del dashboard
- Feedback "Salvato ✓": testo verde piccolo, sparisce dopo 2s

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
FILES MODIFICATI:
- [file]: [descrizione]

ERRORI RESIDUI:
- [errore]: [motivo]
```
