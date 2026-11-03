export type OAuthEntryIntent = { schoolId?: string };
export const OAUTH_ENTRY_INTENT_KEY = "studyverse-oauth-entry-intent";

export function buildGoogleLoginUrl(origin: string) {
  const normalizedOrigin = origin.replace(/\/$/, "");
  return `${normalizedOrigin}/api/google/oauth/start?origin=${encodeURIComponent(normalizedOrigin)}`;
}

export function readOAuthEntryIntent(raw: string | null): OAuthEntryIntent | null {
  if (!raw) return null;
  try {
    const intent = JSON.parse(raw);
    if (!intent || typeof intent !== "object" || Array.isArray(intent)) return null;
    if (intent.schoolId === undefined) return {};
    if (typeof intent.schoolId !== "string" || !/^[A-Za-z0-9-]{3,32}$/.test(intent.schoolId.trim())) return null;
    return { schoolId: intent.schoolId.trim().toUpperCase() };
  } catch { return null; }
}

export function startLogin(intent: OAuthEntryIntent) {
  sessionStorage.setItem(OAUTH_ENTRY_INTENT_KEY, JSON.stringify(intent));
  window.location.assign(buildGoogleLoginUrl(window.location.origin));
}
