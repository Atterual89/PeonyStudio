# TASK: Modale percorsi — aggiungi dropdown percorso e campo note

In `src/components/programs/ProgramsProgressPage.tsx` (o il file della modale contatti percorsi), modifica la modale "Chiedi informazioni" aggiungendo:

## 1. Dropdown per scegliere il percorso

Sostituisci il testo read-only del percorso selezionato con una `<select>` con le opzioni:

```tsx
<label className="text-xs uppercase tracking-widest text-[#b07a5a] block mb-1">Percorso</label>
<select
  value={contactProgram}
  onChange={e => setContactProgram(e.target.value)}
  className="w-full border border-[#c4a888] rounded-xl px-4 py-3 text-sm bg-white text-[#2a1f1a] mb-4 outline-none"
>
  <option value="">Seleziona un percorso...</option>
  <option value="Foundation 1">Foundation 1</option>
  <option value="Foundation 2">Foundation 2</option>
  <option value="Classe 1">Classe 1</option>
  <option value="Classe 1+">Classe 1+</option>
  <option value="Pratica Assistita">Pratica Assistita</option>
  <option value="Classi Tematiche">Classi Tematiche</option>
</select>
```

Aggiungi stato: `const [contactProgram, setContactProgram] = useState('')`

## 2. Campo note (già presente come "Messaggio", rinominalo)

Cambia la label "Messaggio" in "Note o domande" e il placeholder in "Scrivi qui le tue domande o note...".

## 3. Aggiorna il mailto

Aggiorna il link mailto per usare `contactProgram` invece del percorso selezionato dai nodi:

```tsx
href={`mailto:peony.studio.turin@gmail.com?subject=${encodeURIComponent(`Informazioni percorso: ${contactProgram}`)}&body=${encodeURIComponent(`Ciao,\n\nMi chiamo ${contactName}.\n\nPercorso di interesse: ${contactProgram}\n\n${contactMessage}\n\nGrazie`)}`}
```

## 4. Reset al chiudere

Quando la modale viene chiusa (bottone ✕ o dopo invio), resetta tutti i campi:
```tsx
const closeModal = () => {
  setContactModalOpen(false)
  setContactName('')
  setContactProgram('')
  setContactMessage('')
}
```

Usa `closeModal` al posto di `setContactModalOpen(false)` ovunque.

```
npx.cmd tsc --noEmit
npm.cmd run build
```

Report: modifiche applicate + errori.
