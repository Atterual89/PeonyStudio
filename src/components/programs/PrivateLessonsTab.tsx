"use client";

import { useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";

const CONTENT = {
  it: {
    eyebrow: "Lezioni private",
    subtitle: "Studio Peony · Torino",
    membershipNote:
      "Tutte le attività presso Peony Studio richiedono l'iscrizione all'Associazione di Promozione Sociale. La registrazione deve essere completata almeno 48 ore prima dell'evento. La tessera annuale ha un costo di €15 a persona, è valida dal 1° gennaio al 31 dicembre e non si rinnova automaticamente.",
    contactsLabel: "Contatti",
    cta: "Scrivi per informazioni →",
    lessons: [
      {
        number: "01",
        title: "Lezione privata di coppia",
        subtitle: "Su misura per voi, nel vostro spazio di lavoro",
        description:
          "Un formato intensivo pensato per coppie che vogliono lavorare in modo mirato sui propri obiettivi tecnici o espressivi. Gli incontri si svolgono tendenzialmente nel fine settimana (sabato e domenica), con sessioni di circa 6 ore al giorno. In casi particolari è possibile concordare sessioni serali durante la settimana, della durata di circa 3 ore.",
        details: [
          "2 giorni · ~6 ore al giorno (totale ~12 ore)",
          "Tendenzialmente sabato e domenica",
          "Sessioni serali infrasettimanali su accordo (~3 ore)",
          "Prenotazione solo via email o contatti diretti",
          "Prezzo comunicato su richiesta",
        ],
      },
      {
        number: "02",
        title: "Lezione privata di gruppo",
        subtitle: "Per gruppi già formati, da 2 a 4 coppie",
        description:
          "Un formato su due giorni (sabato e domenica) pensato per gruppi già formati con un livello omogeneo — qualunque esso sia. Le sessioni si svolgono dalle 10:00 alle 17:00 con un'ora di pausa pranzo. Il gruppo può indicare i temi su cui vuole lavorare, oppure richiedere una valutazione e costruire la didattica insieme agli insegnanti. È possibile organizzare una call Zoom circa un mese prima per discutere contenuti e obiettivi.",
        details: [
          "2 giorni · sabato e domenica · 10:00–17:00",
          "1 ora di pausa pranzo",
          "Da 2 a 4 coppie · stesso livello",
          "Il gruppo definisce i temi o co-costruisce la didattica",
          "Call Zoom preparatoria disponibile (~1 mese prima)",
          "Prezzo in base al numero di coppie · comunicato su richiesta",
        ],
      },
    ],
  },
  en: {
    eyebrow: "Private lessons",
    subtitle: "Studio Peony · Turin",
    membershipNote:
      "All activities at Peony Studio require membership in the Studio Association. Registration must be completed at least 48 hours before the event. The annual membership fee is €15 per person, valid from January 1 to December 31 and not automatically renewed.",
    contactsLabel: "Contacts",
    cta: "Write for information →",
    lessons: [
      {
        number: "01",
        title: "Private couple lesson",
        subtitle: "Tailored for you, in your working space",
        description:
          "An intensive format designed for couples who want to work in a focused way on their technical or expressive goals. Sessions typically take place on weekends (Saturday and Sunday), approximately 6 hours per day. In special cases, weekday evening sessions of about 3 hours can be arranged.",
        details: [
          "2 days · ~6 hours/day (total ~12 hours)",
          "Typically Saturday and Sunday",
          "Weekday evening sessions available on request (~3 hours)",
          "Booking by email or direct contact only",
          "Price communicated upon request",
        ],
      },
      {
        number: "02",
        title: "Private group tuition",
        subtitle: "For self-formed groups, 2 to 4 couples",
        description:
          "A two-day format (Saturday and Sunday) designed for self-formed groups with a homogeneous level — whatever that may be. Sessions run from 10:00 to 17:00 with a 1-hour lunch break. The group can provide a list of subjects they want to work on, or ask us to assess them and build the curriculum together. A Zoom call about one month before the tuition is available to discuss content and needs.",
        details: [
          "2 days · Saturday and Sunday · 10:00–17:00",
          "1-hour lunch break",
          "2 to 4 couples · similar level",
          "Group defines topics or co-builds the curriculum",
          "Preparatory Zoom call available (~1 month before)",
          "Price based on number of couples · communicated upon request",
        ],
      },
    ],
  },
} as const;

export function PrivateLessonsTab() {
  const { locale } = useLanguage();
  const c = CONTENT[locale as keyof typeof CONTENT] ?? CONTENT.it;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex((current) => (current === index ? null : index));
  }

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-6 md:pb-24 md:pt-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
        {c.eyebrow}
      </p>
      <p className="mt-1 text-sm text-[#5f524c]">{c.subtitle}</p>

      <div className="mt-8">
        {c.lessons.map((lesson, index) => {
          const open = openIndex === index;
          return (
            <div
              key={lesson.number}
              className="mb-2 overflow-hidden rounded-[10px] border border-[#211815]/10 bg-white"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left"
                onClick={() => toggle(index)}
                aria-expanded={open}
              >
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
                    {lesson.number}
                  </p>
                  <p className="font-serif text-lg font-medium leading-tight text-[#211815]">
                    {lesson.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6b5c52]">{lesson.subtitle}</p>
                </div>
                <span className="ml-4 shrink-0 text-xl text-[#2a1f1a]" aria-hidden="true">
                  {open ? "×" : "+"}
                </span>
              </button>

              {open && (
                <div className="border-t border-[#211815]/8 px-4 pb-4 pt-3">
                  <p className="text-sm leading-[1.7] text-[#5f524c]">
                    {lesson.description}
                  </p>
                  <ul className="mt-4 grid gap-1.5">
                    {lesson.details.map((detail) => (
                      <li key={detail} className="flex gap-2.5 text-sm text-[#211815]">
                        <span aria-hidden="true" className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8b5e4a]/55" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="mailto:peony.studio.turin@gmail.com"
                    className="mt-5 inline-flex rounded-full bg-[#211815] px-4 py-2.5 text-xs font-medium text-white transition hover:-translate-y-0.5"
                  >
                    {c.cta}
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#8b5e4a]">
          {c.contactsLabel}
        </p>
        <a
          href="mailto:peony.studio.turin@gmail.com"
          className="block text-sm text-[#211815] underline underline-offset-2"
        >
          peony.studio.turin@gmail.com
        </a>
        <a
          href="mailto:andreakurogami@gmail.com"
          className="mt-1 block text-sm text-[#211815] underline underline-offset-2"
        >
          andreakurogami@gmail.com
        </a>
      </div>
    </section>
  );
}
