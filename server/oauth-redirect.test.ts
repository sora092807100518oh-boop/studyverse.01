import { describe, expect, it } from "vitest";
import { encodeOAuthState } from "../shared/const";
import { getOAuthRedirectUri } from "./_core/sdk";

describe("OAuth callback redirect URI", () => {
  it("nonce付きstateからStudyVerseのコールバックURLだけを取り出す", () => {
    const state = encodeOAuthState({ redirectUri: "https://tonanstudy.example/api/oauth/callback", nonce: "secure-nonce" });
    expect(getOAuthRedirectUri(state)).toBe("https://tonanstudy.example/api/oauth/callback");
  });

  it("不正なstateは空の戻り先として拒否可能にする", () => {
    expect(getOAuthRedirectUri("malformed-state")).toBe("");
  });
});
