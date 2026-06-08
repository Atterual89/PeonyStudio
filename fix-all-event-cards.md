# TASK: Fix card evento mobile — immagine landscape leggibile

**Modalità:** Esegui in silenzio. Mostra SOLO il report finale.

## Problema

Le immagini degli eventi da Ticket Tailor sono landscape 3:1 (~2344×746px). Con `object-contain` e padding appaiono piccole su sfondo crema vuoto. La soluzione è mostrare l'immagine a tutta larghezza nella sua proporzione naturale (aspect-[3/1] o simile), senza padding, e mettere badge + titolo + data in un blocco testo separato sotto.

---

## Intervento 1 — `src/components/shared/EventImage.tsx`

Aggiungi il variant `"netflix"`:

```ts
netflix: {
  variantClass: "aspect-[3/1]",
  imageClass: "object-cover",   // cover su aspect 3:1 = immagine intera senza tagli
  sizes: "180px"
}
```

Aggiorna il tipo `EventImageVariant` includendo `"netflix"`.

---

## Intervento 2 — `src/components/shared/EventsNetflixLayout.tsx` — `NetflixCard`

Ridisegna la `NetflixCard` con questa struttura:

```
<a>                                          ← link, min-w-[180px], rounded-[12px], overflow-hidden, bg bianco/crema
  <EventImage variant="netflix" />           ← immagine landscape intera, no overlay
  <div>                                      ← blocco testo, padding 10px 12px 12px
    <div>                                    ← riga meta: badge categoria + data
      <span badge categoria />               ← bg-[#8b5e4a]/10 text-[#8b5e4a], 10px, pill
      <span data />                          ← text-[#6b5c52], 10px
    </div>
    <p titolo />                             ← font-serif text-[#211815], 13px, line-clamp-2, mt-1
    <span "Prenota" /> (se bookingUrl)       ← mt-2, pill scuro bg-[#211815] text-white 10px
  </div>
</a>
```

Rimuovi completamente l'overlay gradient e i testi sull'immagine — tutto il testo va nel blocco sotto.

---

## Intervento 3 — `src/components/HomeContentClient.tsx` — card eventi home

Leggi le righe 44–67 (card inline con `variant="mobile"`). Applica la stessa struttura dell'Intervento 2:

- Sostituisci `variant="mobile"` con `variant="netflix"`
- Rimuovi l'overlay gradient e i testi sopra l'immagine
- Aggiungi un blocco testo sotto l'immagine con: badge categoria (se disponibile) + data + titolo
- Mantieni larghezza e scroll orizzontale esistenti

Se la card home usa un tipo diverso da `PeonyEventCard` (es. ha solo `title`, `date`, `image`), adatta i campi disponibili senza aggiungere nuovi field al tipo.

---

## Dopo le modifiche

```
npx.cmd tsc --noEmit
npm.cmd run lint
```

---

## Report finale

```
FILES MODIFICATI:
- [file]: [cosa cambiato]

ERRORI RESIDUI:
- [errore]: [motivo]
```
