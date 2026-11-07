import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { parse as parseCookie } from "cookie";
import { GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_SESSION_COOKIE, encodeOAuthState, decodeOAuthState } from "../../shared/const";
import { revokePinSession, revokeSiteAdminSession, revokeTeacherAdminSession } from "../db";
import { createGoogleSession, upsertGoogleUser } from "../google-auth";
import { getSessionCookieOptions } from "./cookies";

export const PUBLIC_APP_ORIGIN = process.env.PUBLIC_APP_ORIGIN ?? "https://tonanstudy-dmdhuxmz.manus.space";

function allowedOrigins() {
  const configured = [
    PUBLIC_APP_ORIGIN,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ];
  return new Set(configured.filter((value): value is string => Boolean(value)));
}

function getOrigin(raw: unknown) {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    if (url.pathname !== "/" || url.search || url.hash) return null;
    if (allowedOrigins().has(url.origin)) return url.origin;
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) return url.origin;
    return null;
  } catch { return null; }
}

function errorPage(message: string) {
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><title>ログイン</title><meta name="viewport" content="width=device-width,initial-scale=1"><p>${message}</p><a href="/">ログイン画面へ戻る</a>`;
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/google/oauth/start", (req, res) => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const origin = getOrigin(req.query.origin) ?? (req.hostname === new URL(PUBLIC_APP_ORIGIN).hostname ? PUBLIC_APP_ORIGIN : null);
    if (!clientId || !origin) return res.status(400).type("html").send(errorPage("Googleログインの設定を確認できませんでした。公開サイトから最初からやり直してください。"));
    const redirectUri = `${origin}/api/google/oauth/callback`;
    const nonce = randomUUID();
    const state = encodeOAuthState({ redirectUri, nonce });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    const options = getSessionCookieOptions(req);
    res.cookie(GOOGLE_OAUTH_STATE_COOKIE, nonce, { ...options, maxAge: 10 * 60 * 1000 });
    return res.redirect(url.toString());
  });

  app.get("/api/google/oauth/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const rawState = typeof req.query.state === "string" ? req.query.state : "";
    const { nonce, redirectUri } = decodeOAuthState(rawState);
    const cookies = parseCookie(req.headers.cookie ?? "");
    const options = getSessionCookieOptions(req);
    let origin: string | null = null;
    try { origin = redirectUri ? new URL(redirectUri).origin : null; } catch { origin = null; }
    if (!code || !nonce || cookies[GOOGLE_OAUTH_STATE_COOKIE] !== nonce || !origin || redirectUri !== `${origin}/api/google/oauth/callback` || (!allowedOrigins().has(origin) && !["http://localhost", "http://127.0.0.1"].some(local => origin === local || origin.startsWith(`${local}:`)))) {
      return res.status(403).type("html").send(errorPage("Google認証の確認に失敗しました。最初からログインし直してください。"));
    }
    res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, { ...options, maxAge: -1 });
    try {
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
      if (!tokenResponse.ok) throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
      const token = await tokenResponse.json() as { access_token?: string };
      if (!token.access_token) throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
      if (!profileResponse.ok) throw new Error("GOOGLE_USERINFO_FAILED");
      const profile = await profileResponse.json() as { sub?: string; name?: string; email?: string };
      if (!profile.sub) throw new Error("GOOGLE_SUBJECT_MISSING");
      const user = await upsertGoogleUser({ subject: profile.sub, name: profile.name, email: profile.email });
      const session = await createGoogleSession(user.id);
      if (cookies.studyverse_pin) await revokePinSession(cookies.studyverse_pin);
      if (cookies.studyverse_admin) await revokeSiteAdminSession(cookies.studyverse_admin);
      if (cookies.studyverse_teacher) await revokeTeacherAdminSession(cookies.studyverse_teacher);
      for (const name of ["studyverse_pin", "studyverse_admin", "studyverse_teacher"]) res.clearCookie(name, { ...options, maxAge: -1 });
      res.cookie(GOOGLE_SESSION_COOKIE, session.token, { ...options, maxAge: 30 * 24 * 60 * 60 * 1000 });
      return res.redirect(`${origin}/?oauth=complete`);
    } catch (error) {
      console.error("[Google OAuth] callback failed", error);
      return res.status(502).type("html").send(errorPage("Googleログインを完了できませんでした。もう一度お試しください。"));
    }
  });
}
