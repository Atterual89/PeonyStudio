import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LOCAL_AUTH_CALLBACK_URL = "http://localhost:3000/auth/callback";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const expectedSecret = process.env.DEV_AUTH_LINK_SECRET;
  const providedSecret = request.nextUrl.searchParams.get("secret");

  if (!expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "DEV_AUTH_LINK_SECRET is not configured.",
      },
      { status: 500 },
    );
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized request.",
      },
      { status: 401 },
    );
  }

  const email = normalizeEmail(request.nextUrl.searchParams.get("email"));
  if (!isValidEmail(email)) {
    return NextResponse.json(
      {
        ok: false,
        message: "A valid email query parameter is required.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  await ensureAuthUser(supabase, email);

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: LOCAL_AUTH_CALLBACK_URL,
    },
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message,
      },
      { status: 500 },
    );
  }

  const hashedToken = data.properties?.hashed_token;
  if (!hashedToken) {
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase did not return a hashed_token.",
      },
      { status: 500 },
    );
  }

  const localCallbackLink = buildLocalCallbackLink(request, hashedToken);

  return new NextResponse(renderHtml(email, localCallbackLink), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function buildLocalCallbackLink(request: NextRequest, tokenHash: string) {
  const url = new URL("/auth/callback", request.url);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("next", "/area-personale");
  return url.toString();
}

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function ensureAuthUser(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
) {
  const { error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (!error || isAlreadyRegisteredError(error.message)) {
    return;
  }

  throw new Error(error.message);
}

function isAlreadyRegisteredError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("exists")
  );
}

function renderHtml(email: string, actionLink: string) {
  const safeEmail = escapeHtml(email);
  const safeActionLink = escapeHtml(actionLink);

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dev auth link - Peony Studio</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f4efe8;
        color: #211815;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(680px, calc(100vw - 32px));
        border: 1px solid rgb(33 24 21 / 0.12);
        border-radius: 8px;
        background: rgb(255 255 255 / 0.62);
        padding: 28px;
        box-shadow: 0 16px 40px rgb(33 24 21 / 0.08);
      }
      p {
        color: #5f524c;
        line-height: 1.6;
      }
      a {
        display: inline-flex;
        margin-top: 16px;
        border-radius: 999px;
        background: #211815;
        color: #f4efe8;
        padding: 12px 18px;
        text-decoration: none;
        font-weight: 700;
      }
      code {
        display: block;
        margin-top: 18px;
        overflow-wrap: anywhere;
        border-radius: 8px;
        background: rgb(33 24 21 / 0.06);
        padding: 12px;
        color: #5f524c;
      }
    </style>
  </head>
  <body>
    <main>
      <p>Dev only</p>
      <h1>Link di accesso generato</h1>
      <p>Email: <strong>${safeEmail}</strong></p>
      <p>Apri questo link per entrare in locale senza inviare email.</p>
      <a href="${safeActionLink}">Accedi all'area personale</a>
      <code>${safeActionLink}</code>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
