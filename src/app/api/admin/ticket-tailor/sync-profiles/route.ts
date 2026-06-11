import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SyncError = {
  level: "warning" | "error";
  message: string;
  orderId?: string;
};

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");

  if (!expectedSecret) {
    return NextResponse.json(
      { ok: false, message: "ADMIN_SYNC_SECRET is not configured." },
      { status: 500 },
    );
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized sync request." },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const errors: SyncError[] = [];
  let profilesCreated = 0;
  let profilesSkipped = 0;
  let enrollmentsCreated = 0;
  let enrollmentsSkipped = 0;
  let partnerPrefilled = 0;

  // Step 1: Read all orders with buyer_email
  const { data: ordersData, error: ordersError } = await supabase
    .from("ticket_tailor_orders")
    .select(
      "ticket_tailor_order_id,ticket_tailor_event_id,event_id,buyer_email,buyer_first_name,buyer_last_name,raw_payload",
    )
    .not("buyer_email", "is", null)
    .range(0, 999);

  if (ordersError) {
    return NextResponse.json({
      ok: false,
      ordersRead: 0,
      profilesCreated,
      profilesSkipped,
      enrollmentsCreated,
      enrollmentsSkipped,
      partnerPrefilled,
      errors: [
        {
          level: "error",
          message: "Could not load orders: " + ordersError.message,
        },
      ],
    });
  }

  const orders = (ordersData ?? []).filter(
    (o): o is typeof o & { buyer_email: string } =>
      typeof o.buyer_email === "string" && o.buyer_email.trim().length > 0,
  );

  for (const order of orders) {
    try {
      const email = order.buyer_email.trim().toLowerCase();

      // Step 2: Find or create profile by email
      const { data: existingProfile, error: profileLookupError } = await supabase
        .from("profiles")
        .select("id,nickname")
        .eq("email", email)
        .maybeSingle();

      if (profileLookupError) {
        errors.push({
          level: "error",
          message: "Profile lookup failed: " + profileLookupError.message,
          orderId: order.ticket_tailor_order_id,
        });
        continue;
      }

      let profileId: string;

      if (existingProfile !== null && existingProfile.id) {
        profileId = existingProfile.id as string;
        profilesSkipped++;

        // Step 3: Pre-fill nickname if missing
        if (!(existingProfile.nickname as string | null)?.trim()) {
          const nicknameAnswer = extractAnswer(order.raw_payload, (q) =>
            q.includes("nickname"),
          );
          if (nicknameAnswer) {
            await supabase
              .from("profiles")
              .update({ nickname: nicknameAnswer })
              .eq("id", profileId);
          }
        }
      } else {
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({
            email,
            first_name: order.buyer_first_name,
            last_name: order.buyer_last_name,
            role: "user",
          })
          .select("id")
          .single();

        if (insertError || !newProfile) {
          errors.push({
            level: "error",
            message:
              "Profile insert failed: " +
              (insertError?.message ?? "unknown"),
            orderId: order.ticket_tailor_order_id,
          });
          continue;
        }

        profileId = newProfile.id as string;
        profilesCreated++;

        // Step 3: Pre-fill nickname for new profile
        const nicknameAnswer = extractAnswer(order.raw_payload, (q) =>
          q.includes("nickname"),
        );
        if (nicknameAnswer) {
          await supabase
            .from("profiles")
            .update({ nickname: nicknameAnswer })
            .eq("id", profileId);
        }
      }

      // Step 4: Create enrollment if not exists (only if order has event_id)
      if (!order.event_id) continue;

      const { data: existingEnrollment } = await supabase
        .from("user_event_enrollments")
        .select("id,partner_email,partner_name")
        .eq("ticket_tailor_order_id", order.ticket_tailor_order_id)
        .maybeSingle();

      if (existingEnrollment) {
        enrollmentsSkipped++;

        // Step 5: Pre-fill partner for existing enrollment if both fields empty
        if (
          !(existingEnrollment.partner_email as string | null)?.trim() &&
          !(existingEnrollment.partner_name as string | null)?.trim()
        ) {
          const partnerAnswer = extractAnswer(
            order.raw_payload,
            (q) =>
              q.includes("partner") || q.includes("persona con cui verrai"),
          );
          if (partnerAnswer) {
            const updateData = partnerAnswer.includes("@")
              ? { partner_email: partnerAnswer }
              : { partner_name: partnerAnswer };
            await supabase
              .from("user_event_enrollments")
              .update(updateData)
              .eq("id", existingEnrollment.id as string);
            partnerPrefilled++;
          }
        }
      } else {
        const { data: newEnrollment, error: enrollError } = await supabase
          .from("user_event_enrollments")
          .insert({
            profile_id: profileId,
            event_id: order.event_id,
            ticket_tailor_event_id: order.ticket_tailor_event_id,
            ticket_tailor_order_id: order.ticket_tailor_order_id,
            enrollment_status: "active",
          })
          .select("id")
          .single();

        if (enrollError || !newEnrollment) {
          errors.push({
            level: "error",
            message:
              "Enrollment insert failed: " +
              (enrollError?.message ?? "unknown"),
            orderId: order.ticket_tailor_order_id,
          });
          continue;
        }

        enrollmentsCreated++;

        // Step 5: Pre-fill partner for new enrollment
        const partnerAnswer = extractAnswer(
          order.raw_payload,
          (q) =>
            q.includes("partner") || q.includes("persona con cui verrai"),
        );
        if (partnerAnswer) {
          const updateData = partnerAnswer.includes("@")
            ? { partner_email: partnerAnswer }
            : { partner_name: partnerAnswer };
          await supabase
            .from("user_event_enrollments")
            .update(updateData)
            .eq("id", newEnrollment.id as string);
          partnerPrefilled++;
        }
      }
    } catch (err) {
      errors.push({
        level: "error",
        message: err instanceof Error ? err.message : "Unknown error",
        orderId: order.ticket_tailor_order_id,
      });
    }
  }

  console.log("[sync-profiles]", {
    ordersRead: orders.length,
    profilesCreated,
    profilesSkipped,
    enrollmentsCreated,
    enrollmentsSkipped,
    partnerPrefilled,
    errors: errors.length,
  });

  return NextResponse.json({
    ok: !errors.some((e) => e.level === "error"),
    ordersRead: orders.length,
    profilesCreated,
    profilesSkipped,
    enrollmentsCreated,
    enrollmentsSkipped,
    partnerPrefilled,
    errors,
  });
}

function extractAnswer(
  rawPayload: unknown,
  matcher: (questionLower: string) => boolean,
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions: any[] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rawPayload as any)?.buyer_details?.custom_questions ?? [];
  const match = questions.find(
    (q) => typeof q.question === "string" && matcher(q.question.toLowerCase()),
  );
  return typeof match?.answer === "string" ? match.answer.trim() : "";
}
