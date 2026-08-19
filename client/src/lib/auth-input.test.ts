import { describe, expect, it } from "vitest";
import { isValidClassroomCode, isValidPin, normalizeClassroomCode } from "./auth-input";

describe("PINと教室コードの入力検証", () => {
  it("教室コードを正規化し、許可された文字種と長さだけを受け入れる", () => {
    expect(normalizeClassroomCode(" star-2026 ")).toBe("STAR-2026");
    expect(isValidClassroomCode("star-2026")).toBe(true);
    expect(isValidClassroomCode("AB")).toBe(false);
    expect(isValidClassroomCode("STAR_2026")).toBe(false);
  });

  it("PINは4桁の数字以外を拒否する", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });
});
