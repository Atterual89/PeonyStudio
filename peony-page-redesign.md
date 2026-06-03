# TASK: Redesign pagina /peony con tab navigation e sezione contatti

**Modalità di lavoro:** Esegui tutto in silenzio. NON mostrare codice intermedio, NON descrivere ogni modifica. Mostra SOLO il report finale. Conferma automaticamente tutte le modifiche ai file.

---

## Contesto

La pagina `/peony` esiste già con scroll verticale lungo. Va ristrutturata con tab navigation (come già fatto per `/percorsi` e `/workshop`) e va aggiunta una sezione contatti fissa in fondo, fuori dai tab.

Non cambiare: routing, LanguageProvider, SiteHeader, BottomNav, Supabase, auth, admin.
Usa la struttura i18n esistente: `useLanguage()`, dizionari `it.ts` e `en.ts`.

---

## Struttura nuova della pagina

```
[ Hero ]
[ Tab Navigation ]
[ Contenuto tab attivo ]
[ Sezione Contatti — fissa, fuori dai tab, sempre visibile ]
```

---

## Tab Navigation

Quattro tab, bilingue:

| IT | EN |
|---|---|
| About | About |
| Spazio | Space |
| Team | Team |
| Community | Community |

**Comportamento obbligatorio:** quando l'utente cambia tab, la pagina deve fare scroll automatico in cima alla sezione contenuto (sotto i tab). Usa `scrollIntoView` o `window.scrollTo` al click su ogni tab.

Tab attivo in stato locale React (`useState`), default: primo tab (`about`).

---

## Tab 1 — About (IT) / About (EN)

Contenuto (nell'ordine):
- Hero section con headline e sottotitolo dello studio
- Tre pilastri: **Tecnica**, **Connessione**, **Estetica** (card o lista con descrizioni)
- Sezione storia del nome

Titoli:
- Eyebrow: `PEONY STUDIO`
- Sezione pilastri: nessun eyebrow aggiuntivo
- Sezione storia: eyebrow `PERCHÉ PEONY` / `WHY PEONY`, titolo IT `Una peonia, un riferimento, una dedica.` / EN `A peony, a reference, a dedication.`

---

## Tab 2 — Spazio (IT) / Space (EN)

Contenuto (nell'ordine):
- Headline sezione
- Foto aree con label (Lounge, Bamboo/Hashira, Practice setup)
- Card numerate: Main workshop area (01), Lounge & kitchen (02), Practice setup (03), Comfort (04)
- Gallery foto scroll orizzontale
- Sezione "Dove siamo" / "Where we are"
- Accordion "Come arrivare" / "How to get here": By Plane, By Train, Public Transportation

Titoli:
- Eyebrow: `LO SPAZIO` / `THE SPACE`
- Titolo IT: `Uno studio pensato per praticare, studiare e incontrarsi.`
- Titolo EN: `A studio built for practice, study and connection.`
- Eyebrow gallery: `GALLERY`
- Eyebrow location: `DOVE SIAMO` / `WHERE WE ARE`
- Eyebrow accordion: `COME ARRIVARE` / `HOW TO GET HERE`

---

## Tab 3 — Team (IT) / Team (EN)

Contenuto (nell'ordine):
- Sezione fondatori con foto, descrizione, tag, bottone "Leggi bio" / "Read bio"
- Sezione guest teachers con intro e card per ogni ospite

Titoli (IMPORTANTE — sostituisce i titoli esistenti):
- ~~"La coppia residente"~~ → eyebrow `FONDATORI` / `FOUNDERS`, titolo `Kurogami & Shiawase`
- ~~"Ospiti e collaborazioni"~~ → eyebrow `GUEST TEACHERS`, titolo IT `Chi è passato da Peony` / EN `Guest teachers at Peony`
- Badge insegnanti: `FONDATORI DI PEONY STUDIO` / `FOUNDERS OF PEONY STUDIO`

---

## Tab 4 — Community (IT) / Community (EN)

Contenuto (nell'ordine):
- Headline
- Card attività con link interni:
  - IT `Classi` / EN `Classes` → `/percorsi`
  - `Rope jam` → `/pratica`
  - IT `Incontri bottom` / EN `Bottom sessions` → `/pratica`
  - IT `Workshop internazionali` / EN `International workshops` → `/workshop`
- CTA finale dark card

Titoli:
- Eyebrow: `COMMUNITY`
- Titolo IT: `Studiare, praticare, incontrare.` / EN: `Study, practice, connect.`
- CTA dark card titolo IT: `Vieni a Peony.` / EN: `Come to Peony.`
- Bottoni CTA IT: `Guarda i prossimi eventi` + `Scopri come iniziare`
- Bottoni CTA EN: `View upcoming events` + `How to get started`

---

## Sezione Contatti — fuori dai tab, sempre visibile in fondo

Posizione: dopo il contenuto dei tab, prima del footer. Visibile su tutti i tab.

Contenuto:
- Eyebrow IT: `CONTATTI` / EN: `CONTACT`
- Titolo IT: `Scrivici.` / EN: `Get in touch.`
- Sottotitolo IT: `Hai domande? Usa il form qui sotto oppure trovaci sui social.`
  EN: `Got questions? Use the form below or find us on social.`
- Form Google embed:
  - src: `https://docs.google.com/forms/d/e/1FAIpQLScR80C5RIYTCPjXp9Y8QuAk9BGl5KoTERbSRMqcfRdNzAVxSg/viewform?embedded=true`
  - width: 100%, height: 912px, frameborder: 0
  - wrappato in container con `overflow: hidden` e bordi arrotondati
- Link social in riga sotto il form:
  - Instagram: `https://www.instagram.com/peony.studio.turin` → label `@peony.studio.turin`
  - Telegram: `https://t.me/peony_studio_turin` → label IT `Canale Telegram` / EN `Telegram Channel`
  - Usa icone lucide-react se disponibili, altrimenti testo semplice con link

---

## Regole implementazione

- Se `src/app/peony/page.tsx` è Server Component, crea `PeonyPageClient.tsx` come Client Component (`"use client"`)
- Usa lo stesso pattern tab già esistente in `/percorsi` o `/workshop` per coerenza visiva
- Mantieni le stesse classi CSS/Tailwind già usate nel sito per card, eyebrow, titoli, accordion
- La tab navigation deve essere sticky o scrollabile su mobile se i tab non entrano tutti
- Scroll in cima obbligatorio al cambio tab

---

## i18n

Aggiungi in `it.ts` e `en.ts` nella sezione `peony` tutte le stringhe nuove:
- Nomi tab: About/About, Spazio/Space, Team/Team, Community/Community
- Tutti i titoli, eyebrow, CTA, label e testi della sezione contatti

---

## Controllo qualità

1. Verifica che i tab funzionino e che lo scroll in cima avvenga al cambio tab
2. Verifica che la sezione contatti sia visibile su tutti i tab
3. Cerca stringhe italiane hardcoded rimaste
4. Esegui in sequenza e correggi tutti gli errori:
```
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

---

## Report finale (l'UNICA cosa da mostrarmi)

```
FILES MODIFICATI/CREATI:
- [file]: [descrizione breve]

FUNZIONA:
- [feature]

BILINGUE:
- [sezione]

PROBLEMI O LIMITI:
- [problema]: [motivo]

ERRORI RESIDUI:
- [errore]: [motivo]
```
