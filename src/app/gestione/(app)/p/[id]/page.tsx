import Link from "next/link";
import { notFound } from "next/navigation";

import { DeletePersonSection } from "@/components/gestionale/Deletion";
import { FlashMessage, FlashProvider } from "@/components/gestionale/Flash";
import { MemberCard } from "@/components/gestionale/MemberCard";
import { MemberLinker, MemberUnlink } from "@/components/gestionale/MemberLinker";
import { PersonForm } from "@/components/gestionale/PersonForm";
import { QuotaOkControls, RefreshMembershipButton } from "@/components/gestionale/QuotaOk";
import { AssociationMailSyncControl } from "@/components/gestionale/AssociationMailSyncControl";
import { Notice, Section, buttonClass, cardClass } from "@/components/gestionale/ui";
import { displayName, formatDate, formatDateRange, fullName } from "@/lib/gestionale/format";
import { DUPLICATE_REASON_LABELS, findPossibleDuplicates, peopleSharingEmail } from "@/lib/gestionale/people";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson, getPersonHistory, loadPeople } from "@/lib/gestionale/server/data";
import { memberKeyOfPerson } from "@/lib/gestionale/member-key";
import { getLinkedMemberSummary, getMembershipBadges } from "@/lib/gestionale/server/membership";
import { todayInRome } from "@/lib/gestionale/workshops";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { contactLabel } from "@/lib/gestionale/contacts";
import { MEMBERSHIP_SHORT_LABELS, formatPeriod, periodLabel, personPeriods } from "@/lib/gestionale/membership-rule";
import { MembershipBadge } from "@/components/gestionale/MembershipBadge";
import type { MembershipBadge as Badge } from "@/lib/gestionale/types";
import { getPersonContacts } from "@/lib/gestionale/server/contacts";
import { loadAliases } from "@/lib/gestionale/server/aliases";
import { BOOKING_STATUS_LABELS } from "@/lib/gestionale/labels";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const person = await getPerson(id);
  if (!person) notFound();

  const people = await loadPeople();

  if (person.merged_into) {
    const target = people.find((p) => p.id === person.merged_into);
    return (
      <section className="max-w-xl">
        <h1 className="font-serif text-xl font-medium">{displayName(person)}</h1>
        <div className="mt-4">
          <Notice tone="warning">
            Questa scheda è stata unita a{" "}
            <Link prefetch={false} href={`/gestione/p/${person.merged_into}`} className="underline">
              {target ? displayName(target) : "un'altra persona"}
            </Link>
            .
          </Notice>
        </div>
      </section>
    );
  }

  const [history, member, badges, contacts, aliases] = await Promise.all([
    getPersonHistory(person.id),
    getLinkedMemberSummary(person),
    // Stato tessera di oggi (periodo associativo in corso).
    getMembershipBadges([person], todayInRome()),
    getPersonContacts(person.id),
    loadAliases(person.id),
  ]);
  // 4e (#15): stato tessera per periodo (oggi e i periodi dei suoi workshop),
  // come nel tab Partecipanti di ognuno.
  const periods = personPeriods(
    todayInRome(),
    history.filter((row) => !row.removedAt).map((row) => row.startsOn),
  );
  const periodBadges = await Promise.all(
    periods.map(async (period) => ({
      period,
      badge: (await getMembershipBadges([person], period.paymentsFrom)).get(person.id) ?? ({ kind: "non_collegata" } as Badge),
    })),
  );
  const markName = fullName(person) && person.first_name && person.last_name ? fullName(person) : displayName(person);
  const canMark = Boolean((person.first_name && person.last_name) || person.email || member?.email || (member?.first_name && member?.last_name));
  const duplicates = findPossibleDuplicates(person, people);
  const sharedEmail = peopleSharingEmail(person, people);

  return (
    <section className="max-w-3xl">
      <Link prefetch={false} href="/gestione/persone" className="text-sm text-[#5f524c] underline">
        ← Persone
      </Link>
      <h1 className="mt-2 font-serif text-xl font-medium">{displayName(person)}</h1>
      <p className="mt-1 text-sm text-[#5f524c]">
        Creata il {formatDate(person.created_at)} · aggiornata il {formatDate(person.updated_at)} ·{" "}
        {/* Fase 5: storico già filtrato su questa persona. */}
        <Link prefetch={false} href={`/gestione/altro/storico?persona=${person.id}`} className="underline">
          Storico
        </Link>
      </p>

      {sharedEmail.length > 0 ? (
        <div className="mt-4">
          <Notice tone="warning">
            Email usata anche da:{" "}
            {sharedEmail.map((other, index) => (
              <span key={other.id}>
                {index > 0 ? ", " : ""}
                <Link prefetch={false} href={`/gestione/p/${other.id}`} className="underline">
                  {displayName(other)}
                </Link>
              </span>
            ))}
          </Notice>
        </div>
      ) : null}

      {duplicates.length > 0 ? (
        <div className={`${cardClass} mt-4 p-3`}>
          <p className="font-semibold">Possibili duplicati</p>
          <ul className="mt-2 space-y-2">
            {duplicates.map(({ person: other, reasons }) => (
              <li key={other.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Link prefetch={false} href={`/gestione/p/${other.id}`} className="font-semibold underline">
                    {displayName(other)}
                  </Link>
                  <span className="ml-2 text-sm text-[#5f524c]">
                    {reasons.map((reason) => DUPLICATE_REASON_LABELS[reason]).join(", ")}
                  </span>
                </span>
                <Link prefetch={false} href={`/gestione/p/${person.id}/unisci/${other.id}`} className={buttonClass.secondary}>
                  Unisci
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3">
        <PersonForm person={person} member={member} aliases={aliases} />
      </div>

      <Section title="Libro soci" defaultOpen>
        <FlashProvider>
        {/* 4e (#15): es. "2025/26: In regola · 2027: Quota non registrata", ognuno col suo "Segna quota associativa pagata". */}
        <p className="mb-2 text-sm text-[#5f524c]" aria-label="Stato tessera per periodo">
          {periodBadges.map(({ period, badge }) => `${periodLabel(period)}: ${MEMBERSHIP_SHORT_LABELS[badge.kind]}`).join(" · ")}
        </p>
        <ul className="mb-3 space-y-2">
          {periodBadges.map(({ period, badge }) => (
            <li key={period.paymentsFrom} className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-sm font-semibold">{periodLabel(period)}</span>
              <MembershipBadge badge={badge} />
              <QuotaOkControls personId={person.id} name={markName} badge={badge} canMark={canMark} referenceDate={period.paymentsFrom} />
            </li>
          ))}
        </ul>
        <div className="mb-3 flex flex-wrap items-start gap-2">
          <RefreshMembershipButton />
          <AssociationMailSyncControl />
        </div>
        <div className="mb-3">
          <FlashMessage scope={person.id} />
        </div>
        {member ? (
          // I suggerimenti "usa questo" stanno già nel modulo della scheda sopra.
          <>
            <MemberCard person={person} member={member} badge={badges.get(person.id) ?? null} showDifferences={false} />
            <div className="mt-2">
              <MemberUnlink
                person={{ id:person.id,version:person.version }}
                memberName={[member.first_name, member.last_name].filter(Boolean).join(" ") || member.email || "questo socio"}
              />
            </div>
          </>
        ) : memberKeyOfPerson(person) ? (
          <>
            <Notice tone="warning">Il socio collegato non è più nel libro soci: da verificare.</Notice>
            <div className="mt-2">
              <MemberUnlink person={{ id: person.id, version: person.version }} memberName="questo socio" />
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-[#5f524c]">Non collegata.</p>
            <MemberLinker
              person={{
                id:person.id,version:person.version,
                currentMemberId:memberKeyOfPerson(person),
                hasNameLink:Boolean(person.membership_name_key),email:person.email,
              }}
              initialQuery={[person.first_name, person.last_name].filter(Boolean).join(" ") || person.nickname || ""}
              referenceDate={todayInRome()}
            />
          </>
        )}
        </FlashProvider>
      </Section>

      {/* 4d: lo storico resta anche quando la persona diventa in regola. */}
      {contacts.length > 0 ? (
        <Section title="Richieste di associazione" count={contacts.length}>
          <ul className={`${cardClass} divide-y divide-[#211815]/5 text-sm`}>
            {contacts.map((contact) => {
              const period = membershipPeriodFor(contact.periodKey);
              return (
                <li key={contact.id} className="px-3 py-2">
                  {contactLabel(contact)}
                  {period ? <span className="text-[#5f524c]"> · periodo {formatPeriod(period)}</span> : null}
                  {contact.note ? <span className="block text-[#5f524c]">{contact.note}</span> : null}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <Section title="Storico workshop" count={history.length} defaultOpen>
        {history.length === 0 ? (
          <p className="text-sm text-[#5f524c]">Nessuna iscrizione.</p>
        ) : (
          <ul className={`${cardClass} divide-y divide-[#211815]/5`}>
            {history.map((row) => (
              <li key={row.participantId}>
                <Link prefetch={false} href={`/gestione/w/${row.workshopId}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <span className="block font-semibold">{row.workshopName}</span>
                    <span className="text-sm text-[#5f524c]">{formatDateRange(row.startsOn, row.endsOn)}</span>
                  </span>
                  <span className="text-sm">
                    {row.removedAt ? "Rimossa dall'iscrizione" : BOOKING_STATUS_LABELS[row.status]}
                    {!row.removedAt && row.present ? " · Presente" : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <DeletePersonSection person={{ id: person.id, version: person.version, name: displayName(person) }} />
    </section>
  );
}
