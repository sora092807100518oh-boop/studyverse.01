export const AXIOS_TIMEOUT_MS = 30_000;
export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
export const OAUTH_STATE_COOKIE = "__Host-oauth_state";
export const GOOGLE_OAUTH_STATE_COOKIE = "studyverse_google_oauth_state";
export const GOOGLE_SESSION_COOKIE = "studyverse_google_session";
export type OAuthState = { redirectUri: string; nonce?: string };
export const encodeOAuthState = (state: OAuthState): string => btoa(JSON.stringify(state));
export const decodeOAuthState = (state: string): OAuthState => {
  try {
    const parsed = JSON.parse(atob(state));
    return parsed && typeof parsed.redirectUri === "string" ? parsed : { redirectUri: "" };
  } catch {
    return { redirectUri: "" };
  }
};
