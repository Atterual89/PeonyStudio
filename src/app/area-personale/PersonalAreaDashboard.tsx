"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";
import type { Dictionary } from "@/i18n/getDictionary";
import type { PersonalAreaData } from "@/lib/personal-area";

type SectionId =
  | "next"
  | "events"
  | "membership"
  | "info"
  | "partner"
  | "path";

type Enrollment = PersonalAreaData["enrollments"][number];
type PersonalAreaCopy = Dictionary["personalArea"];

const sectionCardConfig: Array<{
  id: SectionId;
  icon: string;
}> = [
  {
    id: "next",
    icon: "calendar",
  },
  {
    id: "events",
    icon: "ticket",
  },
  {
    id: "membership",
    icon: "card",
  },
  {
    id: "info",
    icon: "info",
  },
  {
    id: "partner",
    icon: "people",
  },
  {
    id: "path",
    icon: "path",
  },
];

export function PersonalAreaDashboard({ data }: { data: PersonalAreaData }) {
  const { dictionary, locale } = useLanguage();
  const copy = dictionary.personalArea;
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
              {copy.eyebrow}
            </p>
            <h1 className="mt-4 font-serif text-[clamp(42px,8vw,72px)] font-medium leading-[0.98]">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#5f524c]">
              {copy.loggedInAs}{" "}
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
              {copy.openSummary}
            </button>
            <Link
              className="inline-flex w-fit rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 hover:border-[#8b5e4a]"
              href="/calendario"
            >
              {copy.calendarCta}
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
              copy={copy}
              onSectionChange={openSection}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between rounded-[8px] border border-[#211815]/10 bg-white/45 px-4 py-3 lg:hidden">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
                {copy.activeSection}
              </p>
              <p className="font-serif text-2xl font-medium">
                {getSectionTitle(activeSection, copy)}
              </p>
            </div>
            <button
              className="rounded-full bg-[#211815] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe8]"
              type="button"
              onClick={() => setSidebarOpen(true)}
            >
              {copy.menu}
            </button>
          </div>

          {activeSection === "next" ? (
            <NextEventSection
              copy={copy}
              enrollment={nextEnrollment}
              locale={locale}
              onOpen={openEvent}
            />
          ) : null}
          {activeSection === "events" ? (
            <EventsSection
              copy={copy}
              futureEnrollments={futureEnrollments}
              locale={locale}
              pastEnrollments={pastEnrollments}
              selectedEnrollment={selectedEnrollment}
              onOpen={openEvent}
            />
          ) : null}
          {activeSection === "membership" ? (
            <MembershipSection copy={copy} data={data} locale={locale} />
          ) : null}
          {activeSection === "info" ? <UsefulInfoSection copy={copy} /> : null}
          {activeSection === "partner" ? <PartnerSection copy={copy} /> : null}
          {activeSection === "path" ? <PathSection copy={copy} /> : null}
        </div>
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label={copy.closeSummary}
            className="absolute inset-0 bg-[#211815]/35"
            type="button"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full w-[min(88vw,360px)] overflow-y-auto bg-[#f4efe8] p-4 shadow-[18px_0_48px_rgba(33,24,21,0.18)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b5e4a]">
                {copy.recap}
              </p>
              <button
                aria-label={copy.closeSummary}
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
              copy={copy}
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
  copy,
  data,
  onSectionChange,
}: {
  activeSection: SectionId;
  copy: PersonalAreaCopy;
  data: PersonalAreaData;
  onSectionChange: (sectionId: SectionId) => void;
}) {
  const sectionCards = getSectionCards(copy);

  return (
    <div className="rounded-[8px] border border-[#211815]/10 bg-white/55 p-4 shadow-[0_12px_36px_rgba(33,24,21,0.06)]">
      <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/75 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-[#8b5e4a]/30 bg-white/70 font-serif text-2xl text-[#8b5e4a]">
            {data.email.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
              {copy.profile}
            </p>
            <p className="truncate text-sm font-semibold text-[#211815]">
              {data.email}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SidebarMetric
            label={copy.status}
            value={data.profileLinked ? copy.profileOk : copy.profileCheck}
          />
          <SidebarMetric
            label={copy.enrollmentsMetric}
            value={String(data.claimedBuyerParticipants)}
          />
          <SidebarMetric
            label={copy.eventsMetric}
            value={String(data.enrollments.length)}
          />
        </div>
      </div>

      <nav className="mt-4 space-y-2" aria-label={copy.navAria}>
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

function getSectionCards(copy: PersonalAreaCopy) {
  return sectionCardConfig.map((card) => ({
    ...card,
    title: copy.sections[card.id].title,
    text: copy.sections[card.id].text,
  }));
}

function getSectionTitle(sectionId: SectionId, copy: PersonalAreaCopy) {
  return copy.sections[sectionId]?.title ?? copy.title;
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
  copy,
  enrollment,
  locale,
  onOpen,
}: {
  copy: PersonalAreaCopy;
  enrollment: Enrollment | null;
  locale: string;
  onOpen: (enrollment: Enrollment) => void;
}) {
  return (
    <SectionShell eyebrow={copy.labels.nextDate} title={copy.sections.next.title}>
      {enrollment ? (
        <div className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge>{enrollment.events?.category ?? copy.labels.event}</Badge>
                <Badge>{copy.labels.ticketTailor}</Badge>
              </div>
              <h3 className="mt-4 font-serif text-3xl font-medium">
                {enrollment.events?.title ?? copy.labels.peonyEvent}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#5f524c]">
                {formatEventDate(enrollment.events?.starts_at, copy, locale)}
              </p>
            </div>
            <button
              className="inline-flex w-fit rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5"
              type="button"
              onClick={() => onOpen(enrollment)}
            >
              {copy.labels.openEventDetails}
            </button>
          </div>
        </div>
      ) : (
        <EmptyEventsMessage copy={copy} />
      )}
    </SectionShell>
  );
}

function EventsSection({
  copy,
  futureEnrollments,
  locale,
  pastEnrollments,
  selectedEnrollment,
  onOpen,
}: {
  copy: PersonalAreaCopy;
  futureEnrollments: Enrollment[];
  locale: string;
  pastEnrollments: Enrollment[];
  selectedEnrollment: Enrollment | null;
  onOpen: (enrollment: Enrollment) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <SectionShell eyebrow={copy.labels.appointments} title={copy.sections.events.title}>
        {futureEnrollments.length === 0 && pastEnrollments.length === 0 ? (
          <EmptyEventsMessage copy={copy} />
        ) : (
          <div className="mt-5 space-y-6">
            <EventGroup
              copy={copy}
              locale={locale}
              title={copy.labels.future}
              enrollments={futureEnrollments}
              onOpen={onOpen}
            />
            <EventGroup
              copy={copy}
              locale={locale}
              title={copy.labels.past}
              enrollments={pastEnrollments}
              onOpen={onOpen}
            />
          </div>
        )}
      </SectionShell>

      <EventDetail copy={copy} enrollment={selectedEnrollment} locale={locale} />
    </div>
  );
}

function EventGroup({
  copy,
  title,
  enrollments,
  locale,
  onOpen,
}: {
  copy: PersonalAreaCopy;
  title: string;
  enrollments: Enrollment[];
  locale: string;
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
              <Badge>{enrollment.events?.category ?? copy.labels.event}</Badge>
              <Badge>{formatEnrollmentStatus(enrollment.enrollment_status, copy)}</Badge>
            </div>
            <p className="mt-3 font-serif text-2xl font-medium">
              {enrollment.events?.title ?? copy.labels.peonyEvent}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5f524c]">
              {formatEventDate(enrollment.events?.starts_at, copy, locale)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function EventDetail({
  copy,
  enrollment,
  locale,
}: {
  copy: PersonalAreaCopy;
  enrollment: Enrollment | null;
  locale: string;
}) {
  return (
    <SectionShell eyebrow={copy.labels.detail} title={copy.labels.eventDetails}>
      {enrollment ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{enrollment.events?.category ?? copy.labels.event}</Badge>
              <Badge>{copy.labels.ticketTailor}</Badge>
            </div>
            <h3 className="mt-3 font-serif text-3xl font-medium">
              {enrollment.events?.title ?? copy.labels.peonyEvent}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#5f524c]">
              {formatEventDate(enrollment.events?.starts_at, copy, locale)}
            </p>
          </div>

          <InfoGrid
            items={[
              {
                title: copy.labels.program,
                text: formatProgram(enrollment, copy, locale),
              },
              {
                title: copy.labels.location,
                text: copy.copy.location,
              },
              {
                title: copy.labels.directions,
                text: copy.copy.directions,
              },
              {
                title: copy.labels.access,
                text: copy.copy.access,
              },
              {
                title: copy.labels.spaceRules,
                text: copy.copy.rules,
              },
              {
                title: copy.labels.emergency,
                text: copy.copy.emergency,
              },
              {
                title: copy.labels.ticketStatus,
                text: formatEnrollmentStatus(enrollment.enrollment_status, copy),
              },
            ]}
          />

          {enrollment.events?.booking_url ? (
            <Link
              className="inline-flex rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 hover:border-[#8b5e4a]"
              href={enrollment.events.booking_url}
              target="_blank"
            >
              {copy.labels.openTicketTailor}
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-5 text-sm leading-6 text-[#5f524c]">
          {copy.labels.chooseEvent}
        </p>
      )}
    </SectionShell>
  );
}

function MembershipSection({
  copy,
  data,
  locale,
}: {
  copy: PersonalAreaCopy;
  data: PersonalAreaData;
  locale: string;
}) {
  const status = data.profile?.association_status ?? "unknown";
  const expiresAt = data.profile?.association_expires_at;

  return (
    <SectionShell eyebrow={copy.labels.membership} title={copy.sections.membership.title}>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
            {copy.labels.membershipStatus}
          </p>
          <p className="mt-2 font-serif text-3xl font-medium">
            {formatAssociationStatus(status, copy)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5f524c]">
            {status === "unknown"
              ? copy.copy.membershipUnknown
              : copy.copy.membershipManual}
          </p>
        </div>
        <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
            {copy.labels.expiry}
          </p>
          <p className="mt-2 font-serif text-3xl font-medium">
            {expiresAt ? formatShortDate(expiresAt, locale) : copy.labels.toVerify}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5f524c]">
            {copy.copy.membershipHelp}
          </p>
        </div>
      </div>
    </SectionShell>
  );
}

function UsefulInfoSection({ copy }: { copy: PersonalAreaCopy }) {
  return (
    <SectionShell eyebrow="Studio" title={copy.sections.info.title}>
      <InfoGrid
        items={[
          {
            title: copy.labels.address,
            text: copy.copy.location,
          },
          {
            title: copy.labels.entrance,
            text: copy.copy.entrance,
          },
          {
            title: copy.labels.metro,
            text: copy.copy.directions,
          },
          {
            title: copy.labels.arrival,
            text: copy.copy.arrival,
          },
          {
            title: copy.labels.space,
            text: copy.copy.space,
          },
          {
            title: copy.labels.emergency,
            text: copy.copy.emergency,
          },
        ]}
      />
    </SectionShell>
  );
}

function PartnerSection({ copy }: { copy: PersonalAreaCopy }) {
  return (
    <SectionShell eyebrow="Partecipazione" title={copy.sections.partner.title}>
      <p className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-5 text-sm leading-6 text-[#5f524c]">
        {copy.copy.partner}
      </p>
    </SectionShell>
  );
}

function PathSection({ copy }: { copy: PersonalAreaCopy }) {
  return (
    <SectionShell eyebrow={copy.labels.path} title={copy.sections.path.title}>
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
        {copy.copy.path}
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

function EmptyEventsMessage({ copy }: { copy: PersonalAreaCopy }) {
  return (
    <div className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-5 text-sm leading-6 text-[#5f524c]">
      {copy.copy.noEvents}
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

function formatEventDate(
  value: string | null | undefined,
  copy: PersonalAreaCopy,
  locale: string,
) {
  if (!value) {
    return copy.statuses.dateToConfirm;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatProgram(
  enrollment: Enrollment,
  copy: PersonalAreaCopy,
  locale: string,
) {
  const start = formatEventDate(enrollment.events?.starts_at, copy, locale);
  const end = enrollment.events?.ends_at
    ? formatEventDate(enrollment.events.ends_at, copy, locale)
    : null;

  return end ? `${start} - ${end}` : start;
}

function formatEnrollmentStatus(status: string | null, copy: PersonalAreaCopy) {
  if (!status || status === "active") {
    return copy.statuses.confirmed;
  }

  return status.replaceAll("_", " ");
}

function formatAssociationStatus(status: string | null, copy: PersonalAreaCopy) {
  const normalized = status ?? "unknown";
  const labels: Record<string, string> = {
    unknown: copy.statuses.unknown,
    missing: copy.statuses.missing,
    pending: copy.statuses.pending,
    verified: copy.statuses.verified,
    expired: copy.statuses.expired,
    not_required: copy.statuses.notRequired,
  };

  return labels[normalized] ?? normalized;
}
