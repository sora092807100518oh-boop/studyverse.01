import { describe, expect, it } from "vitest";

describe("Google OAuth configuration", () => {
  it("Google token endpoint accepts the configured client credentials", async () => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    expect(clientId, "GOOGLE_OAUTH_CLIENT_ID must be configured").toBeTruthy();
    expect(clientSecret, "GOOGLE_OAUTH_CLIENT_SECRET must be configured").toBeTruthy();

    const body = new URLSearchParams({
      code: "studyverse-configuration-check",
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: "https://tonanstudy-dmdhuxmz.manus.space/api/google/oauth/callback",
      grant_type: "authorization_code",
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await response.json()) as { error?: string };
    expect(response.status).toBe(400);
    expect(payload.error).toBe("invalid_grant");
  }, 20_000);
});
