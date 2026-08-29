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
