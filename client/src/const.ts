import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export type OAuthEntryIntent = { schoolId?: string };
export const OAUTH_ENTRY_INTENT_KEY = "studyverse-oauth-entry-intent";

export function buildOAuthLoginUrl(input: { appId: string; portal: string; origin: string; nonce: string }) {
  const redirectUri = `${input.origin}/api/oauth/callback`;
  const state = encodeOAuthState({ redirectUri, nonce: input.nonce });
  const url = new URL("/app-auth", input.portal);
  url.searchParams.set("appId", input.appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("responseType", "code");
  url.searchParams.set("state", state);
  return url.toString();
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
  const appId = import.meta.env.VITE_APP_ID as string | undefined;
  const portal = import.meta.env.VITE_OAUTH_PORTAL_URL as string | undefined;
  if (!appId) throw new Error("OAuthのアプリ設定が見つかりません。");
  if (!portal) throw new Error("OAuthの認証先が設定されていません。");
  const nonce = crypto.randomUUID();
  const url = buildOAuthLoginUrl({ appId, portal, origin: window.location.origin, nonce });
  sessionStorage.setItem(OAUTH_ENTRY_INTENT_KEY, JSON.stringify(intent));
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  window.location.assign(url);
}
