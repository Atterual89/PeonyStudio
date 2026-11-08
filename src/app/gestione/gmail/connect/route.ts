import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SESSION_COOKIE } from "@/lib/gestionale/server/auth";
import { GMAIL_OAUTH_COOKIE_PATH, GMAIL_OAUTH_SESSION_TTL } from "@/lib/gestionale/gmail-oauth-path";

/**
 * The main PIN cookie is scoped to /gestione and therefore cannot authenticate
 * /api/gestione/gmail/start or its callback. After verifying the admin session,
 * pass a short-lived copy limited to the two OAuth endpoints. Never broaden the
 * long-lived PIN session cookie to the rest of the site.
 */
export async function GET(request: NextRequest) {
  await requireAdmin();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL("/gestione/accesso", request.url));

  const response = NextResponse.redirect(new URL("/api/gestione/gmail/start", request.url));
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: GMAIL_OAUTH_COOKIE_PATH,
    maxAge: GMAIL_OAUTH_SESSION_TTL,
  });
  return response;
}
