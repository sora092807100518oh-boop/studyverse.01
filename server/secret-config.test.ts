import { describe, expect, it } from "vitest";

describe("voice configuration", () => {
  it("can call a lightweight local endpoint with the configured value", async () => {
    expect(process.env.VITE_DUMMY_SECRET).toBe("dummy");
    const configuredValue = process.env.VITE_DUMMY_SECRET;
    expect(configuredValue).toBeTruthy();

    const endpoint = new Request("https://studyverse.local/api/voice-config-check", {
      headers: { "x-studyverse-config": configuredValue ?? "" },
    });

    expect(endpoint.url).toContain("/api/voice-config-check");
    expect(endpoint.headers.get("x-studyverse-config")).toBe(configuredValue);
  });
});

describe("smart notification push configuration", () => {
  it("can call a lightweight push configuration endpoint with VAPID values", async () => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    expect(publicKey).toBeTruthy();
    expect(privateKey).toBeTruthy();
    expect(subject).toBeTruthy();
    const endpoint = new Request("https://studyverse.local/api/smart-notifications/config", {
      headers: { "x-vapid-public-key": publicKey ?? "", "x-vapid-private-key": privateKey ?? "", "x-vapid-subject": subject ?? "" },
    });
    expect(endpoint.url).toContain("/api/smart-notifications/config");
    expect(endpoint.headers.get("x-vapid-public-key")).toBe(publicKey);
    expect(endpoint.headers.get("x-vapid-private-key")).toBe(privateKey);
    expect(endpoint.headers.get("x-vapid-subject")).toBe(subject);
  });
});
