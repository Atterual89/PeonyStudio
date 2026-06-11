# TASK: Dashboard Eventi — badge partner sulla card

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Contesto

Nel dashboard area personale, le card degli eventi mostrano titolo, data e categoria. Vogliamo aggiungere un badge visibile direttamente sulla card (senza dover aprire il dettaglio) che indichi lo stato del partner per gli eventi che lo richiedono (`requires_partner = true`).

---

## Cosa aggiungere

### Badge sulla card evento

Se `enrollment.events.requires_partner === true`, mostra un badge in fondo alla card (o sotto il titolo):

- **Partner mancante** (partner_email e partner_name entrambi null/vuoti):
  - `⚠️ 👥` in giallo/arancione tenue
  - Testo piccolo: `Indica il tuo partner`

- **Partner presente** (almeno uno dei due campi compilato):
  - `✓ 👥` in verde tenue
  - Testo piccolo: il valore salvato (partner_name se presente, altrimenti partner_email)

### Note

- Il badge deve essere visibile sulla card nella lista eventi, non solo nel dettaglio
- Stile coerente col resto delle card del dashboard
- Badge compatto, non invasivo — una riga piccola sotto il titolo o in fondo alla card
- Usa icona `Users` di Lucide React invece dell'emoji 👥 se già usata altrimenti
- Colori: giallo `text-yellow-400` / `text-amber-400` per mancante, verde `text-green-400` per presente

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
