import { describe, expect, it } from "vitest";
import { isWithinSmartNotificationWindow } from "./db";

describe("スマート通知の受信時間帯", () => {
  it("日本時間の開始以上・終了未満だけを許可する", () => {
    expect(isWithinSmartNotificationWindow(new Date("2026-09-01T00:00:00.000Z"), "08:00", "21:00")).toBe(true);
    expect(isWithinSmartNotificationWindow(new Date("2026-09-01T11:59:00.000Z"), "08:00", "21:00")).toBe(true);
    expect(isWithinSmartNotificationWindow(new Date("2026-09-01T13:00:00.000Z"), "08:00", "21:00")).toBe(false);
  });

  it("終了時刻が開始時刻より前の日跨ぎ時間帯を許可する", () => {
    expect(isWithinSmartNotificationWindow(new Date("2026-09-01T14:00:00.000Z"), "23:00", "06:00")).toBe(true);
    expect(isWithinSmartNotificationWindow(new Date("2026-09-01T20:00:00.000Z"), "23:00", "06:00")).toBe(true);
    expect(isWithinSmartNotificationWindow(new Date("2026-09-01T06:00:00.000Z"), "23:00", "06:00")).toBe(false);
  });

  it("同時刻は終日、不正な時刻は不許可にする", () => {
    expect(isWithinSmartNotificationWindow(new Date("2026-09-01T12:00:00.000Z"), "08:00", "08:00")).toBe(true);
    expect(isWithinSmartNotificationWindow(new Date("2026-09-01T12:00:00.000Z"), "8:00", "21:00")).toBe(false);
  });
});
