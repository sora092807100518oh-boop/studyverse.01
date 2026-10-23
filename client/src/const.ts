import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export function buildOAuthLoginUrl(input: { appId: string; portal: string; origin: string; nonce: string }) {
  const redirectUri = `${input.origin}/api/oauth/callback`;
  const state = encodeOAuthState({ redirectUri, nonce: input.nonce });
  const url = new URL("/login", input.portal);
  url.searchParams.set("app_id", input.appId);
  url.searchParams.set("redirect_url", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export function startLogin() {
  const appId = import.meta.env.VITE_APP_ID as string | undefined;
  const portal = (import.meta.env.VITE_OAUTH_PORTAL_URL as string | undefined) || "https://auth.manus.im";
  if (!appId) throw new Error("OAuthのアプリ設定が見つかりません。");
  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  window.location.href = buildOAuthLoginUrl({ appId, portal, origin: window.location.origin, nonce });
}
