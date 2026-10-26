import type { Express } from "express";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME, decodeOAuthState, OAUTH_STATE_COOKIE, ONE_YEAR_MS } from "../../shared/const";
import { revokePinSession, revokeSiteAdminSession, revokeTeacherAdminSession, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req, res) => {
    const options = getSessionCookieOptions(req);
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const rawState = typeof req.query.state === "string" ? req.query.state : "";
    const { nonce } = decodeOAuthState(rawState);
    const cookies = parseCookie(req.headers.cookie ?? "");
    if (!code || !nonce || cookies[OAUTH_STATE_COOKIE] !== nonce) {
      return res.status(403).type("html").send('<!doctype html><html lang="ja"><meta charset="utf-8"><title>StudyVerse ログイン</title><p>認証の確認に失敗しました。最初からログインし直してください。</p><a href="/">StudyVerseのログイン画面へ戻る</a></html>');
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { ...options, maxAge: -1 });
    try {
      const token = await sdk.exchangeCodeForToken(code, rawState);
      const info = await sdk.getUserInfo(token.accessToken);
      await upsertUser({ openId: info.openId, name: info.name ?? null, email: info.email ?? null, loginMethod: info.loginMethod ?? info.platform ?? null, lastSignedIn: new Date() });
      const session = await sdk.createSessionToken(info.openId, { name: info.name || info.email || "StudyVerse User" });
      // New OAuth accounts must not inherit an old learner or administrator identity.
      if (cookies.studyverse_pin) await revokePinSession(cookies.studyverse_pin);
      if (cookies.studyverse_admin) await revokeSiteAdminSession(cookies.studyverse_admin);
      if (cookies.studyverse_teacher) await revokeTeacherAdminSession(cookies.studyverse_teacher);
      for (const name of ["studyverse_pin", "studyverse_admin", "studyverse_teacher"]) res.clearCookie(name, { ...options, maxAge: -1 });
      res.cookie(COOKIE_NAME, session, { ...options, maxAge: ONE_YEAR_MS });
      return res.redirect("/?oauth=complete");
    } catch {
      console.error("[OAuth] callback exchange or session setup failed");
      return res.status(502).type("html").send('<!doctype html><html lang="ja"><meta charset="utf-8"><title>StudyVerse ログイン</title><p>ログインを完了できませんでした。もう一度お試しください。</p><a href="/">StudyVerseのログイン画面へ戻る</a></html>');
    }
  });
}
