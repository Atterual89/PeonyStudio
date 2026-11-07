import "server-only";

import { deriveMembershipState, normalizeMembershipEmail, normalizeMembershipNameKey, type MembershipEvidenceRow } from "@/lib/association/membership-state";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { todayInRome } from "@/lib/gestionale/workshops";

export type SociReviewRow = {
  key: string;
  formMemberId: string;
  name: string;
  email: string | null;
  submittedAt: string | null;
  personId: string | null;
  paid: boolean;
  paidSource: "manual" | "book" | null;
};

export type SociReviewData = {
  formCount: number;
  bookCount: number;
  paidCount: number;
  pendingCount: number;
  rows: SociReviewRow[];
  pending: SociReviewRow[];
  bookUpdatedAt: string | null;
  formUpdatedAt: string | null;
};

export async function loadSociReviewData(referenceDate: string = todayInRome()): Promise<SociReviewData> {
  await requireAdmin();
  const db = getGestionaleDb();
  async function readAllMemberships() {
    const output: Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      source: string | null;
      membership_status: string | null;
      membership_starts_at: string | null;
      membership_expires_at: string | null;
      updated_at: string | null;
    }> = [];
    for (let offset = 0; offset < 10000; offset += 500) {
      const { data, error } = await db.from("association_members")
        .select("id,first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at,updated_at")
        .in("source", ["google_sheet", "official_members_book", "manual_override"])
        .order("id", { ascending: true })
        .range(offset, offset + 499);
      if (error) throw new Error(`Registro soci non leggibile: ${error.message}`);
      output.push(...(data ?? []));
      if ((data ?? []).length < 500) break;
    }
    return output;
  }

  const [rows, people] = await Promise.all([
    readAllMemberships(),
    db.from("gw_people")
      .select("id,email")
      .is("deleted_at", null).is("merged_into", null)
      .range(0, 9999),
  ]);
  if (people.error) throw new Error(`Anagrafica non leggibile: ${people.error.message}`);
  const forms = rows.filter((row) => row.source === "google_sheet");
  const book = rows.filter((row) => row.source === "official_members_book");
  const evidence = rows as MembershipEvidenceRow[];
  const period = membershipPeriodFor(referenceDate);

  const idsByEmail = new Map<string, string | null>();
  for (const person of people.data ?? []) {
    const email = normalizeMembershipEmail(person.email);
    if (!email || !email.includes("@")) continue;
    idsByEmail.set(email, idsByEmail.has(email) ? null : person.id);
  }

  // Il modulo viene compilato una volta. Dal 2027 anche le vecchie domande
  // devono restare disponibili per registrare il rinnovo annuale.
  const eligibleForms = forms; // Anche chi ha compilato il modulo prima del primo periodo può rinnovare la quota.
  const seen = new Set<string>();
  const distinct = [...eligibleForms].sort((a, b) =>
    (b.membership_starts_at ?? "").localeCompare(a.membership_starts_at ?? "")
  ).filter((row) => {
    const email = normalizeMembershipEmail(row.email);
    const name = normalizeMembershipNameKey(row.first_name, row.last_name);
    const key = email || name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const reviewRows: SociReviewRow[] = distinct.map((row) => {
    const state = deriveMembershipState(evidence, {
      email: row.email, firstName: row.first_name, lastName: row.last_name,
    }, {
      paymentsFrom: period?.paymentsFrom, paymentsUntil: period?.validUntil,
    });
    return {
      key: row.id,
      formMemberId: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Nome non disponibile",
      email: row.email,
      submittedAt: row.membership_starts_at,
      personId: idsByEmail.get(normalizeMembershipEmail(row.email)) ?? null,
      paid: state.status === "valid",
      paidSource: state.status !== "valid" ? null : state.paymentMatchMethod === "manual" ? "manual" : "book",
    };
  });
  const pending = reviewRows.filter((row) => !row.paid);
  const latest = (items: typeof rows) =>
    items.map((row) => row.updated_at).filter((value): value is string => typeof value === "string").sort().at(-1) ?? null;

  return {
    formCount: reviewRows.length,
    bookCount: book.length,
    paidCount: reviewRows.length - pending.length,
    pendingCount: pending.length,
    rows: reviewRows,
    pending,
    bookUpdatedAt: latest(book),
    formUpdatedAt: latest(forms),
  };
}
