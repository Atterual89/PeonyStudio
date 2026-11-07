import "server-only";

import { deriveMembershipState, normalizeMembershipEmail, normalizeMembershipNameKey, type MembershipEvidenceRow } from "@/lib/association/membership-state";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { todayInRome } from "@/lib/gestionale/workshops";

export type SociReviewRow = {
  key: string;
  name: string;
  email: string | null;
  submittedAt: string | null;
  personId: string | null;
};

export type SociReviewData = {
  formCount: number;
  bookCount: number;
  pendingCount: number;
  pending: SociReviewRow[];
  bookUpdatedAt: string | null;
  formUpdatedAt: string | null;
};

export async function loadSociReviewData(): Promise<SociReviewData> {
  await requireAdmin();
  const db = getGestionaleDb();
  const [all, people] = await Promise.all([
    db.from("association_members")
      .select("first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at,updated_at")
      .in("source", ["google_sheet", "official_members_book", "manual_override"])
      .range(0, 9999),
    db.from("gw_people")
      .select("id,email")
      .is("deleted_at", null).is("merged_into", null)
      .range(0, 9999),
  ]);
  if (all.error) throw new Error(`Registro soci non leggibile: ${all.error.message}`);
  if (people.error) throw new Error(`Anagrafica non leggibile: ${people.error.message}`);

  const rows = all.data ?? [];
  const forms = rows.filter((row) => row.source === "google_sheet");
  const book = rows.filter((row) => row.source === "official_members_book");
  const evidence = rows as MembershipEvidenceRow[];
  const period = membershipPeriodFor(todayInRome());

  const idsByEmail = new Map<string, string | null>();
  for (const person of people.data ?? []) {
    const email = normalizeMembershipEmail(person.email);
    if (!email || !email.includes("@")) continue;
    idsByEmail.set(email, idsByEmail.has(email) ? null : person.id);
  }

  const currentForms = period ? forms.filter((row) =>
    row.membership_starts_at &&
    row.membership_starts_at >= period.paymentsFrom &&
    row.membership_starts_at <= period.validUntil
  ) : forms;

  // Più domande della stessa persona valgono un solo caso da controllare.
  const seen = new Set<string>();
  const distinct = [...currentForms].sort((a, b) =>
    (b.membership_starts_at ?? "").localeCompare(a.membership_starts_at ?? "")
  ).filter((row) => {
    const email = normalizeMembershipEmail(row.email);
    const name = normalizeMembershipNameKey(row.first_name, row.last_name);
    const key = email || name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const pending: SociReviewRow[] = distinct.filter((row) => {
    const state = deriveMembershipState(evidence, {
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
    }, {
      paymentsFrom: period?.paymentsFrom,
      paymentsUntil: period?.validUntil,
    });
    return state.status !== "valid";
  }).map((row, index) => ({
    key: normalizeMembershipEmail(row.email) || normalizeMembershipNameKey(row.first_name, row.last_name) || String(index),
    name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Nome non disponibile",
    email: row.email,
    submittedAt: row.membership_starts_at,
    personId: idsByEmail.get(normalizeMembershipEmail(row.email)) ?? null,
  }));

  const latest = (items: typeof rows) =>
    items.map((row) => row.updated_at).filter((value): value is string => typeof value === "string").sort().at(-1) ?? null;

  return {
    formCount: currentForms.length,
    bookCount: book.length,
    pendingCount: pending.length,
    pending,
    bookUpdatedAt: latest(book),
    formUpdatedAt: latest(forms),
  };
}
