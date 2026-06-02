"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import type { PersonalAreaData } from "@/lib/personal-area";

type SectionId =
  | "next"
  | "events"
  | "membership"
  | "info"
  | "partner"
  | "path";

type Enrollment = PersonalAreaData["enrollments"][number];

const sectionCards: Array<{
  id: SectionId;
  title: string;
  text: string;
  icon: string;
}> = [
  {
    id: "next",
    title: "Prossimo evento",
    text: "La prossima data collegata alla tua email.",
    icon: "calendar",
  },
  {
    id: "events",
    title: "I miei eventi",
    text: "Appuntamenti futuri e passati in un unico spazio.",
    icon: "ticket",
  },
  {
    id: "membership",
    title: "Tessera associativa",
    text: "Stato e scadenza, quando disponibili.",
    icon: "card",
  },
  {
    id: "info",
    title: "Informazioni utili",
    text: "Accesso allo studio, regole e contatto emergenza.",
    icon: "info",
  },
  {
    id: "partner",
    title: "Partner / accompagnatore",
    text: "Uno spazio che arrivera piu avanti.",
    icon: "people",
  },
  {
    id: "path",
    title: "Il mio percorso",
    text: "Una traccia orientativa dentro Peony Studio.",
    icon: "path",
  },
];

export function PersonalAreaDashboard({ data }: { data: PersonalAreaData }) {
  const [activeSection, setActiveSection] = useState<SectionId>("next");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<
    string | null
  >(null);
  const [referenceNow] = useState(() => Date.now());
  const sortedEnrollments = useMemo(
    () => sortEnrollmentsByDate(data.enrollments),
    [data.enrollments],
  );
  const futureEnrollments = sortedEnrollments.filter((enrollment) =>
    isFutureEnrollment(enrollment, referenceNow),
  );
  const pastEnrollments = sortedEnrollments.filter(
    (enrollment) => !isFutureEnrollment(enrollment, referenceNow),
  );
  const nextEnrollment = futureEnrollments[0] ?? sortedEnrollments[0] ?? null;
  const selectedEnrollment =
    sortedEnrollments.find(
      (enrollment) => enrollment.id === selectedEnrollmentId,
    ) ??
    nextEnrollment ??
    null;

  function openEvent(enrollment: Enrollment) {
    setSelectedEnrollmentId(enrollment.id);
    setActiveSection("events");
  }

  function openSection(sectionId: SectionId) {
    setActiveSection(sectionId);
    setSidebarOpen(false);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12">
      <header className="relative overflow-hidden rounded-[8px] border border-[#211815]/10 bg-white/60 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.06)] md:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border border-[#8b5e4a]/15" />
        <div className="pointer-events-none absolute -right-6 top-20 h-24 w-36 rounded-[999px] border border-[#211815]/10" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
              Area personale
            </p>
            <h1 className="mt-4 font-serif text-[clamp(42px,8vw,72px)] font-medium leading-[0.98]">
              Area personale
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#5f524c]">
              Accesso effettuato con{" "}
              <span className="font-semibold text-[#211815]">{data.email}</span>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 hover:border-[#8b5e4a] lg:hidden"
              type="button"
              onClick={() => setSidebarOpen(true)}
            >
              Apri riepilogo
            </button>
            <Link
              className="inline-flex w-fit rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 hover:border-[#8b5e4a]"
              href="/calendario"
            >
              Vai al calendario
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <DashboardSidebar
              activeSection={activeSection}
              data={data}
              onSectionChange={openSection}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between rounded-[8px] border border-[#211815]/10 bg-white/45 px-4 py-3 lg:hidden">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
                Sezione attiva
              </p>
              <p className="font-serif text-2xl font-medium">
                {getSectionTitle(activeSection)}
              </p>
            </div>
            <button
              className="rounded-full bg-[#211815] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe8]"
              type="button"
              onClick={() => setSidebarOpen(true)}
            >
              Menu
            </button>
          </div>

          {activeSection === "next" ? (
            <NextEventSection enrollment={nextEnrollment} onOpen={openEvent} />
          ) : null}
          {activeSection === "events" ? (
            <EventsSection
              futureEnrollments={futureEnrollments}
              pastEnrollments={pastEnrollments}
              selectedEnrollment={selectedEnrollment}
              onOpen={openEvent}
            />
          ) : null}
          {activeSection === "membership" ? (
            <MembershipSection data={data} />
          ) : null}
          {activeSection === "info" ? <UsefulInfoSection /> : null}
          {activeSection === "partner" ? <PartnerSection /> : null}
          {activeSection === "path" ? <PathSection /> : null}
        </div>
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Chiudi riepilogo"
            className="absolute inset-0 bg-[#211815]/35"
            type="button"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full w-[min(88vw,360px)] overflow-y-auto bg-[#f4efe8] p-4 shadow-[18px_0_48px_rgba(33,24,21,0.18)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b5e4a]">
                Riepilogo
              </p>
              <button
                aria-label="Chiudi riepilogo"
                className="grid h-10 w-10 place-items-center rounded-full border border-[#211815]/15 bg-white/55 text-lg"
                type="button"
                onClick={() => setSidebarOpen(false)}
              >
                ×
              </button>
            </div>
            <DashboardSidebar
              activeSection={activeSection}
              data={data}
              onSectionChange={openSection}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DashboardSidebar({
  activeSection,
  data,
  onSectionChange,
}: {
  activeSection: SectionId;
  data: PersonalAreaData;
  onSectionChange: (sectionId: SectionId) => void;
}) {
  return (
    <div className="rounded-[8px] border border-[#211815]/10 bg-white/55 p-4 shadow-[0_12px_36px_rgba(33,24,21,0.06)]">
      <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/75 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-[#8b5e4a]/30 bg-white/70 font-serif text-2xl text-[#8b5e4a]">
            {data.email.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
              Profilo
            </p>
            <p className="truncate text-sm font-semibold text-[#211815]">
              {data.email}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SidebarMetric
            label="Stato"
            value={data.profileLinked ? "OK" : "Check"}
          />
          <SidebarMetric
            label="Iscrizioni"
            value={String(data.claimedBuyerParticipants)}
          />
          <SidebarMetric
            label="Eventi"
            value={String(data.enrollments.length)}
          />
        </div>
      </div>

      <nav className="mt-4 space-y-2" aria-label="Area personale">
        {sectionCards.map((card) => (
          <button
            className={`group flex w-full items-center gap-3 rounded-[8px] border px-3 py-3 text-left transition ${
              activeSection === card.id
                ? "border-[#8b5e4a]/40 bg-[#8b5e4a]/10"
                : "border-transparent hover:border-[#211815]/10 hover:bg-[#f4efe8]/70"
            }`}
            key={card.id}
            type="button"
            onClick={() => onSectionChange(card.id)}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
                activeSection === card.id
                  ? "border-[#8b5e4a]/35 bg-white/75 text-[#8b5e4a]"
                  : "border-[#211815]/10 bg-white/45 text-[#5f524c] group-hover:text-[#8b5e4a]"
              }`}
            >
              <NavIcon name={card.icon} />
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-[21px] leading-6">
                {card.title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[#5f524c]">
                {card.text}
              </span>
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function SidebarMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#211815]/10 bg-white/50 p-2 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8b5e4a]">
        {label}
      </p>
      <p className="mt-1 font-serif text-xl font-medium">{value}</p>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  if (name === "calendar") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M7 3v4M17 3v4M4.5 9.5h15M6 5.5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      </svg>
    );
  }

  if (name === "ticket") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M5 8.5V6.8c0-.9.7-1.6 1.6-1.6h10.8c.9 0 1.6.7 1.6 1.6v1.7a2.5 2.5 0 0 0 0 5v3.7c0 .9-.7 1.6-1.6 1.6H6.6c-.9 0-1.6-.7-1.6-1.6v-3.7a2.5 2.5 0 0 0 0-5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M12 6.2v11.6" stroke="currentColor" strokeDasharray="2 2" strokeLinecap="round" strokeWidth="1.4" />
      </svg>
    );
  }

  if (name === "card") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M4.5 7.5c0-1 .8-1.8 1.8-1.8h11.4c1 0 1.8.8 1.8 1.8v9c0 1-.8 1.8-1.8 1.8H6.3c-1 0-1.8-.8-1.8-1.8v-9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M4.8 10h14.4M7.5 14.8h4.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    );
  }

  if (name === "people") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M9.8 11.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.5 19.2c.5-3 2.6-5 5.3-5s4.8 2 5.3 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M15.5 11.4a2.4 2.4 0 1 0 0-4.8M16.8 14.4c1.8.6 3 2.2 3.4 4.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    );
  }

  if (name === "path") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M5 18c6 0 3-12 9-12h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        <path d="M5 18a2 2 0 1 0 0 .1M19 6a2 2 0 1 0 0 .1M12 12h.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M12 17v-6M12 7.2v.1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function getSectionTitle(sectionId: SectionId) {
  return (
    sectionCards.find((card) => card.id === sectionId)?.title ??
    "Area personale"
  );
}

function SectionShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b5e4a]">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-3xl font-medium md:text-4xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function NextEventSection({
  enrollment,
  onOpen,
}: {
  enrollment: Enrollment | null;
  onOpen: (enrollment: Enrollment) => void;
}) {
  return (
    <SectionShell eyebrow="Prossima data" title="Prossimo evento">
      {enrollment ? (
        <div className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge>{enrollment.events?.category ?? "Evento"}</Badge>
                <Badge>Ticket Tailor</Badge>
              </div>
              <h3 className="mt-4 font-serif text-3xl font-medium">
                {enrollment.events?.title ?? "Evento Peony Studio"}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#5f524c]">
                {formatEventDate(enrollment.events?.starts_at)}
              </p>
            </div>
            <button
              className="inline-flex w-fit rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5"
              type="button"
              onClick={() => onOpen(enrollment)}
            >
              Vedi dettagli evento
            </button>
          </div>
        </div>
      ) : (
        <EmptyEventsMessage />
      )}
    </SectionShell>
  );
}

function EventsSection({
  futureEnrollments,
  pastEnrollments,
  selectedEnrollment,
  onOpen,
}: {
  futureEnrollments: Enrollment[];
  pastEnrollments: Enrollment[];
  selectedEnrollment: Enrollment | null;
  onOpen: (enrollment: Enrollment) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <SectionShell eyebrow="Appuntamenti" title="I miei eventi">
        {futureEnrollments.length === 0 && pastEnrollments.length === 0 ? (
          <EmptyEventsMessage />
        ) : (
          <div className="mt-5 space-y-6">
            <EventGroup
              title="Futuri"
              enrollments={futureEnrollments}
              onOpen={onOpen}
            />
            <EventGroup
              title="Passati"
              enrollments={pastEnrollments}
              onOpen={onOpen}
            />
          </div>
        )}
      </SectionShell>

      <EventDetail enrollment={selectedEnrollment} />
    </div>
  );
}

function EventGroup({
  title,
  enrollments,
  onOpen,
}: {
  title: string;
  enrollments: Enrollment[];
  onOpen: (enrollment: Enrollment) => void;
}) {
  if (enrollments.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
        {title}
      </h3>
      <div className="mt-3 grid gap-3">
        {enrollments.map((enrollment) => (
          <button
            className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#8b5e4a]/35"
            key={enrollment.id}
            type="button"
            onClick={() => onOpen(enrollment)}
          >
            <div className="flex flex-wrap gap-2">
              <Badge>{enrollment.events?.category ?? "Evento"}</Badge>
              <Badge>{formatEnrollmentStatus(enrollment.enrollment_status)}</Badge>
            </div>
            <p className="mt-3 font-serif text-2xl font-medium">
              {enrollment.events?.title ?? "Evento Peony Studio"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5f524c]">
              {formatEventDate(enrollment.events?.starts_at)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function EventDetail({ enrollment }: { enrollment: Enrollment | null }) {
  return (
    <SectionShell eyebrow="Dettaglio" title="Dettagli evento">
      {enrollment ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{enrollment.events?.category ?? "Evento"}</Badge>
              <Badge>Ticket Tailor</Badge>
            </div>
            <h3 className="mt-3 font-serif text-3xl font-medium">
              {enrollment.events?.title ?? "Evento Peony Studio"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#5f524c]">
              {formatEventDate(enrollment.events?.starts_at)}
            </p>
          </div>

          <InfoGrid
            items={[
              {
                title: "Programma / orari",
                text: formatProgram(enrollment),
              },
              {
                title: "Location",
                text: "Peony Studio, Via Vandalino 85/38, Torino.",
              },
              {
                title: "Come arrivare",
                text: "Metro Marche, uscita Via Eritrea, 5 minuti a piedi.",
              },
              {
                title: "Come accedere allo studio",
                text: "Citofono: UR Expression. Lo studio si trova al piano -1.",
              },
              {
                title: "Regole dello spazio",
                text: "Non sostare in gruppo davanti al portone. Fare silenzio sulle scale. Spazio senza scarpe. Vietato fumare/vape. No drink aperti nell'area corde/workshop. Acqua disponibile in cucina.",
              },
              {
                title: "Contatto emergenza",
                text: "+39 320 6486577 Andrea, WhatsApp/Telegram.",
              },
              {
                title: "Stato iscrizione / ticket",
                text: formatEnrollmentStatus(enrollment.enrollment_status),
              },
            ]}
          />

          {enrollment.events?.booking_url ? (
            <Link
              className="inline-flex rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 hover:border-[#8b5e4a]"
              href={enrollment.events.booking_url}
              target="_blank"
            >
              Apri Ticket Tailor
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-5 text-sm leading-6 text-[#5f524c]">
          Seleziona un evento per vedere le informazioni utili.
        </p>
      )}
    </SectionShell>
  );
}

function MembershipSection({ data }: { data: PersonalAreaData }) {
  const status = data.profile?.association_status ?? "unknown";
  const expiresAt = data.profile?.association_expires_at;

  return (
    <SectionShell eyebrow="Associazione" title="Tessera associativa">
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
            Stato
          </p>
          <p className="mt-2 font-serif text-3xl font-medium">
            {formatAssociationStatus(status)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5f524c]">
            {status === "unknown"
              ? "Lo stato della tessera sara verificato dallo staff."
              : "Questo stato viene aggiornato manualmente dallo staff."}
          </p>
        </div>
        <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
            Scadenza
          </p>
          <p className="mt-2 font-serif text-3xl font-medium">
            {expiresAt ? formatShortDate(expiresAt) : "Da verificare"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5f524c]">
            Se hai dubbi, scrivici prima dell&apos;evento.
          </p>
        </div>
      </div>
    </SectionShell>
  );
}

function UsefulInfoSection() {
  return (
    <SectionShell eyebrow="Studio" title="Informazioni utili">
      <InfoGrid
        items={[
          {
            title: "Indirizzo",
            text: "Peony Studio, Via Vandalino 85/38, Torino.",
          },
          {
            title: "Ingresso",
            text: "Citofono: UR Expression. Piano -1.",
          },
          {
            title: "Metro",
            text: "Metro Marche, uscita Via Eritrea, 5 minuti a piedi.",
          },
          {
            title: "Arrivo",
            text: "Non sostare in gruppo davanti al portone. Fare silenzio sulle scale.",
          },
          {
            title: "Spazio",
            text: "Spazio senza scarpe. Vietato fumare/vape. No drink aperti nell'area corde/workshop. Acqua disponibile in cucina.",
          },
          {
            title: "Emergenza",
            text: "+39 320 6486577 Andrea, WhatsApp/Telegram.",
          },
        ]}
      />
    </SectionShell>
  );
}

function PartnerSection() {
  return (
    <SectionShell eyebrow="Partecipazione" title="Partner / accompagnatore">
      <p className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-5 text-sm leading-6 text-[#5f524c]">
        In futuro potrai indicare qui la persona con cui parteciperai. Per ora,
        se hai bisogno di comunicarci qualcosa prima di un evento, scrivici sui
        canali abituali.
      </p>
    </SectionShell>
  );
}

function PathSection() {
  return (
    <SectionShell eyebrow="Percorso" title="Il mio percorso">
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {["Foundation 1", "Foundation 2", "Class 1", "Class 1+"].map(
          (step, index) => (
            <div
              className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4"
              key={step}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-2 font-serif text-2xl font-medium">{step}</p>
            </div>
          ),
        )}
      </div>
      <div className="mt-4 rounded-[8px] border border-[#211815]/10 bg-white/50 p-4 text-sm leading-6 text-[#5f524c]">
        Pratica assistita e classi tematiche accompagnano il percorso come
        attivita parallele. La logica di progresso arrivera in uno step
        successivo.
      </div>
    </SectionShell>
  );
}

function InfoGrid({
  items,
}: {
  items: Array<{
    title: string;
    text: string;
  }>;
}) {
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div
          className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4"
          key={item.title}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
            {item.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5f524c]">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[#211815]/10 bg-white/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
      {children}
    </span>
  );
}

function EmptyEventsMessage() {
  return (
    <div className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-5 text-sm leading-6 text-[#5f524c]">
      Non risultano ancora eventi associati a questa email. Se hai prenotato
      con un&apos;altra email, accedi usando quella.
    </div>
  );
}

function sortEnrollmentsByDate(enrollments: Enrollment[]) {
  return [...enrollments].sort((a, b) => {
    const aTime = getEnrollmentTime(a) ?? Number.MAX_SAFE_INTEGER;
    const bTime = getEnrollmentTime(b) ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

function isFutureEnrollment(enrollment: Enrollment, now: number) {
  const eventTime = getEnrollmentTime(enrollment);
  return eventTime !== null && eventTime >= now;
}

function getEnrollmentTime(enrollment: Enrollment) {
  const value = enrollment.events?.starts_at;
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatEventDate(value?: string | null) {
  if (!value) {
    return "Data da confermare";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatProgram(enrollment: Enrollment) {
  const start = formatEventDate(enrollment.events?.starts_at);
  const end = enrollment.events?.ends_at
    ? formatEventDate(enrollment.events.ends_at)
    : null;

  return end ? `${start} - ${end}` : start;
}

function formatEnrollmentStatus(status: string | null) {
  if (!status || status === "active") {
    return "Iscrizione confermata";
  }

  return status.replaceAll("_", " ");
}

function formatAssociationStatus(status: string | null) {
  const normalized = status ?? "unknown";
  const labels: Record<string, string> = {
    unknown: "Da verificare",
    missing: "Mancante",
    pending: "In verifica",
    verified: "Verificata",
    expired: "Scaduta",
    not_required: "Non richiesta",
  };

  return labels[normalized] ?? normalized;
}
