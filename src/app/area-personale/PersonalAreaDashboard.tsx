"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PersonalAreaData } from "@/lib/personal-area";

type SectionId =
  | "overview"
  | "events"
  | "guide"
  | "path"
  | "profile";

type Enrollment = PersonalAreaData["enrollments"][number];

const sections: Array<{ id: SectionId; label: string; text: string; icon: string }> = [
  { id: "overview", label: "Home",     text: "Il colpo d'occhio sul tuo momento.",    icon: "spark"   },
  { id: "events",   label: "Eventi",   text: "Date future, storico e dettagli utili.", icon: "ticket"  },
  { id: "guide",    label: "Guida",    text: "La forma della tua presenza.",           icon: "eye"     },
  { id: "path",     label: "Percorso", text: "Il tuo percorso formativo.",             icon: "path"    },
  { id: "profile",  label: "Profilo",  text: "Dati, tessera e funzioni gestionali.",  icon: "card"    },
];

const animalGuides = [
  { min: 0,  max: 0,                    name: "Volpe Curiosa",       status: "Primi passi",          image: "/images/animal-guides/volpe-curiosa.png"       },
  { min: 1,  max: 2,                    name: "Gufo Osservatore",    status: "Presenza iniziale",    image: "/images/animal-guides/gufo-osservatore.png"    },
  { min: 3,  max: 5,                    name: "Formica Esploratrice",status: "Basi in costruzione",  image: "/images/animal-guides/formica-esploratrice.png"},
  { min: 6,  max: 10,                   name: "Cervo Radicato",      status: "Presenza regolare",    image: "/images/animal-guides/cervo-radicato.png"      },
  { min: 11, max: 18,                   name: "Elefante Stabile",    status: "Percorso consolidato", image: "/images/animal-guides/elefante-stabile.png"    },
  { min: 19, max: Number.POSITIVE_INFINITY, name: "Tigre Determinata", status: "Presenza intensa",  image: "/images/animal-guides/tigre-determinata.png"   },
];

const learningSteps = ["Foundation 1", "Foundation 2", "Class 1", "Class 1+"];

// ── Main dashboard ────────────────────────────────────────────────────────────

export function PersonalAreaDashboard({ data }: { data: PersonalAreaData }) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [referenceNow] = useState(() => Date.now());
  const [nicknameOverride, setNicknameOverride] = useState<string | null>(data.profile?.nickname ?? null);

  const sortedEnrollments = useMemo(() => sortEnrollmentsByDate(data.enrollments), [data.enrollments]);
  const futureEnrollments = sortedEnrollments.filter((e) => isFutureEnrollment(e, referenceNow));
  const pastEnrollments   = sortedEnrollments.filter((e) => !isFutureEnrollment(e, referenceNow));
  const nextEnrollment    = futureEnrollments[0] ?? null;
  const otherFutureEnrollments = nextEnrollment ? futureEnrollments.slice(1) : futureEnrollments;
  const displayName = getDisplayName(data, nicknameOverride);
  const guide       = getAnimalGuide(pastEnrollments.length);
  const pathSteps   = getPathSteps(sortedEnrollments, pastEnrollments);

  function changeSection(id: SectionId) { setActiveSection(id); setDrawerOpen(false); }

  return (
    <>
      <div className="flex min-h-screen w-full flex-col bg-[#251508] text-[#f8efe5] lg:flex-row">

        {/* Desktop sidebar */}
        <aside className="hidden w-[300px] shrink-0 border-r border-[#f8efe5]/10 bg-[#2a1a0e] lg:block">
          <DashboardMenu activeSection={activeSection} data={data} guide={guide} onSectionChange={changeSection} pastCount={pastEnrollments.length} />
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_right,rgba(139,94,74,0.22),transparent_34%),linear-gradient(180deg,#2a1a0e_0%,#251508_55%,#1a0d06_100%)]">
          <MobileTopBar displayName={displayName} guide={guide} onOpenMenu={() => setDrawerOpen(true)} />

          <main className="px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:py-8">
              {activeSection === "overview" ? (
                <OverviewSection
                  guide={guide}
                  nextEnrollment={nextEnrollment}
                  otherFutureCount={otherFutureEnrollments.length}
                  onSectionChange={changeSection}
                />
              ) : null}
              {activeSection === "events" ? (
                <EventsSection
                  attendanceStats={data.attendanceStats}
                  futureEnrollments={futureEnrollments}
                  pastEnrollments={pastEnrollments}
                  nextEnrollment={nextEnrollment}
                />
              ) : null}
              {activeSection === "guide"   ? <AnimalGuideSection guide={guide} pastCount={pastEnrollments.length} /> : null}
              {activeSection === "path"    ? <PathSection pathSteps={pathSteps} /> : null}
              {activeSection === "profile" ? <ProfileSection data={data} nicknameOverride={nicknameOverride} onNicknameUpdate={setNicknameOverride} /> : null}
            </main>
          </div>
      </div>

      {/* Mobile drawer — opens from right */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-[220] lg:hidden">
          <button
            aria-label="Chiudi menu"
            className="absolute inset-0 bg-[#0a0503]/65 backdrop-blur-sm"
            type="button"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[min(82vw,320px)] overflow-y-auto bg-[#2a1a0e] shadow-[-18px_0_58px_rgba(0,0,0,0.36)]">
            <div className="flex items-center justify-between border-b border-[#f8efe5]/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Menu</p>
              <button
                aria-label="Chiudi menu"
                className="grid h-9 w-9 place-items-center rounded-full border border-[#f8efe5]/15 text-lg text-[#f8efe5]"
                type="button"
                onClick={() => setDrawerOpen(false)}
              >
                ×
              </button>
            </div>
            <nav className="grid gap-1.5 p-3" aria-label="Navigazione dashboard">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => changeSection(section.id)}
                  className={`flex w-full items-center gap-3 rounded-[12px] border p-3 text-left transition ${
                    activeSection === section.id
                      ? "border-[#d8b5a5]/40 bg-[#8b5e4a]/22 text-[#f8efe5]"
                      : "border-transparent text-[#f8efe5]/65 hover:bg-[#f8efe5]/7 hover:text-[#f8efe5]"
                  }`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
                    activeSection === section.id
                      ? "border-[#d8b5a5]/30 bg-[#f8efe5]/10 text-[#f8efe5]"
                      : "border-[#f8efe5]/10 bg-[#f8efe5]/5 text-[#d8b5a5]"
                  }`}>
                    <DashboardIcon name={section.icon} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{section.label}</span>
                    <span className="mt-0.5 block text-xs text-[#f8efe5]/48">{section.text}</span>
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ── Mobile top bar ────────────────────────────────────────────────────────────

function MobileTopBar({ displayName, guide, onOpenMenu }: {
  displayName: string;
  guide: AnimalGuide;
  onOpenMenu: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#f8efe5]/10 bg-[#2a1a0e]/95 px-4 py-2.5 backdrop-blur-xl lg:hidden" style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top, 0px))" }}>
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm font-medium text-[#f8efe5]/65 transition hover:text-[#f8efe5]"
      >
        <span aria-hidden="true" className="text-base leading-none">←</span>
        Torna al sito
      </Link>

      <div className="flex items-center gap-2.5">
        <span className="text-xs text-[#f8efe5]/50">Ciao {displayName}</span>
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[#d8b5a5]/25 bg-[#f8efe5]/8">
          <Image src={guide.image} alt={guide.name} fill sizes="36px" className="object-cover" />
        </div>
        <button
          aria-label="Apri menu"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#f8efe5]/15 bg-[#f8efe5]/8 text-[#f8efe5]"
          type="button"
          onClick={onOpenMenu}
        >
          <span className="grid gap-[4px]" aria-hidden="true">
            <span className="block h-px w-4 bg-current" />
            <span className="block h-px w-4 bg-current" />
            <span className="block h-px w-3 bg-current" />
          </span>
        </button>
      </div>
    </div>
  );
}

// ── Desktop sidebar menu ──────────────────────────────────────────────────────

function DashboardMenu({ activeSection, data, guide, onSectionChange, pastCount }: {
  activeSection: SectionId;
  data: PersonalAreaData;
  guide: AnimalGuide;
  onSectionChange: (id: SectionId) => void;
  pastCount: number;
}) {
  return (
    <div className="flex min-h-full flex-col p-4">
      <Link
        href="/"
        className="mb-4 flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-sm font-medium text-[#f8efe5]/58 transition hover:bg-[#f8efe5]/6 hover:text-[#f8efe5]"
      >
        <span aria-hidden="true" className="text-base leading-none">←</span>
        Torna al sito
      </Link>

      <div className="rounded-[14px] border border-[#f8efe5]/10 bg-[#251508]/70 p-4">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] border border-[#d8b5a5]/25 bg-[#f8efe5]/8">
            <Image src={guide.image} alt={guide.name} fill sizes="48px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Area personale</p>
            <p className="truncate text-sm font-semibold text-[#f8efe5]">{data.email}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <DarkMetric label="Presenze" value={String(pastCount)} />
          <DarkMetric label="Guida"    value={guide.shortName}   />
        </div>
      </div>

      <nav className="mt-4 grid gap-1.5" aria-label="Area personale">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            className={`group flex w-full items-center gap-3 rounded-[12px] border p-3 text-left transition duration-300 ${
              activeSection === section.id
                ? "border-[#d8b5a5]/40 bg-[#8b5e4a]/22 text-[#f8efe5] shadow-[0_10px_28px_rgba(0,0,0,0.16)]"
                : "border-transparent text-[#f8efe5]/65 hover:border-[#f8efe5]/10 hover:bg-[#f8efe5]/6 hover:text-[#f8efe5]"
            }`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
              activeSection === section.id
                ? "border-[#d8b5a5]/30 bg-[#f8efe5]/10 text-[#f8efe5]"
                : "border-[#f8efe5]/10 bg-[#f8efe5]/5 text-[#d8b5a5]"
            }`}>
              <DashboardIcon name={section.icon} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-5">{section.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-[#f8efe5]/48">{section.text}</span>
            </span>
          </button>
        ))}
      </nav>

      <Link
        href="/calendario"
        className="mt-auto hidden rounded-full border border-[#f8efe5]/15 px-4 py-3 text-center text-sm font-semibold text-[#f8efe5]/68 transition hover:bg-[#f8efe5]/8 lg:block"
      >
        Guarda il calendario
      </Link>
    </div>
  );
}

// ── Overview section ──────────────────────────────────────────────────────────

function OverviewSection({ guide, nextEnrollment, otherFutureCount, onSectionChange }: {
  guide: AnimalGuide;
  nextEnrollment: Enrollment | null;
  otherFutureCount: number;
  onSectionChange: (id: SectionId) => void;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d8b5a5]">Home</p>

      {/* Prossimo evento */}
      {nextEnrollment ? (
        <div className="rounded-[18px] border border-[#d8b5a5]/22 bg-[#f8efe5]/9 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Prossimo evento</p>
          <p className="mt-2 font-serif text-xl font-medium leading-snug">
            {nextEnrollment.events?.title ?? "Evento Peony Studio"}
          </p>
          <p className="mt-1.5 text-sm text-[#f8efe5]/60">{formatCompactDate(nextEnrollment.events?.starts_at)}</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-[#d8b5a5] transition hover:text-[#f8efe5]"
            onClick={() => onSectionChange("events")}
          >
            Vai agli eventi →
          </button>
        </div>
      ) : (
        <div className="rounded-[18px] border border-[#f8efe5]/10 bg-[#f8efe5]/6 p-4">
          <p className="text-sm text-[#f8efe5]/55">Nessun evento in arrivo.</p>
          <Link href="/calendario" className="mt-2 block text-sm font-semibold text-[#d8b5a5] hover:text-[#f8efe5]">
            Guarda il calendario →
          </Link>
        </div>
      )}

      {/* Animale guida compatto */}
      <button
        type="button"
        className="flex items-center gap-3 rounded-[18px] border border-[#f8efe5]/10 bg-[#f8efe5]/7 p-4 text-left transition hover:border-[#d8b5a5]/35"
        onClick={() => onSectionChange("guide")}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] border border-[#d8b5a5]/22 bg-[#f8efe5]/8">
          <Image src={guide.image} alt={guide.name} fill sizes="48px" className="object-cover" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d8b5a5]">Animale guida</p>
          <p className="mt-0.5 text-sm font-semibold text-[#f8efe5]">{guide.name}</p>
          <span className="mt-1 inline-flex rounded-full border border-[#d8b5a5]/22 bg-[#8b5e4a]/18 px-2 py-0.5 text-[11px] font-medium text-[#f8efe5]/80">
            {guide.status}
          </span>
        </div>
      </button>

      {/* Link rapidi */}
      <div className="rounded-[18px] border border-[#f8efe5]/10 bg-[#f8efe5]/6 divide-y divide-[#f8efe5]/8">
        {(["events", "path", "profile"] as SectionId[]).map((id) => {
          const section = sections.find((s) => s.id === id)!;
          return (
            <button
              key={id}
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#f8efe5]/70 transition hover:text-[#f8efe5]"
              onClick={() => onSectionChange(id)}
            >
              {section.label}
              <span aria-hidden="true" className="text-[#d8b5a5]">→</span>
            </button>
          );
        })}
      </div>

      {otherFutureCount > 0 ? (
        <p className="text-xs text-[#f8efe5]/45">
          + {otherFutureCount} altro evento in arrivo —{" "}
          <button type="button" className="underline" onClick={() => onSectionChange("events")}>
            vedi tutti
          </button>
        </p>
      ) : null}
    </div>
  );
}

// ── Events section ────────────────────────────────────────────────────────────

function EventsSection({ attendanceStats, futureEnrollments, pastEnrollments, nextEnrollment }: {
  attendanceStats: PersonalAreaData["attendanceStats"];
  futureEnrollments: Enrollment[];
  pastEnrollments: Enrollment[];
  nextEnrollment: Enrollment | null;
}) {
  const [modalEnrollment, setModalEnrollment] = useState<Enrollment | null>(null);
  const otherFuture = nextEnrollment
    ? futureEnrollments.filter((e) => e.id !== nextEnrollment.id)
    : futureEnrollments;

  return (
    <div className="grid gap-5">
      <SectionIntro
        eyebrow="Eventi"
        title="I tuoi appuntamenti"
        text="Date future, eventi passati e informazioni utili per ogni appuntamento."
      />

      {/* Prossimo evento */}
      {nextEnrollment ? (
        <EventRow enrollment={nextEnrollment} highlight onOpen={setModalEnrollment} />
      ) : (
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Nessun evento in arrivo</p>
          <p className="mt-2 text-sm text-[#f8efe5]/60">Quando ti iscriverai a un evento, lo troverai qui.</p>
          <Link href="/calendario" className="mt-3 inline-flex rounded-full bg-[#f8efe5] px-4 py-2 text-xs font-semibold text-[#2a1a0e]">
            Guarda il calendario
          </Link>
        </Panel>
      )}

      {otherFuture.length > 0 ? (
        <Panel>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Altri eventi in arrivo</p>
          <div className="grid gap-2">
            {otherFuture.map((e) => <EventRow key={e.id} enrollment={e} onOpen={setModalEnrollment} />)}
          </div>
        </Panel>
      ) : null}

      {pastEnrollments.length > 0 ? (
        <Panel>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Eventi passati</p>
          <div className="grid gap-2">
            {pastEnrollments.map((e) => <EventRow key={e.id} enrollment={e} onOpen={setModalEnrollment} />)}
          </div>
        </Panel>
      ) : null}

      {/* Card fissa informazioni spazio */}
      <SpaceInfoCard />

      <div className="grid gap-3 md:grid-cols-2">
        <EventStatCard
          label="EVENTI PRENOTATI"
          value={attendanceStats.booked}
          text="Biglietti collegati alla tua email."
        />
        <EventStatCard
          label="CHECK-IN EFFETTUATI"
          value={attendanceStats.checkedIn}
          text="Ingressi gia validati tramite Ticket Tailor."
        />
      </div>

      {/* Modal dettagli */}
      {modalEnrollment ? (
        <EventDetailModal enrollment={modalEnrollment} onClose={() => setModalEnrollment(null)} />
      ) : null}
    </div>
  );
}

function EventStatCard({
  label,
  text,
  value,
}: {
  label: string;
  text: string;
  value: number;
}) {
  return (
    <Panel>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">
        {label}
      </p>
      <p className="mt-3 font-serif text-[clamp(46px,9vw,72px)] font-medium leading-none text-[#f8efe5]">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-[#f8efe5]/60">{text}</p>
    </Panel>
  );
}

function EventRow({ enrollment, highlight = false, onOpen }: {
  enrollment: Enrollment;
  highlight?: boolean;
  onOpen: (e: Enrollment) => void;
}) {
  return (
    <div className={`rounded-[14px] border p-4 ${
      highlight
        ? "border-[#d8b5a5]/28 bg-[#f8efe5]/10"
        : "border-[#f8efe5]/10 bg-[#f8efe5]/6"
    }`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{enrollment.events?.category ?? "evento"}</Badge>
        <span className="text-xs text-[#f8efe5]/48">{formatCompactDate(enrollment.events?.starts_at)}</span>
      </div>
      <p className="mt-2 font-serif text-xl font-medium leading-snug">
        {enrollment.events?.title ?? "Evento Peony Studio"}
      </p>
      <button
        type="button"
        className="mt-2 text-sm font-semibold text-[#d8b5a5] transition hover:text-[#f8efe5]"
        onClick={() => onOpen(enrollment)}
      >
        Dettagli →
      </button>
    </div>
  );
}

function EventDetailModal({ enrollment, onClose }: { enrollment: Enrollment; onClose: () => void }) {
  const [spaceOpen, setSpaceOpen] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[230] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Chiudi dettagli"
        className="absolute inset-0 bg-[#0a0503]/70 backdrop-blur-sm"
        type="button"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[20px] border border-[#f8efe5]/12 bg-[#2a1a0e] p-5 shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-1.5">
              <Badge>{enrollment.events?.category ?? "evento"}</Badge>
            </div>
            <h2 className="mt-3 font-serif text-2xl font-medium leading-snug">
              {enrollment.events?.title ?? "Evento Peony Studio"}
            </h2>
            <p className="mt-1.5 text-sm text-[#f8efe5]/60">{formatCompactDate(enrollment.events?.starts_at)}</p>
          </div>
          <button
            aria-label="Chiudi"
            className="shrink-0 grid h-9 w-9 place-items-center rounded-full border border-[#f8efe5]/15 text-lg text-[#f8efe5]"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="mt-4 rounded-[10px] border border-[#d8b5a5]/20 bg-[#8b5e4a]/12 px-3 py-2 text-xs text-[#d8b5a5]">
          Verifica gli orari definitivi — potrebbero variare.
        </p>

        {enrollment.events?.booking_url ? (
          <Link
            href={enrollment.events.booking_url}
            target="_blank"
            className="mt-4 inline-flex rounded-full border border-[#f8efe5]/20 px-4 py-2 text-sm font-semibold text-[#f8efe5] transition hover:bg-[#f8efe5]/10"
          >
            Apri Ticket Tailor
          </Link>
        ) : null}

        {/* Informazioni spazio — accordion */}
        <div className="mt-4 rounded-[14px] border border-[#f8efe5]/10 bg-[#f8efe5]/5">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-[#f8efe5]"
            onClick={() => setSpaceOpen((v) => !v)}
          >
            Informazioni spazio
            <span aria-hidden="true" className={`text-[#d8b5a5] transition ${spaceOpen ? "rotate-45" : ""}`}>+</span>
          </button>
          {spaceOpen ? <SpaceInfoContent /> : null}
        </div>
      </div>
    </div>
  );
}

function SpaceInfoCard() {
  const [open, setOpen] = useState(false);
  return (
    <Panel>
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Informazioni spazio</p>
          <p className="mt-1 text-sm text-[#f8efe5]/62">Accesso, regole, contatti e partner.</p>
        </div>
        <span aria-hidden="true" className={`text-2xl text-[#d8b5a5] transition ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open ? <SpaceInfoContent /> : null}
    </Panel>
  );
}

function SpaceInfoContent() {
  return (
    <div className="mt-4 grid gap-3 border-t border-[#f8efe5]/10 pt-4 text-sm leading-relaxed text-[#f8efe5]/70">
      <div>
        <p className="font-semibold text-[#f8efe5]">Peony Studio</p>
        <p>Via Vandalino 85/38, Torino (Citofono: UR Expression). Piano -1.</p>
        <a href="https://maps.app.goo.gl/CnoZpoZmgzP3Absg9" target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[#d8b5a5] underline">
          Aprici su Google Maps
        </a>
      </div>
      <div>
        <p className="font-semibold text-[#f8efe5]">Come accedere</p>
        <ul className="mt-1 grid gap-0.5 list-disc pl-4">
          <li>In metro: fermata Marche, uscita Via Eritrea — 5 minuti a piedi</li>
          <li>In auto: parcheggio su strada nei dintorni</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-[#f8efe5]">{"Indicazioni per l'arrivo"}</p>
        <ul className="mt-1 grid gap-0.5 list-disc pl-4">
          <li>{"Non sostare in gruppo davanti all'ingresso"}</li>
          <li>Citofono: UR Expression — Piano -1</li>
          <li>{"Silenzio nelle scale: il palazzo è abitato da persone anziane"}</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-[#f8efe5]">Cerchi partner?</p>
        <p>
          <a href="https://t.me/+7a88epSRmP04MzA0" target="_blank" rel="noopener noreferrer" className="text-[#d8b5a5] underline">Canale Telegram Peony Calls</a>
          {" "}o{" "}
          <a href="https://forms.gle/8FtNkM9A6Phdegb26" target="_blank" rel="noopener noreferrer" className="text-[#d8b5a5] underline">modulo partner</a>
        </p>
      </div>
      <div>
        <p className="font-semibold text-[#f8efe5]">Regole dello spazio</p>
        <ul className="mt-1 grid gap-0.5 list-disc pl-4">
          <li>{"Spazio senza scarpe: toglile all'ingresso"}</li>
          <li>{"Borse nell'area indicata dallo staff"}</li>
          <li>{"Vietato fumare all'interno (incluso vape)"}</li>
          <li>{"No drink aperti nell'area workshop/corde"}</li>
          <li>Acqua potabile disponibile in cucina</li>
          <li><a href="https://www.peonystudio.net/vademecum-rope-jam" target="_blank" rel="noopener noreferrer" className="text-[#d8b5a5] underline">Vademecum completo</a></li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-[#f8efe5]">Contatto emergenza</p>
        <p>+39 320 6486577 — WhatsApp/Telegram</p>
      </div>
      <div>
        <p className="font-semibold text-[#f8efe5]">Pagamento quota</p>
        <p>
          Sul posto oppure via{" "}
          <a href="https://web.satispay.com/download/qrcode/S6Y-CON--992EF584-115F-4A05-8B24-E650872EB2A8?locale=it" target="_blank" rel="noopener noreferrer" className="text-[#d8b5a5] underline">Satispay</a>
          {" "}(oggetto: nome evento + nome cognome).
        </p>
      </div>
      <div>
        <p className="font-semibold text-[#f8efe5]">Iscrizione associazione</p>
        <p>
          {"Se hai acquistato \"Non associati\" e non sei ancora iscritto ad UR Expression, completa l'iscrizione prima dell'evento:"}{" "}
          <a href="https://forms.gle/f6osniuC39UhXGoV8" target="_blank" rel="noopener noreferrer" className="text-[#d8b5a5] underline">Modulo iscrizione</a>.
          {" Se hai iscritto anche il/la partner, condividi il link del modulo."}
        </p>
      </div>
    </div>
  );
}

// ── Animal guide section ──────────────────────────────────────────────────────

function AnimalGuideSection({ guide, pastCount }: { guide: AnimalGuide; pastCount: number }) {
  return (
    <div className="grid gap-5">
      <SectionIntro
        eyebrow="Guida"
        title="Il tuo animale guida"
        text="Cambia con la tua presenza nello spazio."
      />
      <Panel>
        {/* Image — max 200px, no overlay text (the PNG has text embedded) */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-[14px] border border-[#d8b5a5]/24 bg-[#f8efe5]/8">
            <Image src={guide.image} alt={guide.name} fill sizes="192px" className="object-cover" />
          </div>
          <div className="flex-1">
            {/* Name and badge — text only, below/beside image */}
            <p className="font-serif text-2xl font-medium">{guide.name}</p>
            <span className="mt-2 inline-flex rounded-full border border-[#d8b5a5]/25 bg-[#8b5e4a]/18 px-3 py-1 text-xs font-semibold text-[#f8efe5]">
              {guide.status}
            </span>
            {/* Compact info rows */}
            <div className="mt-4 grid gap-2">
              <div className="flex items-center justify-between rounded-[10px] border border-[#f8efe5]/10 bg-[#f8efe5]/6 px-3 py-2">
                <span className="text-xs text-[#f8efe5]/58">Presenze</span>
                <span className="text-sm font-semibold text-[#f8efe5]">{pastCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border border-[#f8efe5]/10 bg-[#f8efe5]/6 px-3 py-2">
                <span className="text-xs text-[#f8efe5]/58">Prossima evoluzione</span>
                <span className="text-sm font-semibold text-[#f8efe5]">
                  {guide.missingToNext ? `a ${guide.missingToNext} presenze` : "Intensa"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ── Path section ──────────────────────────────────────────────────────────────

function PathSection({ pathSteps }: { pathSteps: PathStep[] }) {
  return (
    <div className="grid gap-5">
      <SectionIntro
        eyebrow="Percorso"
        title="Il tuo percorso"
        text="La progressione è orientativa: l'ingresso dipende dall'esperienza e dalla pratica reale."
      />
      <Panel>
        <div className="grid gap-3 md:grid-cols-4">
          {pathSteps.map((step, index) => (
            <div
              key={step.name}
              className={`rounded-[16px] border p-4 ${
                step.status === "completato"
                  ? "border-[#d8b5a5]/35 bg-[#8b5e4a]/20"
                  : step.status === "suggerito"
                    ? "border-[#f8efe5]/18 bg-[#f8efe5]/10"
                    : "border-[#f8efe5]/10 bg-[#f8efe5]/5"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d8b5a5]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 font-serif text-2xl font-medium">{step.name}</h3>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f8efe5]/55">
                {step.status}
              </p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">In parallelo</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {["Pratica Assistita", "Classi Tematiche"].map((item) => (
            <div key={item} className="rounded-[14px] border border-[#f8efe5]/10 bg-[#f8efe5]/6 p-4">
              <h3 className="font-serif text-xl font-medium">{item}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#f8efe5]/60">
                Corsia di supporto: ripetere, consolidare e approfondire.
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection({ data, nicknameOverride, onNicknameUpdate }: {
  data: PersonalAreaData;
  nicknameOverride: string | null;
  onNicknameUpdate: (v: string | null) => void;
}) {
  const status    = data.profile?.association_status ?? null;
  const expiresAt = data.profile?.association_expires_at;
  const membershipOk  = status === "verified" || status === "not_required";
  const membershipBad = status === "expired" || status === "missing" || status === "pending" || status === "unknown";

  const [nickname, setNickname] = useState(nicknameOverride ?? "");
  const [saving,   setSaving]   = useState(false);
  const [savedOk,  setSavedOk]  = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function saveNickname() {
    if (!data.profile?.id) return;
    setSaving(true);
    setSavedOk(false);
    setSaveError(null);
    const supabase = createSupabaseBrowserClient();
    const newNickname = nickname.trim() || null;
    const { error } = await supabase
      .from("profiles")
      .update({ nickname: newNickname })
      .eq("id", data.profile.id);
    setSaving(false);
    if (error) {
      setSaveError("Errore nel salvataggio. Riprova.");
    } else {
      setSavedOk(true);
      onNicknameUpdate(newNickname);
      setTimeout(() => setSavedOk(false), 2000);
    }
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/area-personale/login";
  }

  return (
    <div className="grid gap-5">
      {membershipOk ? (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-emerald-500/30 bg-emerald-900/25 px-4 py-3 text-sm font-medium text-emerald-300">
          <span>✓</span>
          <span>Tessera aggiornata</span>
        </div>
      ) : membershipBad ? (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-amber-500/30 bg-amber-900/22 px-4 py-3 text-sm font-medium text-amber-300">
          <span>⚠</span>
          <span>Verifica la tua tessera — contattaci per aggiornarla</span>
        </div>
      ) : null}

      <SectionIntro
        eyebrow="Profilo"
        title="Il tuo profilo"
        text="Dati, tessera e funzioni di gestione."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Profilo</p>
          <h3 className="mt-2 font-serif text-3xl font-medium">{getDisplayName(data, nicknameOverride)}</h3>
          <p className="mt-2 text-sm text-[#f8efe5]/60">{data.email}</p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Tessera associativa</p>
          <h3 className="mt-2 font-serif text-3xl font-medium">{formatAssociationStatus(status)}</h3>
          <p className="mt-2 text-sm text-[#f8efe5]/60">
            Scadenza: {expiresAt ? formatShortDate(expiresAt) : "da verificare"}
          </p>
        </Panel>
      </div>

      <Panel>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Nickname</p>
        <p className="mt-1 text-xs text-[#f8efe5]/50">Come vuoi essere chiamato/a nel tuo profilo</p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Come vuoi essere chiamato/a?"
            className="flex-1 rounded-full border border-[#f8efe5]/15 bg-[#f8efe5]/8 px-4 py-2 text-sm text-[#f8efe5] outline-none placeholder:text-[#f8efe5]/30 focus:border-[#d8b5a5]/50"
          />
          <button
            type="button"
            onClick={saveNickname}
            disabled={saving}
            className="rounded-full border border-[#d8b5a5]/30 bg-[#f8efe5]/10 px-5 py-2 text-sm font-semibold text-[#f8efe5] transition hover:bg-[#f8efe5]/15 disabled:opacity-50"
          >
            {saving ? "…" : savedOk ? "Salvato ✓" : "Salva"}
          </button>
        </div>
        {saveError ? <p className="mt-2 text-xs text-red-400">{saveError}</p> : null}
      </Panel>

      <Panel>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b5a5]">Note</p>
        <p className="mt-2 text-sm leading-relaxed text-[#f8efe5]/65">
          Lo stato tessera è aggiornato dallo staff Peony Studio.
        </p>
        <button
          className="mt-4 rounded-full border border-[#f8efe5]/20 px-5 py-2.5 text-sm font-semibold text-[#f8efe5] transition hover:bg-[#f8efe5]/10"
          type="button"
          onClick={logout}
        >
          Esci dall&apos;area personale
        </button>
      </Panel>
    </div>
  );
}

// ── Shared UI components ──────────────────────────────────────────────────────

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d8b5a5]">{eyebrow}</p>
      <h1 className="mt-2 max-w-4xl font-serif text-[clamp(24px,4.5vw,40px)] font-medium leading-[1.06]">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#f8efe5]/60">{text}</p>
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[18px] border border-[#f8efe5]/10 bg-[#f8efe5]/7 p-5 shadow-[inset_0_1px_0_rgba(248,239,229,0.04)] ${className}`}>
      {children}
    </section>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[#f8efe5]/10 bg-[#f8efe5]/6 p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#d8b5a5]">{label}</p>
      <p className="mt-1 truncate font-serif text-xl font-medium text-[#f8efe5]">{value}</p>
    </div>
  );
}


function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[#f8efe5]/10 bg-[#f8efe5]/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f8efe5]/60">
      {children}
    </span>
  );
}

function DashboardIcon({ name }: { name: string }) {
  const common = { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24" };
  if (name === "ticket") return <svg aria-hidden="true" {...common}><path d="M5 8.5V6.8c0-.9.7-1.6 1.6-1.6h10.8c.9 0 1.6.7 1.6 1.6v1.7a2.5 2.5 0 0 0 0 5v3.7c0 .9-.7 1.6-1.6 1.6H6.6c-.9 0-1.6-.7-1.6-1.6v-3.7a2.5 2.5 0 0 0 0-5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
  if (name === "path")   return <svg aria-hidden="true" {...common}><path d="M5 18c6 0 3-12 9-12h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /><path d="M5 18a2 2 0 1 0 0 .1M19 6a2 2 0 1 0 0 .1M12 12h.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
  if (name === "card")   return <svg aria-hidden="true" {...common}><path d="M4.5 7.5c0-1 .8-1.8 1.8-1.8h11.4c1 0 1.8.8 1.8 1.8v9c0 1-.8 1.8-1.8 1.8H6.3c-1 0-1.8-.8-1.8-1.8v-9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /><path d="M4.8 10h14.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
  if (name === "eye")    return <svg aria-hidden="true" {...common}><path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /><path d="M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.7" /></svg>;
  return <svg aria-hidden="true" {...common}><path d="M12 3.8 14.2 9l5.6.4-4.2 3.7 1.3 5.5-4.9-2.9-4.9 2.9 1.3-5.5-4.2-3.7L9.8 9 12 3.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AnimalGuide = (typeof animalGuides)[number] & { missingToNext: number | null; shortName: string };
type PathStep    = { name: string; status: "completato" | "suggerito" | "non ancora iniziato" };

// ── Utility functions — unchanged logic ───────────────────────────────────────

function getAnimalGuide(presences: number): AnimalGuide {
  const current = animalGuides.find((g) => presences >= g.min && presences <= g.max) ?? animalGuides[0];
  const next    = animalGuides.find((g) => g.min > presences);
  return { ...current, missingToNext: next ? next.min - presences : null, shortName: current.name.split(" ")[0] };
}

function getPathSteps(enrollments: Enrollment[], pastEnrollments: Enrollment[]): PathStep[] {
  const completedIndex = learningSteps.reduce((highest, step, index) => {
    const done = pastEnrollments.some((e) => matchesStep(e.events?.title, step));
    return done ? Math.max(highest, index) : highest;
  }, -1);
  const suggestedIndex = Math.min(completedIndex + 1, learningSteps.length - 1);

  return learningSteps.map((step, index) => {
    if (index <= completedIndex) return { name: step, status: "completato" };
    const hasEnrollment = enrollments.some((e) => matchesStep(e.events?.title, step));
    if (index === suggestedIndex || hasEnrollment) return { name: step, status: "suggerito" };
    return { name: step, status: "non ancora iniziato" };
  });
}

function matchesStep(title: string | null | undefined, step: string) {
  const t = title?.toLowerCase() ?? "";
  const s = step.toLowerCase();
  if (s === "class 1+") return t.includes("class 1+") || t.includes("classe 1+");
  if (s === "class 1")  return (t.includes("class 1") || t.includes("classe 1")) && !t.includes("1+");
  return t.includes(s);
}

function getDisplayName(data: PersonalAreaData, nicknameOverride?: string | null) {
  const nickname = (nicknameOverride !== undefined ? nicknameOverride : data.profile?.nickname)?.trim();
  if (nickname) return nickname;
  const firstName = data.profile?.first_name?.trim();
  return firstName ?? data.email.split("@")[0]?.split(/[._-]/)[0] ?? "Peony";
}

function sortEnrollmentsByDate(enrollments: Enrollment[]) {
  return [...enrollments].sort((a, b) => {
    const aTime = getEnrollmentTime(a) ?? Number.MAX_SAFE_INTEGER;
    const bTime = getEnrollmentTime(b) ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

function isFutureEnrollment(enrollment: Enrollment, now: number) {
  const t = getEnrollmentTime(enrollment);
  return t !== null && t >= now;
}

function getEnrollmentTime(enrollment: Enrollment) {
  const value = enrollment.events?.starts_at;
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function formatCompactDate(value?: string | null): string {
  if (!value) return "Data da confermare";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const opts = { timeZone: "Europe/Rome" } as const;
  const weekday = new Intl.DateTimeFormat("it-IT", { weekday: "short", ...opts }).format(date);
  const day     = new Intl.DateTimeFormat("it-IT", { day:     "numeric", ...opts }).format(date);
  const month   = new Intl.DateTimeFormat("it-IT", { month:   "short",   ...opts }).format(date);
  const time    = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", ...opts }).format(date);
  return `${weekday} ${day} ${month} · ore ${time}`;
}


function formatShortDate(value?: string | null) {
  if (!value) return "Non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatAssociationStatus(status: string | null) {
  const labels: Record<string, string> = {
    unknown: "Da verificare", missing: "Mancante", pending: "In verifica",
    verified: "Verificata", expired: "Scaduta", not_required: "Non richiesta",
  };
  return labels[status ?? "unknown"] ?? status ?? "Da verificare";
}
