import "server-only";

import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  association_status: string | null;
  association_expires_at: string | null;
nickname: string | null;
};

type Enrollment = {
  id: string;
  event_id: string | null;
  ticket_tailor_order_id: string | null;
  ticket_tailor_event_id: string | null;
  enrollment_status: string | null;
  events: {
    title: string | null;
    starts_at: string | null;
    ends_at: string | null;
    category: string | null;
    booking_url: string | null;
  } | null;
};

export type PersonalAreaData = {
  email: string;
  profile: Profile | null;
  profileLinked: boolean;
  claimedBuyerParticipants: number;
  createdEnrollments: number;
  attendanceStats: {
    booked: number;
    checkedIn: number;
  };
  enrollments: Enrollment[];
};

export async function getOrCreatePersonalAreaData(
  user: User,
): Promise<PersonalAreaData> {
  const email = normalizeEmail(user.email);

  if (!email) {
    throw new Error("Authenticated user does not have an email.");
  }

  const supabase = createSupabaseAdminClient();
  const { profile, profileLinked } = await ensureProfile(supabase, user.id, email);
  const claimResult = await claimBuyerEvents(supabase, user.id, email);
  const enrollments = await loadEnrollments(supabase, user.id);
  const attendanceStats = await loadAttendanceStats(supabase, email);

  return {
    email,
    profile,
    profileLinked,
    claimedBuyerParticipants: claimResult.claimedBuyerParticipants,
    createdEnrollments: claimResult.createdEnrollments,
    attendanceStats,
    enrollments,
  };
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

async function ensureProfile(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  email: string,
) {
  const { data: existingById, error: existingByIdError } = await supabase
    .from("profiles")
    .select(
      "id,email,first_name,last_name,nickname,association_status,association_expires_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (existingByIdError) {
    throw new Error(existingByIdError.message);
  }

  if (existingById) {
    const updates: Record<string, string> = {};
    if (!existingById.email) {
      updates.email = email;
    }

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select(
          "id,email,first_name,last_name,nickname,association_status,association_expires_at",
        )
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        profile: data as Profile,
        profileLinked: true,
      };
    }

    return {
      profile: existingById as Profile,
      profileLinked: true,
    };
  }

  const { data: existingByEmail } = await supabase
    .from("profiles")
    .select(
      "id,email,first_name,last_name,nickname,association_status,association_expires_at",
    )
    .eq("email", email)
    .maybeSingle();

  if (existingByEmail?.id === userId) {
    return {
      profile: existingByEmail as Profile,
      profileLinked: true,
    };
  }

  const { data: insertedProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      email,
      role: "user",
    })
    .select(
      "id,email,first_name,last_name,nickname,association_status,association_expires_at",
    )
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    profile: insertedProfile as Profile,
    profileLinked: true,
  };
}

async function claimBuyerEvents(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  profileId: string,
  email: string,
) {
  const { data: buyers, error: buyersError } = await supabase
    .from("event_participants")
    .select(
      "id,event_id,ticket_tailor_event_id,ticket_tailor_order_id,email,participant_type",
    )
    .eq("participant_type", "buyer")
    .eq("email", email);

  if (buyersError) {
    throw new Error(buyersError.message);
  }

  const buyerRows = buyers ?? [];
  const orderIds = buyerRows
    .map((buyer) => buyer.ticket_tailor_order_id)
    .filter((value): value is string => Boolean(value));

  if (buyerRows.length > 0) {
    await supabase
      .from("event_participants")
      .update({
        profile_id: profileId,
        updated_at: new Date().toISOString(),
      })
      .in(
        "id",
        buyerRows.map((buyer) => buyer.id),
      );
  }

  if (orderIds.length > 0) {
    await supabase
      .from("ticket_tailor_orders")
      .update({
        buyer_profile_id: profileId,
        updated_at: new Date().toISOString(),
      })
      .in("ticket_tailor_order_id", orderIds);
  }

  const { data: existingEnrollments, error: existingEnrollmentsError } =
    await supabase
      .from("user_event_enrollments")
      .select("id,ticket_tailor_order_id")
      .eq("profile_id", profileId)
      .in("ticket_tailor_order_id", orderIds.length > 0 ? orderIds : [""]);

  if (existingEnrollmentsError) {
    throw new Error(existingEnrollmentsError.message);
  }

  const existingOrderIds = new Set(
    (existingEnrollments ?? [])
      .map((enrollment) => enrollment.ticket_tailor_order_id)
      .filter(Boolean),
  );
  const rowsToInsert = buyerRows
    .filter(
      (buyer) =>
        buyer.ticket_tailor_order_id &&
        !existingOrderIds.has(buyer.ticket_tailor_order_id),
    )
    .map((buyer) => ({
      profile_id: profileId,
      event_id: buyer.event_id,
      ticket_tailor_order_id: buyer.ticket_tailor_order_id,
      ticket_tailor_event_id: buyer.ticket_tailor_event_id,
      enrollment_status: "active",
    }));

  if (rowsToInsert.length > 0) {
    const { error: insertEnrollmentsError } = await supabase
      .from("user_event_enrollments")
      .insert(rowsToInsert);

    if (insertEnrollmentsError) {
      throw new Error(insertEnrollmentsError.message);
    }
  }

  return {
    claimedBuyerParticipants: buyerRows.length,
    createdEnrollments: rowsToInsert.length,
  };
}

async function loadEnrollments(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  profileId: string,
) {
  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from("user_event_enrollments")
    .select(
      "id,event_id,ticket_tailor_order_id,ticket_tailor_event_id,enrollment_status",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  const enrollments = (enrollmentRows ?? []) as Omit<Enrollment, "events">[];
  if (enrollments.length === 0) {
    return [];
  }

  const eventIds = Array.from(
    new Set(
      enrollments
        .map((enrollment) => enrollment.event_id)
        .filter((eventId): eventId is string => Boolean(eventId)),
    ),
  );

  if (eventIds.length === 0) {
    return enrollments.map((enrollment) => ({
      ...enrollment,
      events: null,
    }));
  }

  const { data: eventRows, error: eventsError } = await supabase
    .from("events")
    .select("id,title,starts_at,ends_at,category,booking_url")
    .in("id", eventIds);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const eventsById = new Map(
    (eventRows ?? []).map((event) => [event.id, event]),
  );

  return enrollments.map((enrollment) => ({
    ...enrollment,
    events: enrollment.event_id
      ? eventsById.get(enrollment.event_id) ?? null
      : null,
  }));
}

async function loadAttendanceStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
) {
  const { data, error } = await supabase
    .from("event_participants")
    .select("checked_in")
    .eq("participant_type", "attendee")
    .eq("email", email);

  if (error) {
    throw new Error(error.message);
  }

  const attendees = data ?? [];

  return {
    booked: attendees.length,
    checkedIn: attendees.filter((participant) => participant.checked_in === true)
      .length,
  };
}
