import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountsTab } from "@/components/gestionale/AccountsTab";
import { DeleteWorkshopSection } from "@/components/gestionale/Deletion";
import { EmailTab } from "@/components/gestionale/EmailTab";
import { ParticipantsTab } from "@/components/gestionale/ParticipantsTab";
import { RegistrationsTab } from "@/components/gestionale/RegistrationsTab";
import { CopySettings, OrganizerSettingsForm, WorkshopSettingsForm } from "@/components/gestionale/WorkshopSettingsForm";
import { Notice, cardClass } from "@/components/gestionale/ui";
import { emailRows } from "@/lib/gestionale/email-list";
import { formatDateRange } from "@/lib/gestionale/format";
import { presentCount, showPresence } from "@/lib/gestionale/presence";
import { getAccounts, getTaxNotes, listCarryoverDestinations } from "@/lib/gestionale/server/accounts";
import { requireOperator } from "@/lib/gestionale/server/auth";
import { getWorkshopBookings, getWorkshopView, listWorkshopsForCopy } from "@/lib/gestionale/server/data";
import { getFeeRows, getLastPaymentMethod, getRegistrations } from "@/lib/gestionale/server/registrations";
import { WORKSHOP_TABS, resolveWorkshopTab, workshopTabRedirect } from "@/lib/gestionale/tabs";
import type { WorkshopView } from "@/lib/gestionale/types";
import { countBookings, todayInRome } from "@/lib/gestionale/workshops";

export default async function WorkshopDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[]; filtro?: string | string[] }>;
}) {
  const operator = await requireOperator();
  const [{ id }, { tab, filtro }] = await Promise.all([params, searchParams]);

  const moved = workshopTabRedirect(operator.role, tab);
  if (moved) redirect(`/gestione/w/${id}?tab=${moved}`);
  // D18: un tab dell'altro ruolo risponde 404 (verifica lato server).
  const active = resolveWorkshopTab(operator.role, tab);
  if (!active) notFound();

  const workshop = await getWorkshopView(id);
  if (!workshop) notFound();

  const isAdmin = operator.role === "admin";
  // L'organizzatrice legge solo le prenotazioni senza anagrafica (D18).
  const [bookings, registrations] = isAdmin
    ? [await getWorkshopBookings(workshop), null]
    : [null, await getRegistrations(workshop.id)];
  // 4g (#10): metodo proposto nel modulo del pagamento.
  const lastMethod = !isAdmin && active === "iscrizioni" ? await getLastPaymentMethod(operator.id) : null;
  const statuses = (bookings ?? registrations ?? []).map((booking) => booking.status);
  // D15: si contano le prenotazioni confermate (una coppia = 1).
  const iscrizioni = countBookings(statuses).iscrizioni;
  // D27: spunta "Presente" e "Presenti X / Y" dal giorno di inizio.
  const today = todayInRome();
  const presence = showPresence(workshop.startsOn, today);
  const present = presentCount(bookings ?? registrations ?? []);

  return (
    <section>
      <Link prefetch={false} href="/gestione" className="text-sm text-[#5f524c] underline">
        ← Workshop
      </Link>
      <h1 className="mt-2 font-serif text-xl font-medium leading-tight">{workshop.displayName}</h1>
      <p className="mt-1 text-sm text-[#5f524c]">
        {formatDateRange(workshop.startsOn, workshop.endsOn)} ·{" "}
        <strong className="text-[#211815]">
          {iscrizioni}
          {workshop.capacity ? ` / ${workshop.capacity}` : ""}
        </strong>{" "}
        {iscrizioni === 1 ? "iscrizione" : "iscrizioni"}
        {presence ? (
          <>
            {" · "}Presenti{" "}
            <strong className="text-[#211815]">
              {present.present} / {present.total}
            </strong>
          </>
        ) : null}
      </p>
      {workshop.eventNotice ? (
        <div className="mt-3">
          <Notice tone="warning">{workshop.eventNotice}: nome e date sono l&apos;ultima copia salvata.</Notice>
        </div>
      ) : null}

      {isAdmin && bookings && active === "partecipanti" ? (
        <div className="mt-4 rounded-xl border border-[#211815]/10 bg-white/70 p-3">
          <h2 className="text-base font-semibold">Da verificare</h2>
          <p className="mt-1 text-sm text-[#5f524c]">Situazione delle iscrizioni confermate.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-[#f2ede3] p-3">
              <strong className="block text-xl">{bookings.filter((b) => ["prenotato", "acconto", "saldato"].includes(b.status) && b.people.some((p) => p.membership.kind !== "in_regola")).length}</strong>
              <span>Iscrizioni con associazione da verificare</span>
            </div>
            <Link prefetch={false} href={`/gestione/w/${workshop.id}?tab=email`} className="rounded-lg bg-[#f2ede3] p-3">
              <strong className="block text-xl">{new Set(bookings.filter((b) => ["prenotato", "acconto", "saldato"].includes(b.status)).flatMap((b) => b.people).filter((p) => !p.person.email).map((p) => p.person.id)).size}</strong>
              <span>Persone senza email · Apri Email</span>
            </Link>
          </div>
        </div>
      ) : null}

      {/* Il tab attivo sta nell'URL: il tasto indietro del telefono funziona. */}
      <nav aria-label="Sezioni del workshop" className="-mx-4 mt-4 flex overflow-x-auto border-b border-[#211815]/10 px-4">
        {WORKSHOP_TABS[operator.role].map((t) => (
          <Link prefetch={false}
            key={t.key}
            href={`/gestione/w/${workshop.id}?tab=${t.key}`}
            aria-current={active === t.key ? "page" : undefined}
            className={`flex min-h-10 shrink-0 items-center border-b-2 px-3 text-[15px] font-semibold ${
              active === t.key ? "border-[#a8583e] text-[#a8583e]" : "border-transparent text-[#5f524c]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-3">
        {active === "partecipanti" && bookings ? <ParticipantsTab workshopId={workshop.id} workshopStartsOn={workshop.startsOn} today={today} showPresence={presence} bookings={bookings} /> : null}
        {active === "iscrizioni" && registrations ? (
          <RegistrationsTab
            workshop={{ id: workshop.id, version: workshop.version, defaultFeeCents: workshop.default_fee_cents }}
            operatorId={operator.id}
            lastMethod={lastMethod}
            initialFilter={filtro === "da-pagare" ? "da-pagare" : null}
            registrations={registrations}
            today={today}
            showPresence={presence}
          />
        ) : null}
        {/* D27: solo nome, email e stato arrivano al browser. */}
        {active === "email" && bookings ? <EmailTab rows={emailRows(bookings)} /> : null}
        {active === "conti" ? <AccountsSection workshop={workshop} isAdmin={isAdmin} /> : null}
        {active === "info" ? (
          <InfoTab workshop={workshop} isAdmin={isAdmin} hasBookings={statuses.length > 0} />
        ) : null}
      </div>
    </section>
  );
}

/** Tab Conti (Fase 4): stesso contenuto per i due ruoli; le note fiscali solo all'organizzatrice. */
async function AccountsSection({ workshop, isAdmin }: { workshop: WorkshopView; isAdmin: boolean }) {
  const [data, destinations, taxNotes] = await Promise.all([
    getAccounts(workshop),
    listCarryoverDestinations(workshop.id),
    // D7 (Fase 4): agli admin le note non arrivano nemmeno (getTaxNotes risponde 404).
    isAdmin ? Promise.resolve(undefined) : getTaxNotes(workshop.id),
  ]);
  if (!data) notFound();
  return <AccountsTab data={data} isAdmin={isAdmin} taxNotes={taxNotes} destinations={destinations} today={todayInRome()} />;
}

async function InfoTab({ workshop, isAdmin, hasBookings }: { workshop: WorkshopView; isAdmin: boolean; hasBookings: boolean }) {
  const [sources, feeRows] = await Promise.all([
    isAdmin && !hasBookings ? listWorkshopsForCopy(workshop.id) : Promise.resolve([]),
    // 4g (#40): per la conferma prima di cambiare il prezzo.
    hasBookings ? getFeeRows(workshop.id) : Promise.resolve([]),
  ]);
  const settings = {
    id: workshop.id,
    version: workshop.version,
    description: workshop.description,
    capacity: workshop.capacity,
    default_fee_cents: workshop.default_fee_cents,
    peony_pct: workshop.peony_pct,
  };

  return (
    <div className="max-w-xl space-y-3">
      <div className={`${cardClass} p-3 text-sm`}>
        <p className="text-[#5f524c]">Nome e date (si cambiano sul sito)</p>
        <p className="mt-1 font-semibold">{workshop.displayName}</p>
        <p>{formatDateRange(workshop.startsOn, workshop.endsOn)}</p>
      </div>

      {isAdmin && !hasBookings ? (
        <CopySettings
          workshop={{ id: workshop.id, version: workshop.version }}
          sources={sources.map((s) => ({
            id: s.id,
            name: s.displayName,
            startsOn: s.startsOn,
            capacity: s.capacity,
            default_fee_cents: s.default_fee_cents,
            peony_pct: s.peony_pct,
          }))}
        />
      ) : null}

      {isAdmin ? <WorkshopSettingsForm workshop={settings} feeRows={feeRows} /> : <OrganizerSettingsForm workshop={settings} feeRows={feeRows} />}

      {/* D22: solo admin e solo workshop non collegati a Ticket Tailor. */}
      {isAdmin && !workshop.event_id ? (
        <DeleteWorkshopSection workshop={{ id: workshop.id, version: workshop.version, name: workshop.name }} />
      ) : null}
    </div>
  );
}
