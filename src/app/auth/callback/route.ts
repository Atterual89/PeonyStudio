import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = sanitizeNextPath(
    requestUrl.searchParams.get("next") ?? "/area-personale",
  );
  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    console.error("Supabase auth callback code exchange failed", error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "magiclink",
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    console.error("Supabase auth callback OTP verification failed", error);
  } else {
    console.error("Supabase auth callback missing code or token_hash/type");
  }

  return NextResponse.redirect(
    new URL(
      "/area-personale/login?error=auth_callback_failed",
      requestUrl.origin,
    ),
  );
}

function sanitizeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/area-personale";
}
