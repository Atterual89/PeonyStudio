# TASK: Allinea layout quiz "Da dove dovresti iniziare?" al quiz "Che Peony student sei?"

## Contesto

Nel sito esistono due quiz modali:
1. **"Che Peony student sei?"** — funziona bene: bottoni Indietro/Avanti visibili in fondo, layout compatto
2. **"Da dove dovresti iniziare?"** — bottoni fuori schermo, modale troppo alta

## Obiettivo

Trova i due componenti che renderizzano questi quiz. Copia la struttura JSX del wrapper modale, del contenitore domande/risposte e dei bottoni dal quiz **funzionante** ("Che Peony student sei?") e applicala al quiz **rotto** ("Da dove dovresti iniziare?"), adattando solo i testi e la logica interna.

In particolare assicurati che nel quiz "Da dove dovresti iniziare?":
- Il wrapper modale abbia le stesse classi di altezza/overflow del quiz funzionante
- I bottoni Indietro/Avanti siano nella stessa posizione (in fondo, visibili, affiancati o come nel quiz funzionante)
- Il padding e la spaziatura siano identici

## Istruzioni

1. Identifica i file di entrambi i quiz
2. Copia il layout (non la logica) dal funzionante al rotto
3. Non cambiare domande, risposte, stato, o logica di navigazione

```
npx.cmd tsc --noEmit
npm.cmd run build
```

## Report
```
FILE QUIZ FUNZIONANTE: [nome file]
FILE QUIZ ROTTO: [nome file]
MODIFICHE APPLICATE: [cosa]
ERRORI: [eventuale]
```
