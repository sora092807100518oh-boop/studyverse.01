import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME, encodeOAuthState, OAUTH_STATE_COOKIE } from "../shared/const";

const mock = vi.hoisted(() => ({
  exchange: vi.fn(), info: vi.fn(), session: vi.fn(), upsert: vi.fn(),
  pin: vi.fn(), admin: vi.fn(), teacher: vi.fn(),
}));
vi.mock("./_core/sdk", () => ({ sdk: { exchangeCodeForToken: mock.exchange, getUserInfo: mock.info, createSessionToken: mock.session } }));
vi.mock("./db", () => ({ upsertUser: mock.upsert, revokePinSession: mock.pin, revokeSiteAdminSession: mock.admin, revokeTeacherAdminSession: mock.teacher }));
import { registerOAuthRoutes } from "./_core/oauth";

let server: Server;
let origin: string;
beforeAll(async () => {
  const app = express();
  registerOAuthRoutes(app);
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test port");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  vi.clearAllMocks();
  mock.exchange.mockResolvedValue({ accessToken: "test-access-token" });
  mock.info.mockResolvedValue({ openId: "oauth-account-B", name: "Learner B", loginMethod: "google" });
  mock.session.mockResolvedValue("new-oauth-session");
});

async function callback(cookie?: string, nonce = "test-nonce") {
  const state = encodeOAuthState({ redirectUri: `${origin}/api/oauth/callback`, nonce });
  return fetch(`${origin}/api/oauth/callback?code=test-code&state=${encodeURIComponent(state)}`, {
    redirect: "manual", headers: cookie ? { Cookie: cookie } : {},
  });
}

describe("StudyVerse OAuth callback", () => {
  it("sets the OAuth session, clears incompatible identities and returns to StudyVerse", async () => {
    const response = await callback(`${OAUTH_STATE_COOKIE}=test-nonce; studyverse_pin=old-pin; studyverse_admin=old-admin; studyverse_teacher=old-teacher`);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?oauth=complete");
    expect(mock.exchange).toHaveBeenCalledTimes(1);
    expect(mock.upsert).toHaveBeenCalledWith(expect.objectContaining({ openId: "oauth-account-B", loginMethod: "google" }));
    expect(mock.pin).toHaveBeenCalledWith("old-pin");
    expect(mock.admin).toHaveBeenCalledWith("old-admin");
    expect(mock.teacher).toHaveBeenCalledWith("old-teacher");
    const cookies = response.headers.getSetCookie();
    expect(cookies.some(value => value.startsWith(`${COOKIE_NAME}=new-oauth-session`))).toBe(true);
    for (const name of [OAUTH_STATE_COOKIE, "studyverse_pin", "studyverse_admin", "studyverse_teacher"]) {
      expect(cookies.some(value => value.startsWith(`${name}=`) && value.includes("Expires="))).toBe(true);
    }
  });

  it("rejects missing or mismatched state before exchanging any code", async () => {
    expect((await callback()).status).toBe(403);
    expect((await callback(`${OAUTH_STATE_COOKIE}=another-nonce`)).status).toBe(403);
    expect(mock.exchange).not.toHaveBeenCalled();
  });

  it("keeps a useful retry link when the provider exchange fails", async () => {
    mock.exchange.mockRejectedValueOnce(new Error("provider failed"));
    const response = await callback(`${OAUTH_STATE_COOKIE}=test-nonce`);
    expect(response.status).toBe(502);
    expect(await response.text()).toContain('href="/"');
    expect(response.headers.getSetCookie().some(value => value.startsWith(`${COOKIE_NAME}=`))).toBe(false);
  });
});
