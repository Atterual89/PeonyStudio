import { NextResponse, type NextRequest } from "next/server";

// Proxy (ex middleware) limitato al gestionale: il matcher esclude tutte le
// altre rotte del sito. Fa solo il redirect quando manca il cookie: NON è un
// controllo di sicurezza, la sessione si valida sul database con
// requireOperator() in ogni pagina e azione.

const SESSION_COOKIE = "gw_session";
const LOGIN_PATH = "/gestione/accesso";

export function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH;

  const response =
    !isLoginPage && !request.cookies.has(SESSION_COOKIE)
      ? NextResponse.redirect(new URL(LOGIN_PATH, request.url))
      : NextResponse.next();

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/gestione", "/gestione/:path*"],
};
