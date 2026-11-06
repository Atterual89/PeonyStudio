import { contactGroupOf, inContactScope } from "../contacts";
import type { BookingPersonView, BookingView } from "../types";
import type { EmailSendRow } from "../server/email";

export type EmailRecipient = {
  personId: string;
  name: string;
  email: string | null;
  type: "membership_request" | "membership_reminder" | "partner" | "partner_reminder" | "workshop_details";
  partnerStatus?: "unknown" | "registered" | "not_registered";
  coupleBooking?: boolean;
  previousSends: EmailSendRow[];
};

function personName(entry: BookingPersonView): string {
  return entry.fullName || entry.displayName || entry.person.nickname || "Senza nome";
}

export function emailRecipients(bookings: readonly BookingView[], sends: readonly EmailSendRow[]): EmailRecipient[] {
  const out: EmailRecipient[] = [];
  const seen = new Set<string>();
  for (const b of bookings) {
    if (!inContactScope(b.status)) continue;
    for (const p of b.people) {
      if (p.person.merged_into) continue;
      const key = p.person.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const relevant = sends.filter((s) => s.personId === key);
      const partner = b.people.find((entry) => entry.person.id !== key);
      const partnerStatus: "unknown" | "registered" | "not_registered" =
        !partner ? "unknown" : partner.membership.kind === "in_regola" ? "registered" : "not_registered";
      const base = { personId: key, name: personName(p), email: p.person.email, partnerStatus, coupleBooking: Boolean(partner), previousSends: relevant };
      const group = contactGroupOf(p);
      if (group === "da_contattare") out.push({ ...base, type: "membership_request" });
      if (group === "richiesta_inviata") out.push({ ...base, type: "membership_reminder" });
      // Only the booking's primary person is asked who their partner will be.
      if (p.isPrimary && !partner && p.membership.kind === "in_regola") {
        const sentPartner = relevant.some((s) => s.kind === "partner");
        out.push({ ...base, type: sentPartner ? "partner_reminder" : "partner" });
      }
      if (["acconto", "saldato"].includes(b.status) && !relevant.some((s) => s.kind === "workshop_details")) {
        out.push({ ...base, type: "workshop_details" });
      }
    }
  }
  return out.sort((a,b) => a.name.localeCompare(b.name,"it"));
}
