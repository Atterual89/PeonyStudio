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
  partner_email: string | null;
  partner_name: string | null;
  partner_source: string | null;
  events: {
    title: string | null;
    starts_at: string | null;
    ends_at: string | null;
    category: string | null;
    booking_url: string | null;
    requires_partner: boolean | null;
  } | null;
};

export type AttendanceHistoryGrouped = {
  title: string;
  category: string | null;
  starts_at: string | null;
  count: number;
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
  attendanceHistory: AttendanceHistoryGrouped[];
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
  const rawEnrollments = await loadEnrollments(supabase, user.id);
  const enrollments = await ensurePartnerData(supabase, rawEnrollments);
  const attendanceStats = await loadAttendanceStats(supabase, email);
  const attendanceHistory = await loadAttendanceHistory(supabase, email);

  return {
    email,
    profile,
    profileLinked,
    claimedBuyerParticipants: claimResult.claimedBuyerParticipants,
    createdEnrollments: claimResult.createdEnrollments,
    attendanceStats,
    enrollments,
    attendanceHistory,
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
      "id,event_id,ticket_tailor_order_id,ticket_tailor_event_id,enrollment_status,partner_email,partner_name,partner_source",
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
    .select("id,title,starts_at,ends_at,category,booking_url,requires_partner")
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

async function ensurePartnerData(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  enrollments: Enrollment[],
): Promise<Enrollment[]> {
  const needsPartner = enrollments.filter(
    (e) =>
      e.events?.requires_partner === true &&
      !e.partner_email?.trim() &&
      !e.partner_name?.trim() &&
      e.ticket_tailor_order_id,
  );

  if (needsPartner.length === 0) return enrollments;

  const orderIds = needsPartner.map((e) => e.ticket_tailor_order_id as string);

  const { data: orders } = await supabase
    .from("ticket_tailor_orders")
    .select("ticket_tailor_order_id,raw_payload")
    .in("ticket_tailor_order_id", orderIds)
    .not("raw_payload", "is", null);

  if (!orders || orders.length === 0) return enrollments;

  const answerByOrderId = new Map<string, string>();
  for (const order of orders) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questions: any[] = (order.raw_payload as any)?.buyer_details?.custom_questions ?? [];
    const partnerQ = questions.find((q) => {
      if (typeof q.question !== "string") return false;
      const lower = q.question.toLowerCase();
      return lower.includes("partner") || lower.includes("persona con cui verrai");
    });
    const answer = typeof partnerQ?.answer === "string" ? partnerQ.answer.trim() : "";
    if (answer && order.ticket_tailor_order_id) {
      answerByOrderId.set(order.ticket_tailor_order_id, answer);
    }
  }

  if (answerByOrderId.size === 0) return enrollments;

  await Promise.all(
    needsPartner
      .filter((e) => answerByOrderId.has(e.ticket_tailor_order_id as string))
      .map((e) => {
        const answer = answerByOrderId.get(e.ticket_tailor_order_id as string)!;
        const updateData = answer.includes("@")
          ? { partner_email: answer, partner_source: "ticket_tailor" }
          : { partner_name: answer, partner_source: "ticket_tailor" };
        return supabase
          .from("user_event_enrollments")
          .update(updateData)
          .eq("id", e.id);
      }),
  );

  return enrollments.map((e) => {
    const answer = e.ticket_tailor_order_id
      ? answerByOrderId.get(e.ticket_tailor_order_id)
      : undefined;
    if (answer && e.events?.requires_partner && !e.partner_email?.trim() && !e.partner_name?.trim()) {
      return answer.includes("@")
        ? { ...e, partner_email: answer, partner_source: "ticket_tailor" }
        : { ...e, partner_name: answer, partner_source: "ticket_tailor" };
    }
    return e;
  });
}

async function loadAttendanceHistory(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<AttendanceHistoryGrouped[]> {
  const { data, error } = await supabase
    .from("ticket_tailor_issued_tickets")
    .select("event_id,ticket_tailor_event_id,ticket_type_name,events(title,category,starts_at)")
    .eq("holder_email", email)
    .eq("checked_in", true)
    .limit(50);

  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = data as any[];

  const filtered = rows.filter((row) => {
    const cat = row.events?.category as string | null | undefined;
    return row.events != null && cat !== "community" && cat !== "system";
  });

  filtered.sort((a, b) => {
    const aTime = a.events?.starts_at ? new Date(a.events.starts_at as string).getTime() : 0;
    const bTime = b.events?.starts_at ? new Date(b.events.starts_at as string).getTime() : 0;
    return bTime - aTime;
  });

  const groupMap = new Map<string, AttendanceHistoryGrouped>();
  for (const row of filtered) {
    const title = (row.events?.title as string | null) ?? "Evento senza titolo";
    const existing = groupMap.get(title);
    if (existing) {
      existing.count += 1;
    } else {
      groupMap.set(title, {
        title,
        category: (row.events?.category as string | null) ?? null,
        starts_at: (row.events?.starts_at as string | null) ?? null,
        count: 1,
      });
    }
  }

  return Array.from(groupMap.values()).slice(0, 10);
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
