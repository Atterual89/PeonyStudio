# Fase B — Registro dei collegamenti fonte → persona

Migrazione: `supabase/migrations/050_gw_person_sources.sql` (rollback: `050_gw_person_sources.down.sql`).

## Cosa fa

Crea la tabella `gw_person_sources`: una riga per ogni riga di ogni fonte (modulo Google, modulo cartaceo, quota manuale, quota da email, libro ufficiale, biglietto TT intestatario e partner, iscrizione di Ale, contatto Excel di Ale), con la persona a cui appartiene e lo stato del collegamento:

| Stato | Significato |
| --- | --- |
| `automatico` | Una sola persona con email **e** nome+cognome coerenti |
| `confermato` | Collegamento già scelto da un admin (o da Ale per le sue iscrizioni) |
| `da_confermare` | Nessuna persona o più persone possibili: decide l'admin; `candidate_ids` elenca i candidati |
| `rifiutato` | L'admin ha deciso che non va collegata a nessuno |

**Non cambia nulla nel gestionale.** Nessuna schermata legge ancora questa tabella: serve a confrontare i collegamenti salvati con quelli che oggi il codice ricalcola. Le schermate la useranno dalla Fase C (coda "Da abbinare") e dalla Fase D (stato socio).

Regole applicate alla copia (decisioni dell'11 novembre 2026):

- automatico solo se email e nome+cognome indicano una sola persona;
- un'email condivisa da più persone va sempre in coda, anche se il nome ne indica una;
- il libro ufficiale entra solo se già collegato a una persona; altrimenti resta archivio e non va in coda;
- le quote confermate da email si leggono dalle allocazioni, non dalle righe `manual_override`;
- le email si confrontano con `gw_norm_email`, uguale a `normalizeMembershipEmail` del codice (Gmail: punti e `+etichetta` ignorati).

## Come applicarla

Nell'SQL editor di Supabase, in quest'ordine:

1. Esegui tutto il contenuto di `050_gw_person_sources.sql`.
2. Copia i collegamenti esistenti (si può rieseguire: non sovrascrive mai righe già presenti):
   ```sql
   select gw_backfill_person_sources();
   ```
3. Guarda il riepilogo:
   ```sql
   select * from gw_person_sources_summary order by source_kind, status;
   ```

## Controlli utili dopo il backfill

Righe in coda, per fonte, con i candidati:

```sql
select s.source_kind, s.seen_name, s.seen_email, s.note,
       array(select coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), p.nickname)
             from gw_people p where p.id = any (s.candidate_ids)) as candidati
from gw_person_sources s
where s.status = 'da_confermare'
order by s.source_kind, s.seen_name;
```

Persone con più moduli Google collegati (possibili doppioni da unire):

```sql
select p.first_name, p.last_name, p.email, count(*) as moduli
from gw_person_sources s join gw_people p on p.id = s.person_id
where s.source_kind = 'modulo_google'
group by p.id having count(*) > 1
order by moduli desc;
```

Moduli Google senza persona (oggi il trigger 045 li perde senza avviso):

```sql
select seen_name, seen_email, note
from gw_person_sources
where source_kind = 'modulo_google' and status = 'da_confermare'
order by seen_name;
```

Mandami il risultato del riepilogo: i numeri dicono quanto è grande la coda della Fase C.

## Rollback

`050_gw_person_sources.down.sql` rimuove tabella, vista, tipi e funzioni nuove. Non tocca nient'altro.

## Limiti noti

- I biglietti TT mai collegati non hanno ancora una riga: li aggiungerà la sincronizzazione Ticket Tailor nella Fase C.
- Il trigger 045 continua a creare persone dai moduli come oggi; dalla Fase C scriverà anche in questa tabella.
- Nel sistema attuale una persona ha un solo collegamento "legacy" al libro soci alla volta (quota manuale **oppure** nome **oppure** email): la nuova tabella non ha questo limite.
