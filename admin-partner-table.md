# TASK: Admin Gestione Partner — vista tabella con filtri

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## Contesto

La sezione "Gestione Partner" in `src/app/admin/ticket-tailor/page.tsx` mostra attualmente card verticali. Va trasformata in una tabella compatta con filtri.

---

## Modifiche richieste

### 1. Sostituisci le card con una tabella

Colonne:
| Acquirente | Email acquirente | Evento | Data | Partner | Fonte | Azioni |

- **Acquirente**: `buyer_nickname || buyer_first_name || buyer_email`
- **Email acquirente**: `buyer_email`
- **Evento**: `event_title` (breve, troncato se lungo)
- **Data**: `event_starts_at` formattata (gg mmm)
- **Partner**: `partner_name || partner_email || —`
- **Fonte**: badge colorato — giallo "Da TT" se `ticket_tailor`, verde "Confermato" se `user`, grigio "—" se null
- **Azioni**: bottone "Modifica" che apre un piccolo form inline o modal per modificare partner_email/partner_name + Salva

Stile tabella: coerente con la tabella partecipanti già esistente nella pagina admin (sfondo chiaro, bordi sottili, righe alternate o hover).

---

### 2. Filtri sopra la tabella

Aggiungi una barra filtri con:

- **Cerca acquirente** — input testo che filtra per `buyer_nickname`, `buyer_first_name`, `buyer_email` (case-insensitive, client-side)
- **Evento** — select con "Tutti gli eventi" + lista eventi unici presenti nei dati
- **Fonte** — select con opzioni: Tutti | Da Ticket Tailor | Confermato | Non indicato
- Bottone **Reset filtri**

I filtri sono client-side (filtrano i dati già caricati, non ricaricano dal server).

---

### 3. Statistiche

Mantieni i 4 blocchi statistiche (Totale, Da confermare, Confermati, Non indicati) sopra i filtri.

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
