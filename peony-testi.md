# TASK: Modifiche testi pagina Peony

**Modalità di lavoro:** Esegui in silenzio. NON mostrare codice intermedio. Mostra SOLO il report finale.

---

## File da modificare

- `src/components/peony/PeonyPageClient.tsx`
- `src/components/peony/TeacherDuosGrid.tsx`

Leggi entrambi i file prima di fare qualsiasi modifica.

---

## Modifiche richieste

### 1. Testo introduttivo dello studio

**Vecchio:** `Peony Studio è uno spazio dedicato allo studio delle corde`
**Nuovo IT:** `Peony Studio è uno spazio dedicato allo studio del rope bondage giapponese`

**Vecchio:** `Sala, lounge, pratica, incontri`
**Nuovo:** `Una sala per praticare, una lounge per chiacchierare`

**Rimuovi** la riga/sezione con: `Torino · Kinbaku · Community`
**Rimuovi** la riga/sezione con: `Uno spazio per studiare la corda come tecnica, relazione e presenza.`

### 2. Sezione nome Peony

**Vecchio titolo:** `Una peonia, un riferimento, una dedica.`
**Nuovo titolo:** `Da dove deriva il nome Peony`

**Vecchio testo IT:** `Il nome Peony nasce da un riferimento legato al Giappone, a Naka San e al simbolo della peonia. Lo studio è dedicato alla sua eredità e alla peonia come immagine di bellezza, presenza e memoria. Il logo Peony è handmade by Elemiaow.`

**Nuovo testo IT:** `Decidere il nome non è stato semplice. Come studio di kinbaku, è stato naturale cercare ispirazione nel Giappone. Approfondendo la nostra storia, il nostro "perché" e le ispirazioni raccolte nel tempo, siamo arrivati a una scelta profonda: dedicare questo studio alla duratura eredità di Naka San e al suo tatuaggio simbolico della peonia. Il logo di Peony Studio è handmade by Elemiaow.`

**Nuovo testo EN:** `Deciding on the name was no simple task. As a kinbaku studio, it was instinctive to draw inspiration from Japan. However, delving into our narrative, our "why," and the inspirations gathered over the years led us to a profound decision. We have chosen to dedicate this studio to the enduring legacy of Naka San and his symbolic Peony tattoo. The studio's logo is handmade by Elemiaow.`

Il testo "Elemiaow" deve essere un link cliccabile verso `https://instagram.com/elemiaow` (target _blank).

### 3. Sezione filosofia

**Vecchio:** `Tecnica, connessione, estetica.`
**Nuovo:** `Tecnica, personalità, estetica`

**Vecchio testo IT:** `Per noi il kinbaku non è solo tecnica: è una comunicazione silenziosa che coinvolge corpo, respiro, estetica e intenzione. L'approccio di Peony Studio è ispirato al Kinbaku LuXuria style, dove la corda diventa strumento di ascolto, relazione, ritmo, presenza, tensione, abbandono, controllo e fiducia.`

**Nuovo testo EN** (aggiungi versione inglese se manca):
```
Kinbaku is going for depth.
It's not pride but sadness.
It's not a show of strength, it's sympathy.
It's not commanding, it's asking.
It's elegance, it's tact.
It's not tying a body, it's tying a person.
Kinbaku is offering something.
Kinbaku doesn't change anything.
It reveals what people have inside.
Kinbaku is educating.

Kinbaku is writing a letter: rope is just the pen we use.
```
Mantieni il testo IT esistente invariato.

### 4. Sezione fondatori

**Vecchio:** `Peony Studio nasce dal lavoro condiviso di Kurogami e Shiawase: insegnamento, pratica, relazione e ricerca nelle corde`
**Nuovo:** `...relazione, pratica, insegnamento e ricerca nel kinbaku`
(sostituisci solo la parte dopo i due punti)

**Rimuovi i tag** dalle sezioni del team (es. badge/chip con ruoli ripetitivi sotto i nomi).

### 5. Citazione

La citazione esistente deve essere mostrata **solo in inglese**:
`"Tormenting rope is made for souls that have that sadness within, that turmoil, that need for surrender regardless of who ties and who is tied. It's not about sadism and masochism, it's about a pilgrimage, it's about climbing a mountain together, it's about the journey not the destination."`

Se c'è una versione IT della stessa citazione, rimuovila o sostituiscila con questa EN.

### 6. Sezione "Chi è passato da Peony" / altri insegnanti

**Vecchio titolo:** `Chi è passato da Peony`
**Nuovo titolo IT:** `Altri insegnanti al Peony`
**Nuovo titolo EN:** `Guest teachers at Peony`

Nella card di Peter Soptik e Sansei (o Teresa), aggiorna la bio con questo testo (IT e EN):

**EN:**
`Peter Soptik and Sansei's approach to rope focuses on deep connection between two people, rooted in traditional kinbaku and the Kinbaku LuXuria Style. Their tying and teaching include classical patterns, strong aesthetics, and deep surrender to core emotions found in semenawa. Among the themes they explore and teach are objectification and exposure, from shame to humiliation, as well as niche topics such as neck rope and arm binders. Peter has studied Japanese bondage with several renowned teachers and is a certified instructor of the Kinbaku LuXuria Style. Sansei brings her experience as both model and rigger, offering insights shaped by deep surrender and embodied experience in the ropes.`

**IT:** traduci il testo EN sopra in italiano.

### 7. Sezione "Altri insegnanti" — descrizione workshop

**Vecchio:** `Workshop, ricerca e trasmissione legata al percorso Kinbaku LuXuria.`
**Nuovo IT:** `Ricerca, passione e trasmissione legate al percorso nel Kinbaku LuXuria style`
**Nuovo EN:** `Research, passion and transmission linked to the Kinbaku LuXuria style path`

---

## Note

- Rispetta la struttura i18n esistente se i testi sono nei dizionari, altrimenti modifica direttamente nei componenti
- Non cambiare layout, stile o struttura dei componenti
- Non tradurre i nomi propri: Kurogami, Shiawase, Naka San, Elemiaow, Peter Soptik, Sansei, Kinbaku LuXuria

---

## Controllo qualità

```
npx.cmd tsc --noEmit
npm.cmd run lint
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI:
- [file]: [descrizione breve delle modifiche]

TESTI NON TROVATI (se qualcuno non era presente):
- [testo]: [motivo]

ERRORI RESIDUI:
- [errore]: [motivo]
```
