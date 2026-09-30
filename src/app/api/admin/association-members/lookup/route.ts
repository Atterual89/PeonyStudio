import { NextRequest, NextResponse } from "next/server";

import {
  deriveMembershipState,
  normalizeMembershipEmail,
  normalizeMembershipNameKey,
  type MembershipEvidenceRow,
} from "@/lib/association/membership-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

  const email = normalizeMembershipEmail(request.nextUrl.searchParams.get("email"));
  const firstName = normalizeText(request.nextUrl.searchParams.get("first_name"));
  const lastName = normalizeText(request.nextUrl.searchParams.get("last_name"));
  const searchNameKey = normalizeMembershipNameKey(firstName, lastName);

  if (!email && !searchNameKey) {
    return NextResponse.json(
      {
        ok: false,
        message: "Inserisci un indirizzo email oppure nome e cognome.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

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
    supabase
      .from("association_members")
      .select(
        "first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at",
      )
      .in("source", ["google_sheet", "official_members_book"])
      .range(0, 9999),
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

  const members = (memberData ?? []) as MembershipEvidenceRow[];
  const profiles = (profileData ?? []) as ProfileRow[];

  const matchingFormRows = members.filter(
    (row) =>
      row.source === "google_sheet" &&
      (email
        ? normalizeMembershipEmail(row.email) === email
        : normalizeMembershipNameKey(row.first_name, row.last_name) ===
          searchNameKey),
  );

  const matchingOfficialRows = email
    ? members.filter(
        (row) =>
          row.source === "official_members_book" &&
          normalizeMembershipEmail(row.email) === email,
      )
    : members.filter(
        (row) =>
          row.source === "official_members_book" &&
          normalizeMembershipNameKey(row.first_name, row.last_name) ===
            searchNameKey,
      );

  const identities = new Map<
    string,
    { first_name: string | null; last_name: string | null; email: string | null }
  >();

  function addIdentity(identity: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }) {
    const normalizedEmail = normalizeMembershipEmail(identity.email);
    const nameKey = normalizeMembershipNameKey(
      identity.first_name,
      identity.last_name,
    );

    if (normalizedEmail) {
      identities.set(`email:${normalizedEmail}`, identity);
      return;
    }

    if (nameKey) {
      const existingByName = Array.from(identities.values()).find(
        (candidate) =>
          normalizeMembershipNameKey(
            candidate.first_name,
            candidate.last_name,
          ) === nameKey,
      );
      if (!existingByName) {
        identities.set(`name:${nameKey}`, identity);
      }
    }
  }

  for (const row of matchingFormRows) addIdentity(row);
  for (const profile of profiles) addIdentity(profile);
  for (const row of matchingOfficialRows) addIdentity(row);

  const candidates: Candidate[] = Array.from(identities.values())
    .map((person) => {
      const state = deriveMembershipState(members, {
        email: person.email,
        firstName: person.first_name,
        lastName: person.last_name,
      });

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

function normalizeText(value: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}
