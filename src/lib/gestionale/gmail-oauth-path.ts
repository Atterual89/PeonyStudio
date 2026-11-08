/** The OAuth API has a deliberately narrow, short-lived copy of the authenticated session. */
export const GMAIL_OAUTH_COOKIE_PATH = "/api/gestione/gmail";
export const GMAIL_OAUTH_SESSION_TTL = 600; // 10 minutes, same as OAuth state.
