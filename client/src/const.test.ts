import { describe, expect, it } from "vitest";
import { buildOAuthLoginUrl } from "./const";
import { decodeOAuthState } from "@shared/const";

describe("OAuthログインURL", () => {
  it("現在のoriginをコールバックに使い、nonce付きstateを渡す", () => {
    const url = buildOAuthLoginUrl({ appId: "studyverse-app", portal: "https://auth.manus.im", origin: "https://study.example.com", nonce: "nonce-123" });
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://auth.manus.im");
    expect(parsed.pathname).toBe("/login");
    expect(parsed.searchParams.get("app_id")).toBe("studyverse-app");
    expect(parsed.searchParams.get("redirect_url")).toBe("https://study.example.com/api/oauth/callback");
    expect(decodeOAuthState(parsed.searchParams.get("state") ?? "")).toEqual({ redirectUri: "https://study.example.com/api/oauth/callback", nonce: "nonce-123" });
  });

  it("壊れたstateはnonceなしとして扱う", () => {
    expect(decodeOAuthState("not-valid-state")).toEqual({ redirectUri: "" });
  });
});
