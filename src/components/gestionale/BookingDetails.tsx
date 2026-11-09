"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { setPartnerAction, updateBookingNotesAction, applyEnteredEmailAction } from "@/app/gestione/(app)/w/actions";
import {markQuotaOkAction,revokeQuotaOkAction} from "@/app/gestione/(app)/p/membership-actions";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { personNames } from "@/lib/gestionale/bookings";
import { formatDate, normalizeText } from "@/lib/gestionale/format";
import { memberKeyOfPerson } from "@/lib/gestionale/member-key";
import { hasEmailPaymentProof } from "@/lib/gestionale/membership-rule";
import { PARTY_LABELS, UI_LABELS } from "@/lib/gestionale/labels";
import type { PersonChoice } from "@/lib/gestionale/person-choice";
import type { BookingPersonView, BookingView } from "@/lib/gestionale/types";

import { FlashMessage, FlashProvider, useFlash } from "./Flash";
import { MatchPanel } from "./MatchPanel";
import { MembershipContacts } from "./MembershipContacts";
import { MemberCard } from "./MemberCard";
import { MemberLinker } from "./MemberLinker";
import { MembershipBadge } from "./MembershipBadge";
import { PersonInlineEditor } from "./PersonInlineEditor";
import { PersonPicker } from "./PersonPicker";
import { canMarkQuotaOk, canRevokeQuotaOk } from "./QuotaOk";
import { QuotaOkCheckbox } from "./QuotaOkCheckbox";
import { StatusDot } from "./StatusPicker";
import { UnifiedPersonPanel } from "./UnifiedPersonPanel";
import { Field, buttonClass, textareaClass } from "./ui";

const BOOKING_SCOPE = "iscrizione";

/** 4d (B2): email scritta da Ale diversa da quella della scheda (che non si sovrascrive da sola). */
function EnteredEmailHint({ entry }: { entry: BookingPersonView }) {
  const [pending, startTransition] = useTransition();
  const flash = useFlash(entry.person.id);
  const email = entry.enteredEmail;
  if (!email || !entry.person.email || email === entry.person.email.trim().toLowerCase()) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-[#7a5212]">
      <span>
        {PARTY_LABELS.redsabbath} ha indicato: <strong className="break-all">{email}</strong> —
      </span>
      <button
        type="button"
        className="min-h-10 font-semibold underline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            flash.result(await applyEnteredEmailAction({ participantId: entry.participantId }), "Email aggiornata.");
          })
        }
      >
        usa questa
      </button>
    </p>
  );
}

/**
 * Una persona della prenotazione (4d), in quest'ordine: Nome Cognome
 * (nickname piccolo) · badge tessera; email o "email mancante"; una sola
 * azione principale secondo lo stato (non collegata → "Cerca nel libro soci";
 * collegata e non in regola → "Segna quota ok"; in regola → niente, solo
 * "Annulla validazione" nel menu "…" se è manuale); in fondo, piccolo,
 * "Modifica dati" · "Inserito da Ale come: X". Il riquadro dell'abbinamento
 * (017) resta per le persone non collegate e senza email. Un solo messaggio
 * di esito per volta (Flash).
 */
function PersonBlock({
  entry,
  partnerOf,
  onChangePartner,
  booking,
  workshopId,
  workshopStartsOn,
  today,
}: {
  entry: BookingPersonView;
  partnerOf: string | null;
  onChangePartner?: () => void;
  booking: BookingView;
  workshopId: string;
  workshopStartsOn: string;
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const { person, membership: badge } = entry;
  const names = personNames(entry);
  const notLinked = badge.kind === "non_collegata";
  const showMatchPanel = notLinked && !person.email;
  const enteredByAle = booking.createdBy?.role === "organizzatrice" && entry.enteredAs ? entry.enteredAs : null;
  const showEnteredAs = Boolean(enteredByAle) && !showMatchPanel && normalizeText(enteredByAle) !== normalizeText(names.main);

  return (
    <UnifiedPersonPanel role={entry.isPrimary?"holder":"partner"}
      badge={<MembershipBadge badge={badge} compact />}
      name={<Link prefetch={false} href={`/gestione/p/${person.id}`} className="underline-offset-2 hover:underline">{names.main}</Link>}
      alias={<>{names.alias ? <span>{names.alias}</span> : null}
        {partnerOf ? <span className="ml-2">partner di {partnerOf}</span> : null}</>}
      email={person.email}
      headerAction={!entry.isPrimary&&onChangePartner?
        <button type="button" className="min-h-10 text-sm font-semibold text-[#a8583e] underline"
          onClick={onChangePartner}>Cambia partner</button>:null}>
      <EnteredEmailHint entry={entry} />

      {entry.possibleDuplicate && !showMatchPanel ? (
        <p className="text-xs font-semibold text-[#7a5212]">
          Possibile doppia iscrizione:{" "}
          <Link prefetch={false} href={`/gestione/p/${entry.possibleDuplicate.id}`} className="underline">
            {entry.possibleDuplicate.displayName}
          </Link>{" "}
          è già iscritta a questo workshop.
        </p>
      ) : null}


      {editing ? (
        <PersonInlineEditor person={person} member={entry.member} onDone={() => setEditing(false)} />
      ) : (
        <div className="space-y-2">
          {!hasEmailPaymentProof(badge) && <QuotaOkCheckbox
              checked={badge.kind==="in_regola" || Boolean("quotaPaid" in badge && badge.quotaPaid)}
              editable={canRevokeQuotaOk(badge) || (canMarkQuotaOk(badge)&&Boolean(entry.fullName||person.email||entry.member?.email))}
              onToggle={paid=>paid
                ? markQuotaOkAction({personId:person.id,workshopId})
                : revokeQuotaOkAction({personId:person.id,workshopId})}
            />}
          {badge.kind === "quota_mancante" && entry.member?.expires_at &&
            entry.member.expires_at < workshopStartsOn ? (
              <p className="text-xs text-[#7a5212]">
                Registrazione associativa precedente trovata (scadenza {formatDate(entry.member.expires_at)}).
                La quota per questo workshop non risulta ancora verificata.
              </p>
          ) : null}
          {linking ? (
              <div className="space-y-2">
                <MemberLinker
                  person={{
                    id:person.id,version:person.version,
                    currentMemberId:memberKeyOfPerson(person),
                    hasNameLink:Boolean(person.membership_name_key),email:person.email,
                  }}
                  initialQuery={[person.first_name, person.last_name].filter(Boolean).join(" ") ||
                    person.nickname || person.email || ""}
                  referenceDate={workshopStartsOn}
                />
                <button type="button" className={buttonClass.ghost}
                  onClick={() => setLinking(false)}>Chiudi ricerca</button>
              </div>
            ) : (
              <button type="button" className={notLinked ? buttonClass.primary : buttonClass.secondary}
                onClick={() => setLinking(true)}>
                {memberKeyOfPerson(person) ? "Cambia abbinamento" : "Cerca nel libro soci"}
              </button>
            )}
        </div>
      )}

      {badge.kind !== "in_regola" && !editing && membershipPeriodFor(workshopStartsOn) ? (
        <MembershipContacts personId={person.id} name={names.main} contacts={entry.contacts} workshopId={workshopId} today={today} />
      ) : null}

      <FlashMessage scope={person.id} />

      {showMatchPanel && !editing ? <MatchPanel booking={booking} workshopId={workshopId} entry={entry} /> : null}
      {entry.member && !editing ? <MemberCard person={person} member={entry.member} badge={badge} compact /> : null}

      <p className="flex flex-wrap items-center gap-x-2 text-xs text-[#5f524c]">
        {!editing ? (
          <button type="button" className="min-h-10 font-semibold underline" onClick={() => setEditing(true)}>
            Modifica dati
          </button>
        ) : null}
        {showEnteredAs ? (
          <span>
            {!editing ? "· " : ""}Inserito da {PARTY_LABELS.redsabbath} come: {enteredByAle}
          </span>
        ) : null}
      </p>
    </UnifiedPersonPanel>
  );
}

/**
 * Contenuto della prenotazione aperta (admin): stato in sola lettura (lo
 * aggiornano Ale e i pagamenti), note, persone, partner, abbinamento (D20).
 * Niente quota né "Separa" (creerebbe una prenotazione con parte economica).
 */
export function BookingDetails(props: { booking: BookingView; workshopId: string; workshopStartsOn: string; today: string }) {
  return (
    <FlashProvider>
      <BookingDetailsContent {...props} />
    </FlashProvider>
  );
}

function BookingDetailsContent({
  booking,
  workshopId,
  workshopStartsOn,
  today,
}: {
  booking: BookingView;
  workshopId: string;
  workshopStartsOn: string;
  today: string;
}) {
  const [notes, setNotes] = useState(booking.notes ?? "");
  const [partnerMode, setPartnerMode] = useState<"idle" | "change" | "add">("idle");
  const [newPartner, setNewPartner] = useState<PersonChoice | null>(null);
  const [pending, startTransition] = useTransition();
  const flash = useFlash(BOOKING_SCOPE);

  const primary = booking.people.find((p) => p.isPrimary) ?? booking.people[0];
  const partner = booking.people.find((p) => p !== primary) ?? null;

  function savePartner() {
    if (!newPartner) return;
    flash.clear();
    startTransition(async () => {
      const result = await setPartnerAction({
        bookingId: booking.bookingId,
        version: booking.version,
        // "Cambia partner" sostituisce solo il secondario.
        removeParticipantId: partnerMode === "change" ? partner?.participantId ?? null : null,
        person: newPartner,
      });
      flash.result(result, partnerMode === "change" ? "Partner cambiato." : "Partner aggiunto.");
      if (result.ok) {
        setPartnerMode("idle");
        setNewPartner(null);
      }
    });
  }

  // Come per Ale (9.3b): le note si salvano all'uscita dal campo.
  function saveNotes() {
    if (notes.trim() === (booking.notes ?? "").trim()) return;
    flash.clear();
    startTransition(async () => {
      flash.result(await updateBookingNotesAction({ bookingId: booking.bookingId, version: booking.version, notes }), "Note salvate.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-[#5f524c]">
          Stato:
          <span className="font-semibold text-[#211815]">
            <StatusDot status={booking.status} withLabel />
          </span>
          <span>(lo aggiorna {PARTY_LABELS.redsabbath})</span>
        </p>
        <Field label="Note">
          <textarea
            rows={1}
            className={textareaClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
          />
        </Field>
        <FlashMessage scope={BOOKING_SCOPE} />
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold">{partner?"Persone della coppia":"Partecipante"}</h3>
        {booking.people.map((entry) => (
          <PersonBlock
            key={entry.participantId}
            entry={entry}
            partnerOf={entry === partner && primary ? personNames(primary).main : null}
            onChangePartner={entry === partner ? () => setPartnerMode("change") : undefined}
            booking={booking}
            workshopId={workshopId}
            workshopStartsOn={workshopStartsOn}
            today={today}
          />
        ))}
        {booking.formerPartners.map((former) => (
          <p key={`${former.displayName}-${former.removedAt}`} className="text-sm text-[#5f524c]">
            Partner precedente: {former.displayName}, rimosso il {formatDate(former.removedAt)}
          </p>
        ))}
      </div>

      {partnerMode === "idle" ? (
        !partner ? <button type="button" className={buttonClass.secondary}
          onClick={() => setPartnerMode("add")}>+ Partner</button> : null
      ) : (
        <div className="space-y-3 rounded-xl bg-[#f2ede3] p-3">
          <PersonPicker
            workshopId={workshopId}
            label={partnerMode === "change" ? `Nuovo partner di ${primary?.displayName ?? ""}` : `Partner di ${primary?.displayName ?? ""}`}
            value={newPartner}
            onChange={setNewPartner}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass.primary} onClick={savePartner} disabled={!newPartner || pending}>
              Salva
            </button>
            <button
              type="button"
              className={buttonClass.ghost}
              onClick={() => {
                setPartnerMode("idle");
                setNewPartner(null);
              }}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
