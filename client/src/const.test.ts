import { describe, expect, it } from "vitest";
import { buildOAuthLoginUrl, OAUTH_ENTRY_INTENT_KEY, readOAuthEntryIntent } from "./const";
import { decodeOAuthState } from "@shared/const";

describe("OAuthログインURL", () => {
  it("Manusの専用認証画面へ遷移し、現在のoriginをコールバックに使う", () => {
    const url = buildOAuthLoginUrl({ appId: "studyverse-app", portal: "https://manus.im", origin: "https://study.example.com", nonce: "nonce-123" });
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://manus.im");
    expect(parsed.pathname).toBe("/app-auth");
    expect(parsed.searchParams.get("appId")).toBe("studyverse-app");
    expect(parsed.searchParams.get("redirectUri")).toBe("https://study.example.com/api/oauth/callback");
    expect(parsed.searchParams.get("responseType")).toBe("code");
    expect(parsed.searchParams.has("app_id")).toBe(false);
    expect(parsed.searchParams.has("redirect_url")).toBe(false);
    expect(decodeOAuthState(parsed.searchParams.get("state") ?? "")).toEqual({ redirectUri: "https://study.example.com/api/oauth/callback", nonce: "nonce-123" });
  });
  it("壊れたstateはnonceなしとして扱う", () => {
    expect(decodeOAuthState("not-valid-state")).toEqual({ redirectUri: "" });
  });
  it("学校IDの保存キーは認証後の入室情報に使える", () => {
    expect(OAUTH_ENTRY_INTENT_KEY).toBe("studyverse-oauth-entry-intent");
  });
  it("学校IDを検証して大文字で復元し、空の入力は個人利用として復元する", () => {
    expect(readOAuthEntryIntent('{"schoolId":" school-2026 "}')).toEqual({ schoolId: "SCHOOL-2026" });
    expect(readOAuthEntryIntent("{}")).toEqual({});
    expect(readOAuthEntryIntent('{"schoolId":"<script>"}')).toBeNull();
    expect(readOAuthEntryIntent("null")).toBeNull();
    expect(readOAuthEntryIntent("broken")).toBeNull();
    expect(readOAuthEntryIntent(null)).toBeNull();
  });
});
