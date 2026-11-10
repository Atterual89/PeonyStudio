import "server-only";

import { FIRST_MEMBERSHIP_PERIOD, membershipPeriodForPayment, type MembershipPeriod } from "@/lib/association/membership-periods";
import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withSupabaseClockSkewRetry } from "@/lib/supabase/retry";

// Validazione manuale "Quota ok" (righe manual_override di association_members),
// UNICA per il sito (pagina admin Ticket Tailor, route manual-validate e
// manual-revoke) e per il gestionale (D11). Le altre righe della tabella non
// si toccano mai: ogni lettura e scrittura filtra source = 'manual_override'.
//
// Annullare = membership_status 'revoked' sulla riga: deriveMembershipState
// conta solo le righe 'verified', quindi la validazione non vale più; la riga
// resta (storico, e i collegamenti del gestionale per id non si rompono) e una
// nuova validazione della stessa persona la riporta a 'verified'.

export type ManualIdentity = { email?: string | null; firstName?: string | null; lastName?: string | null };

type ManualRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_status: string | null;
  membership_starts_at: string | null;
  notes_admin: string | null;
};

export type ManualValidationResult =
  | { ok: true; id: string | null; created: boolean; expiresAt: string }
  | { ok: false; status: 400 | 500; message: string };

export type ManualRevokeResult = { ok: true; revoked: number } | { ok: false; status: 400 | 500; message: string };

export const REVOKED_STATUS = "revoked";

const IDENTITY_REQUIRED = "Inserisci un indirizzo email oppure nome e cognome.";

function normalizeText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function makeSourceRowId(email: string, nameKey: string, period: MembershipPeriod | undefined) {
  const base = email ? `manual:email:${email}` : `manual:name:${nameKey}`;
  // Periodi diversi dal primo: una riga per periodo.
  return period && period.paymentsFrom !== FIRST_MEMBERSHIP_PERIOD.paymentsFrom ? `${base}:${period.paymentsFrom}` : base;
}

function readIdentity(identity: ManualIdentity) {
  const email = normalizeMembershipEmail(identity.email);
  const firstName = normalizeText(identity.firstName);
  const lastName = normalizeText(identity.lastName);
  return { email, firstName, lastName, nameKey: normalizeMembershipNameKey(firstName, lastName) };
}

function sameIdentity(row: ManualRow, email: string, nameKey: string) {
  const rowEmail = normalizeMembershipEmail(row.email);
  // Non confondere omonimi con indirizzi email diversi.
  if (email && rowEmail) return rowEmail === email;
  return Boolean(nameKey && normalizeMembershipNameKey(row.first_name, row.last_name) === nameKey);
}

async function loadManualRows(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  return withSupabaseClockSkewRetry(
    async () =>
      await supabase
        .from("association_members")
        .select("id,first_name,last_name,email,membership_status,membership_starts_at,notes_admin")
        .eq("source", "manual_override")
        .range(0, 9999),
    (result) => result.error,
  );
}

/**
 * "Segna quota ok": crea o aggiorna la riga manual_override della persona
 * (email, oppure nome e cognome). Senza `period`, come la route di sempre:
 * annualità determinata automaticamente dalla data corrente (ora italiana).
 * Con `period`: le date di quel periodo e la riga di quel periodo.
 */
export async function saveManualValidation(
  identity: ManualIdentity,
  options: { period?: MembershipPeriod; supabase?: ReturnType<typeof createSupabaseAdminClient> } = {},
): Promise<ManualValidationResult> {
  const { email, firstName, lastName, nameKey } = readIdentity(identity);
  if (!email && !nameKey) return { ok: false, status: 400, message: IDENTITY_REQUIRED };

  const period = options.period;
  const dates = period ?? membershipPeriodForPayment(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" })) ?? FIRST_MEMBERSHIP_PERIOD;
  const supabase = options.supabase ?? createSupabaseAdminClient();

  const existingResult = await loadManualRows(supabase);
  if (existingResult.error) return { ok: false, status: 500, message: existingResult.error.message };

  const existing = ((existingResult.data ?? []) as ManualRow[]).find(
    (row) => sameIdentity(row, email, nameKey) && row.membership_starts_at?.slice(0, 10) === dates.paymentsFrom,
  );

  // La prova del bonifico/PayPal già associato prevale sul controllo
  // manuale e non deve essere degradata da un secondo "Segna quota ok".
  if (existing?.membership_status === "verified" &&
      existing.notes_admin?.startsWith("Quota confermata da email (")) {
    return { ok: true, id: existing.id, created: false, expiresAt: dates.validUntil };
  }

  const payload = {
    first_name: firstName || null,
    last_name: lastName || null,
    email: email || null,
    membership_status: "verified",
    membership_starts_at: dates.paymentsFrom,
    membership_expires_at: dates.validUntil,
    source: "manual_override",
    source_row_id: makeSourceRowId(email, nameKey, dates),
    source_hash: null,
    notes_admin: "Validazione manuale da admin",
    updated_at: new Date().toISOString(),
  };

  const saveResult = await withSupabaseClockSkewRetry(
    async () =>
      existing
        ? await supabase
            .from("association_members")
            .update(payload)
            .eq("id", existing.id)
            .eq("source", "manual_override")
            .select("id")
            .single()
        : await supabase.from("association_members").insert(payload).select("id").single(),
    (result) => result.error,
  );
  if (saveResult.error) return { ok: false, status: 500, message: saveResult.error.message };

  return { ok: true, id: (saveResult.data as { id: string } | null)?.id ?? existing?.id ?? null, created: !existing, expiresAt: dates.validUntil };
}

/**
 * "Annulla validazione manuale": le righe manual_override 'verified' della
 * persona con inizio nel periodo (predefinito il primo, come la pagina admin)
 * passano a 'revoked'. Nessun'altra riga cambia.
 */
export async function revokeManualValidation(
  identity: ManualIdentity,
  options: { period?: MembershipPeriod; supabase?: ReturnType<typeof createSupabaseAdminClient> } = {},
): Promise<ManualRevokeResult> {
  const { email, nameKey } = readIdentity(identity);
  if (!email && !nameKey) return { ok: false, status: 400, message: IDENTITY_REQUIRED };

  const period = options.period ?? membershipPeriodForPayment(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" })) ?? FIRST_MEMBERSHIP_PERIOD;
  const supabase = options.supabase ?? createSupabaseAdminClient();

  const existingResult = await loadManualRows(supabase);
  if (existingResult.error) return { ok: false, status: 500, message: existingResult.error.message };

  const ids = ((existingResult.data ?? []) as ManualRow[])
    .filter((row) => {
      const startsAt = row.membership_starts_at?.slice(0, 10) ?? "";
      return (
        row.membership_status === "verified" &&
        !row.notes_admin?.startsWith("Quota confermata da email (") &&
        sameIdentity(row, email, nameKey) &&
        startsAt === period.paymentsFrom
      );
    })
    .map((row) => row.id);
  if (ids.length === 0) return { ok: true, revoked: 0 };

  const result = await withSupabaseClockSkewRetry(
    async () =>
      await supabase
        .from("association_members")
        .update({ membership_status: REVOKED_STATUS, notes_admin: "Validazione manuale annullata da admin", updated_at: new Date().toISOString() })
        .in("id", ids)
        .eq("source", "manual_override"),
    (r) => r.error,
  );
  if (result.error) return { ok: false, status: 500, message: result.error.message };
  return { ok: true, revoked: ids.length };
}
