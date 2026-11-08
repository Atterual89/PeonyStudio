import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const file = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Gmail OAuth: auth session scope", () => {
  it("keeps the normal operator session restricted to /gestione", () => {
    const auth = file("src/lib/gestionale/server/auth.ts");
    expect(auth).toContain('path: "/gestione"');
  });

  it("uses the protected Gmail bridge for both connect and reconnect", () => {
    const button = file("src/components/gestionale/SyncAssociationMailButton.tsx");
    expect(button.match(/href="\/gestione\/gmail\/connect"/g)).toHaveLength(2);
    expect(button).not.toContain('href="/api/gestione/gmail/start"');
  });

  it("does not expose the PIN session outside the OAuth API scope", () => {
    const bridge = file("src/app/gestione/gmail/connect/route.ts");
    expect(bridge).toContain("await requireAdmin()");
    expect(bridge).toContain("request.cookies.get(SESSION_COOKIE)");
    expect(bridge).toContain("httpOnly: true");
    expect(bridge).toContain('sameSite: "lax"');
    expect(bridge).toContain("GMAIL_OAUTH_COOKIE_PATH");
    expect(bridge).toContain("GMAIL_OAUTH_SESSION_TTL");
    const scope = file("src/lib/gestionale/gmail-oauth-path.ts");
    expect(scope).toContain('GMAIL_OAUTH_COOKIE_PATH = "/api/gestione/gmail"');
    expect(scope).toContain("GMAIL_OAUTH_SESSION_TTL = 600");
  });

  it("clears the temporary OAuth session on every callback result", () => {
    const callback = file("src/app/api/gestione/gmail/callback/route.ts");
    expect(callback).toContain("response.cookies.set(SESSION_COOKIE");
    expect(callback).toContain("GMAIL_OAUTH_COOKIE_PATH");
    expect(callback).toContain("maxAge:0");
  });

  it("redirects through the bridge with a short-lived same-site HttpOnly cookie", async () => {
    vi.resetModules();
    vi.doMock("@/lib/gestionale/server/auth", () => ({
      requireAdmin: vi.fn(async () => ({ id: "admin", role: "admin" })),
      SESSION_COOKIE: "gw_session",
    }));
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/gestione/gmail/connect/route");
    const request = new NextRequest("https://peonystudio.net/gestione/gmail/connect", {
      headers: { cookie: "gw_session=test-session" },
    });
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://peonystudio.net/api/gestione/gmail/start");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("gw_session=test-session");
    expect(setCookie).toContain("Path=/api/gestione/gmail");
    expect(setCookie).toContain("Max-Age=600");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Secure");
    vi.doUnmock("@/lib/gestionale/server/auth");
  });
});
