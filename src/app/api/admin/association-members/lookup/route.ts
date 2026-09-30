import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const CURRENT_MEMBERSHIP_START = "2025-09-01";

type MemberRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  source: string | null;
  membership_status: string | null;
  membership_starts_at: string | null;
  membership_expires_at: string | null;
};

type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type Candidate = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_status: "missing_form" | "payment_missing" | "valid";
  membership_expires_at: string | null;
  form_present: boolean;
  current_year_paid: boolean;
};

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const email = normalizeEmail(request.nextUrl.searchParams.get("email"));
  const firstName = normalizeText(request.nextUrl.searchParams.get("first_name"));
  const lastName = normalizeText(request.nextUrl.searchParams.get("last_name"));

  if (!email && !(firstName && lastName)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Inserisci un indirizzo email oppure nome e cognome.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  let membersQuery = supabase
    .from("association_members")
    .select(
      "first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at",
    )
    .in("source", ["google_sheet", "official_members_book"]);

  if (email) {
    membersQuery = membersQuery.ilike("email", email);
  } else {
    membersQuery = membersQuery
      .ilike("first_name", firstName)
      .ilike("last_name", lastName);
  }

  let profilesQuery = supabase
    .from("profiles")
    .select("first_name,last_name,email");

  if (email) {
    profilesQuery = profilesQuery.ilike("email", email);
  } else {
    profilesQuery = profilesQuery
      .ilike("first_name", firstName)
      .ilike("last_name", lastName);
  }

  const [
    { data: memberData, error: memberError },
    { data: profileData, error: profileError },
  ] = await Promise.all([
    membersQuery.range(0, 99),
    profilesQuery.range(0, 99),
  ]);

  if (memberError) {
    return NextResponse.json(
      { ok: false, message: memberError.message },
      { status: 500 },
    );
  }

  if (profileError) {
    return NextResponse.json(
      { ok: false, message: profileError.message },
      { status: 500 },
    );
  }

  const members = (memberData ?? []) as MemberRow[];
  const profiles = (profileData ?? []) as ProfileRow[];
  const grouped = new Map<
    string,
    {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      rows: MemberRow[];
    }
  >();

  for (const row of members) {
    const key = personKey(row.email, row.first_name, row.last_name);
    const current = grouped.get(key) ?? {
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      rows: [],
    };

    current.first_name ||= row.first_name;
    current.last_name ||= row.last_name;
    current.email ||= row.email;
    current.rows.push(row);
    grouped.set(key, current);
  }

  for (const profile of profiles) {
    const key = personKey(profile.email, profile.first_name, profile.last_name);
    if (!grouped.has(key)) {
      grouped.set(key, {
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        rows: [],
      });
    }
  }

  const candidates: Candidate[] = Array.from(grouped.values())
    .map((person) => {
      const state = getMembershipState(person.rows);

      return {
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        membership_status: state.status,
        membership_expires_at: state.membershipExpiresAt,
        form_present: state.formPresent,
        current_year_paid: state.currentYearPaid,
      };
    })
    .sort((a, b) => {
      const aKey = `${a.last_name ?? ""} ${a.first_name ?? ""} ${a.email ?? ""}`;
      const bKey = `${b.last_name ?? ""} ${b.first_name ?? ""} ${b.email ?? ""}`;
      return aKey.localeCompare(bKey, "it", { sensitivity: "base" });
    });

  return NextResponse.json({
    ok: true,
    candidates,
  });
}

function getMembershipState(rows: MemberRow[]) {
  const formPresent = rows.some((row) => row.source === "google_sheet");
  const paidRow = rows.find(
    (row) =>
      row.source === "official_members_book" &&
      row.membership_status === "verified" &&
      Boolean(
        row.membership_starts_at &&
          row.membership_starts_at >= CURRENT_MEMBERSHIP_START,
      ),
  );

  if (!formPresent) {
    return {
      status: "missing_form" as const,
      formPresent: false,
      currentYearPaid: Boolean(paidRow),
      membershipExpiresAt: paidRow?.membership_expires_at ?? null,
    };
  }

  if (!paidRow) {
    return {
      status: "payment_missing" as const,
      formPresent: true,
      currentYearPaid: false,
      membershipExpiresAt: null,
    };
  }

  return {
    status: "valid" as const,
    formPresent: true,
    currentYearPaid: true,
    membershipExpiresAt: paidRow.membership_expires_at,
  };
}

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeText(value: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function personKey(
  email: string | null,
  firstName: string | null,
  lastName: string | null,
) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) return `email:${normalizedEmail}`;

  return `name:${normalizeText(firstName).toLowerCase()}|${normalizeText(lastName).toLowerCase()}`;
}
