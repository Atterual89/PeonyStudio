# TASK: Fix contenuti — rimuovi "scuola", fix "residenti", aggiorna bio insegnanti

**Modalità di lavoro:** Esegui in silenzio. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche.

---

## 1. Rimuovi il concetto di "scuola" ovunque nel sito

Cerca in tutto il progetto (`src/`, dizionari, content file, metadata) tutte le occorrenze di:
- "scuola"
- "school"
- nel contesto di Peony Studio (non in testi generici)

Sostituisci in base al contesto:
- IT: "scuola" → "spazio" oppure "venue" in base a cosa suona meglio
- EN: "school" → "venue" oppure "space"

Esempi di sostituzione:
- "una scuola di kinbaku" → "uno spazio per il kinbaku" (IT) / "a kinbaku venue" (EN)
- "la nostra scuola" → "il nostro spazio" (IT) / "our venue" (EN)

Non usare mai "scuola" o "school" riferito a Peony Studio in nessun testo visibile all'utente.

---

## 2. Fix label "Resident Teachers" / "Residenti"

- In italiano: sostituisci "Insegnanti residenti" e "La coppia residente" e qualsiasi variante con "Resident Teachers" (mantieni il termine inglese anche in IT, è un termine tecnico accettato nel mondo kinbaku)
- In inglese: "Resident Teachers" va bene, lascia invariato
- Cerca in: `src/components/peony/`, `src/content/`, `src/i18n/dictionaries/it.ts`

---

## 3. Aggiorna bio Kurogami & Shiawase

Trova dove è memorizzata la bio di Kurogami & Shiawase (probabilmente in `src/content/teacher-duos.ts` o simile) e sostituiscila con questo testo:

**IT:**
```
Insieme dal 2014, nel settembre 2016 iniziano a dedicarsi allo studio del kinbaku. A novembre dello stesso anno partecipano al loro primo corso tenuto da Riccardo Wildties. Questo incontro segna l'inizio di un viaggio ancora in corso, tra approfondimenti, ispirazione e ricerca continua.

Nel febbraio 2018 Andrea Kurogami diviene un educatore certificato di KinbakuLuXuria, sposando definitivamente i valori educativi di Wildties.

Durante gli anni Kurogami e Shiawase prendono attivamente parte a svariati eventi inerenti al kinbaku in Italia e in diverse città europee, sia come partecipanti durante le Jam che come studenti durante i corsi avanzati tenuti da Riccardo, nonché come performers ed educatori in eventi dedicati.

Nel 2019 Kurogami e Shiawase hanno avuto l'onore di legare al 25° Nawa Naka Kai a Tokyo, insieme a Riccardo e Red Sabbath e a Naka-san.
```

**EN:**
```
Together since 2014, in September 2016 they began dedicating themselves to the study of kinbaku. That November they attended their first course with Riccardo Wildties — the beginning of an ongoing journey of deepening, inspiration and continuous research.

In February 2018, Andrea Kurogami became a certified KinbakuLuXuria educator, fully embracing the educational values of Wildties.

Over the years, Kurogami and Shiawase have actively participated in kinbaku events across Italy and several European cities — as practitioners at jams, students in advanced courses with Riccardo, and as performers and educators at dedicated events.

In 2019, they had the honour of tying at the 25th Nawa Naka Kai in Tokyo, alongside Riccardo, Red Sabbath and Naka-san.
```

---

## 4. Aggiorna bio Riccardo Wildties & RedSabbath

Trova dove è memorizzata la bio di Wildties e sostituiscila con questo testo:

**EN** (testo ufficiale, mantieni in inglese anche nella versione IT del sito — è la voce originale dell'artista):
```
"Tormenting rope is made for souls that have that sadness within, that turmoil, that need for surrender regardless of who ties and who is tied. It's not about sadism and masochism, it's about a pilgrimage, it's about climbing a mountain together, it's about the journey not the destination."

Kinbaku LuXuria is a traditional style which directly descends from Naka-ryu. Riccardo (aka Wildties) introduced a technical re-engineering to make the style fit with Western body types without undermining its original spirit. Semenawa — the tormenting rope — is the word that best captures the mood of this style.

Riccardo is Naka-san's ichi-ban deshi and, according to the will of his sensei, he is designated to convey the style. Alongside numerous workshops and shows across Europe and North America with his partner Red Sabbath, he has performed at major Japanese events in Tokyo including Maniac Festival and Nawa Naka Kai.
```

**IT** (se il sito richiede versione italiana, usa questa):
```
«La corda che tormenta è fatta per le anime che hanno quella tristezza dentro, quel tumulto, quel bisogno di abbandono, indipendentemente da chi lega e da chi è legato. Non si tratta di sadismo e masochismo, si tratta di un pellegrinaggio, di scalare una montagna insieme, di un viaggio e non di una destinazione.»

Kinbaku LuXuria è uno stile tradizionale che discende direttamente dal Naka-ryu. Riccardo (aka Wildties) ha introdotto una rielaborazione tecnica per adattare lo stile ai fisici occidentali senza tradire lo spirito originale. Semenawa — la corda che tormenta — è la parola che meglio riassume il mood di questo stile.

Riccardo è l'ichi-ban deshi di Naka-san e, per volontà del suo sensei, è colui designato a trasmettere lo stile. Oltre a numerosi workshop e spettacoli in Europa e Nord America con la sua partner Red Sabbath, si è esibito in importanti eventi giapponesi a Tokyo tra cui il Maniac Festival e il Nawa Naka Kai.
```

---

## 5. Bio Peter Soptik & Sansei

Non aggiornare — lascia il testo esistente invariato.

---

## Controllo qualità

1. Cerca ancora "scuola" e "school" nel codice visibile all'utente e verifica che non ci siano occorrenze rimaste
2. Cerca "residenti" e "residente" nel contesto insegnanti e verifica la sostituzione
3. Esegui:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [descrizione breve]

SOSTITUZIONI EFFETTUATE:
- "scuola/school": [N occorrenze in N file]
- "residenti/residente": [N occorrenze in N file]
- bio Kurogami & Shiawase: [aggiornata/non trovata]
- bio Wildties: [aggiornata/non trovata]

OCCORRENZE RIMASTE (se presenti):
- [file]: [stringa]: [motivo]

ERRORI RESIDUI:
- [errore]: [motivo]
```
