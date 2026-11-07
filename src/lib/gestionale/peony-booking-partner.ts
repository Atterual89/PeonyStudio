import { normalizeMembershipEmail } from "@/lib/association/membership-state";

export type PeonyPartnerSelection = {
  name: string | null;
  email: string | null;
  personId?: string | null;
  memberRowId?: string | null;
  source: "gestionale" | "ticket_tailor" | "admin" | "user";
};

const RESERVED = /^(?:partner|il partner|la partner|nome partner|nome del partner|partner da indicare|da indicare|da definire|non so|non lo so|non indicato|n\/?a|nessuno|unknown|altro)$/i;

export function cleanPartnerName(value: unknown): string | null {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return !name || RESERVED.test(name) ? null : name.slice(0, 220);
}

export function cleanPartnerEmail(value: unknown): string | null {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function choosePartner(
  override: { partner_name: string | null; partner_email: string | null; person_id: string | null; member_row_id: string | null } | null,
  enrollment: { partner_name: string | null; partner_email: string | null; partner_source: string | null } | null | undefined,
  checkout: { name: string | null; email: string | null } | null | undefined,
): PeonyPartnerSelection | null {
  // Anche l'override vuoto indica che l'operatore ha rimosso il partner.
  if (override) {
    const name = cleanPartnerName(override.partner_name);
    const email = cleanPartnerEmail(override.partner_email);
    return name || email ? { name, email, personId: override.person_id, memberRowId: override.member_row_id, source: "gestionale" } : null;
  }
  const name = cleanPartnerName(enrollment?.partner_name) || cleanPartnerName(checkout?.name);
  const email = cleanPartnerEmail(enrollment?.partner_email) || cleanPartnerEmail(checkout?.email);
  if (!name && !email) return null;
  const source = enrollment?.partner_source === "admin" || enrollment?.partner_source === "user"
    ? enrollment.partner_source : "ticket_tailor";
  return { name, email, source };
}

export function isSameParticipant(owner: { name: string; email: string | null }, partner: { name: string; email: string | null }) {
  const ownerEmail = normalizeMembershipEmail(owner.email);
  const partnerEmail = normalizeMembershipEmail(partner.email);
  if (ownerEmail && partnerEmail) return ownerEmail === partnerEmail;
  // Senza una coppia di email affidabili, fermare solo la corrispondenza
  // esatta del nominativo, mai omonimi con email diverse.
  const normalize = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("it").trim().replace(/\s+/g," ");
  return Boolean(normalize(owner.name)) && normalize(owner.name) === normalize(partner.name) && (!ownerEmail || !partnerEmail);
}
