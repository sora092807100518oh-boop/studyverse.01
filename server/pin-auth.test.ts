import { describe, expect, it } from "vitest";
import { createSessionToken, getAttemptKeyHash, getPinLookupHash, getSessionTokenHash, hashPin, verifyPin } from "./pin-auth";

describe("PIN認証の暗号処理", () => {
  it("PINをソルト付きハッシュ化し、正しいPINのみを検証する", async () => {
    const hash = await hashPin("1234");
    expect(hash).not.toContain("1234");
    await expect(verifyPin("1234", hash)).resolves.toBe(true);
    await expect(verifyPin("0000", hash)).resolves.toBe(false);
  });

  it("教室ごとのPIN検索キー、試行キー、セッショントークンを分離する", () => {
    expect(getPinLookupHash(1, "1234", "pepper")).not.toBe(getPinLookupHash(2, "1234", "pepper"));
    expect(getAttemptKeyHash("STAR-2026", "ip-a", "pepper")).not.toBe(getAttemptKeyHash("STAR-2026", "ip-b", "pepper"));
    const token = createSessionToken();
    expect(token).toHaveLength(43);
    expect(getSessionTokenHash(token, "pepper")).toHaveLength(64);
  });
});
