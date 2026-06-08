# TASK: Aggiungi tab "Lezioni private" nella sezione Percorsi

**Modalità:** Esegui in silenzio. Mostra SOLO il report finale.

---

## Contesto

La pagina `/percorsi` ha un tab switcher con 4 tab: Inizia / Percorsi / Workshop / Socialità.
Va aggiunto un **5° tab "Lezioni private"** con contenuto statico (niente Ticket Tailor).

---

## Step 1 — Aggiungi tab al switcher

In `src/components/programs/ProgramsProgressPage.tsx` (o dove si trova il SectionTabSwitcher), aggiungi la voce:
- IT: `"Lezioni private"`
- EN: `"Private lessons"`

Aggiungi anche le chiavi corrispondenti nei dizionari `src/i18n/dictionaries/it.ts` e `en.ts`.

---

## Step 2 — Contenuto tab

Crea un nuovo componente `src/components/programs/PrivateLessonsTab.tsx` con il contenuto seguente, bilingue tramite `useLanguage()`.

### Struttura visiva

```
┌─────────────────────────────────────────┐
│ LEZIONI PRIVATE                         │  ← eyebrow
│ Studio Peony · Torino                   │  ← subtitle
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ 01  Lezione privata di coppia    │   │  ← card accordion
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ 02  Lezione privata di gruppo    │   │  ← card accordion
│  └──────────────────────────────────┘   │
│                                         │
│  [nota membership]                      │
│                                         │
│  Contatti                               │
│  peony.studio.turin@gmail.com           │
│  andreakurogami@gmail.com               │
└─────────────────────────────────────────┘
```

Ogni card è un accordion espandibile (stesso stile degli altri accordion del sito — `border border-[#211815]/10 bg-white rounded-[10px]`).

---

## Contenuto testuale (IT / EN)

### Card 01 — Lezione privata di coppia

**IT:**
- Titolo: `Lezione privata di coppia`
- Sottotitolo: `Su misura per voi, nel vostro spazio di lavoro`
- Descrizione: `Un formato intensivo pensato per coppie che vogliono lavorare in modo mirato sui propri obiettivi tecnici o espressivi. Gli incontri si svolgono tendenzialmente nel fine settimana (sabato e domenica), con sessioni di circa 6 ore al giorno. In casi particolari è possibile concordare sessioni serali durante la settimana, della durata di circa 3 ore.`
- Dettagli:
  - `2 giorni · ~6 ore al giorno (totale ~12 ore)`
  - `Tendenzialmente sabato e domenica`
  - `Sessioni serali infrasettimanali su accordo (~3 ore)`
  - `Prenotazione solo via email o contatti diretti`
  - `Prezzo comunicato su richiesta`
- CTA: `Scrivi per informazioni →`

**EN:**
- Titolo: `Private couple lesson`
- Sottotitolo: `Tailored for you, in your working space`
- Descrizione: `An intensive format designed for couples who want to work in a focused way on their technical or expressive goals. Sessions typically take place on weekends (Saturday and Sunday), approximately 6 hours per day. In special cases, weekday evening sessions of about 3 hours can be arranged.`
- Dettagli:
  - `2 days · ~6 hours/day (total ~12 hours)`
  - `Typically Saturday and Sunday`
  - `Weekday evening sessions available on request (~3 hours)`
  - `Booking by email or direct contact only`
  - `Price communicated upon request`
- CTA: `Write for information →`

---

### Card 02 — Lezione privata di gruppo

**IT:**
- Titolo: `Lezione privata di gruppo`
- Sottotitolo: `Per gruppi già formati, da 2 a 4 coppie`
- Descrizione: `Un formato su due giorni (sabato e domenica) pensato per gruppi già formati con un livello omogeneo — qualunque esso sia. Le sessioni si svolgono dalle 10:00 alle 17:00 con un'ora di pausa pranzo. Il gruppo può indicare i temi su cui vuole lavorare, oppure richiedere una valutazione e costruire la didattica insieme agli insegnanti. È possibile organizzare una call Zoom circa un mese prima per discutere contenuti e obiettivi.`
- Dettagli:
  - `2 giorni · sabato e domenica · 10:00–17:00`
  - `1 ora di pausa pranzo`
  - `Da 2 a 4 coppie · stesso livello`
  - `Il gruppo definisce i temi o co-costruisce la didattica`
  - `Call Zoom preparatoria disponibile (~1 mese prima)`
  - `Prezzo in base al numero di coppie · comunicato su richiesta`
- CTA: `Scrivi per informazioni →`

**EN:**
- Titolo: `Private group tuition`
- Sottotitolo: `For self-formed groups, 2 to 4 couples`
- Descrizione: `A two-day format (Saturday and Sunday) designed for self-formed groups with a homogeneous level — whatever that may be. Sessions run from 10:00 to 17:00 with a 1-hour lunch break. The group can provide a list of subjects they want to work on, or ask us to assess them and build the curriculum together. A Zoom call about one month before the tuition is available to discuss content and needs.`
- Dettagli:
  - `2 days · Saturday and Sunday · 10:00–17:00`
  - `1-hour lunch break`
  - `2 to 4 couples · similar level`
  - `Group defines topics or co-builds the curriculum`
  - `Preparatory Zoom call available (~1 month before)`
  - `Price based on number of couples · communicated upon request`
- CTA: `Write for information →`

---

### Nota membership (sotto entrambe le card)

**IT:**
`Tutte le attività presso Peony Studio richiedono l'iscrizione all'Associazione di Promozione Sociale. La registrazione deve essere completata almeno 48 ore prima dell'evento. La tessera annuale ha un costo di €15 a persona, è valida dal 1° gennaio al 31 dicembre e non si rinnova automaticamente.`

**EN:**
`All activities at Peony Studio require membership in the Studio Association. Registration must be completed at least 48 hours before the event. The annual membership fee is €15 per person, valid from January 1 to December 31 and not automatically renewed.`

---

### Contatti

```tsx
<div>
  <p className="mb-2 text-[10px] uppercase tracking-widest text-[#8b5e4a]">Contatti</p>
  <a href="mailto:peony.studio.turin@gmail.com" className="block text-sm text-[#211815] underline underline-offset-2">
    peony.studio.turin@gmail.com
  </a>
  <a href="mailto:andreakurogami@gmail.com" className="block mt-1 text-sm text-[#211815] underline underline-offset-2">
    andreakurogami@gmail.com
  </a>
</div>
```

---

## Stile accordion card

Stesso pattern già usato nel sito — ogni card ha header cliccabile con `+` / `×`:

```tsx
<div className="rounded-[10px] border border-[#211815]/10 bg-white overflow-hidden mb-2">
  <button className="w-full flex items-center justify-between p-4" onClick={() => toggle(n)}>
    <div>
      <p className="text-[10px] text-[#8b5e4a] mb-1">0{n}</p>
      <p className="font-serif text-lg text-[#211815] text-left">{title}</p>
      <p className="text-xs text-[#6b5c52] mt-0.5">{subtitle}</p>
    </div>
    <span className="text-[#8b5e4a] text-xl">{open ? '×' : '+'}</span>
  </button>
  {open && (
    <div className="px-4 pb-4 border-t border-[#211815]/08">
      {/* contenuto */}
    </div>
  )}
</div>
```

---

## Dopo le modifiche

```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale

```
FILES MODIFICATI/CREATI:
- [file]: [cosa cambiato]

ERRORI RESIDUI:
- [errore]: [motivo]
```
