import { normalizeText } from "./format";

export type MemberLookupFields = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

/** Ricerca parziale per singola parola su nome, cognome, email e alias.
 * Nessuna di queste corrispondenze costituisce una prova d'identità.
 */
export function memberLookupScore(
  query: string,
  fields: MemberLookupFields,
  aliases: readonly string[] = [],
): number | null {
  const tokens = normalizeText(query.replace(/^@/, "")).split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const parts = [fields.firstName,fields.lastName,fields.email,...aliases]
    .filter((part):part is string=>Boolean(part?.trim()))
    .map(normalizeText);
  if(!tokens.every(token=>parts.some(part=>part.includes(token))))return null;
  // I primi risultati sono i prefissi, poi le corrispondenze interne.
  const words=parts.flatMap(part=>part.split(/[\s@._\-]+/).filter(Boolean));
  return tokens.every(token=>words.some(word=>word.startsWith(token)))?0:1;
}

/** È una persona già conosciuta nel 2026, non una quota valida per il 2027. */
export function previouslyVerifiedBookMember(
  rows: readonly {
    source:string|null;
    membership_status:string|null;
    membership_starts_at:string|null;
  }[],
  currentPaymentsFrom:string|null,
):boolean {
  if(!currentPaymentsFrom)return false;
  return rows.some(row=>row.source==="official_members_book"
    && row.membership_status==="verified"
    && Boolean(row.membership_starts_at && row.membership_starts_at<currentPaymentsFrom));
}

/** Conferma esplicita di un modulo con secondo nome aggiuntivo:
 * primo nome e cognome devono corrispondere; non si collega in automatico.
 */
export function compatibleFormName(
  personName:string,
  formName:string,
):boolean {
  const p=normalizeText(personName).split(/\s+/).filter(Boolean);
  const f=normalizeText(formName).split(/\s+/).filter(Boolean);
  return p.length>=2&&f.length>=2&&p[0]===f[0]&&p[p.length-1]===f[f.length-1];
}
