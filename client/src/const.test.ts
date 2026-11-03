import { describe, expect, it } from "vitest";
import { buildGoogleLoginUrl, OAUTH_ENTRY_INTENT_KEY, readOAuthEntryIntent } from "./const";

describe("GoogleログインURL", () => {
  it("現在のoriginからStudyVerseのGoogle OAuth開始URLを作る", () => {
    const url = new URL(buildGoogleLoginUrl("https://study.example.com/"));
    expect(url.origin).toBe("https://study.example.com");
    expect(url.pathname).toBe("/api/google/oauth/start");
    expect(url.searchParams.get("origin")).toBe("https://study.example.com");
    expect(url.origin).not.toBe("https://manus.im");
  });

  it("学校IDの保存キーはGoogleログイン後の入室情報に使える", () => {
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
