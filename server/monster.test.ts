import { describe, expect, it } from "vitest";
import { buildMissionState, calculateMonsterStage, tokyoDay } from "./monster";

describe("モンスター育成の進行計算", () => {
  it("初期進化から始まり、学習20時間または1200ポイントごとに1進化する", () => {
    expect(calculateMonsterStage(0, 0)).toMatchObject({ stage: 1, minutesToNext: 1200, stageProgress: 0 });
    expect(calculateMonsterStage(20 * 60 * 60, 0)).toMatchObject({ stage: 2, minutesToNext: 1200 });
    expect(calculateMonsterStage(0, 1199)).toMatchObject({ stage: 1, minutesToNext: 1 });
    expect(calculateMonsterStage(0, 1200)).toMatchObject({ stage: 2, minutesToNext: 1200 });
    expect(calculateMonsterStage(9999 * 60 * 60, 9999)).toMatchObject({ stage: 13, minutesToNext: 0, stageProgress: 100 });
  });
});

describe("モンスターミッションの進捗", () => {
  const today = new Date("2026-08-21T12:00:00+09:00");

  it("日本時間の日付キーを安定した年-月-日形式で返す", () => {
    expect(tokyoDay(today)).toBe("2026-08-21");
  });

  it("5種類のデイリーを全達成すると各1ポイントと追加5ポイントを受取可能にする", () => {
    const state = buildMissionState({
      startedAt: new Date("2026-08-21T00:01:00+09:00"),
      activities: [
        { action: "login.success", details: "pin", createdAt: today },
        { action: "ai_select.completed", details: "english", createdAt: today },
        { action: "ai_select.completed", details: "kanji", createdAt: today },
      ],
      records: [
        { mode: "test", answeredAt: today },
        { mode: "practice", answeredAt: today },
      ],
      now: today,
    });
    expect(state.daily).toMatchObject({ progress: 5, complete: true });
    expect(state.daily.rewards).toHaveLength(6);
    expect(state.daily.rewards.reduce((sum, reward) => sum + reward.points, 0)).toBe(10);
    expect(state.daily.rewards.some(reward => reward.missionKey === "daily.bonus" && reward.points === 5)).toBe(true);
  });

  it("マンスリーではログイン日数、解答数、AIセレクト完了数を個別に集計する", () => {
    const activities = Array.from({ length: 10 }, (_, index) => ({ action: "login.success", details: "pin", createdAt: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T12:00:00+09:00`) })).concat(Array.from({ length: 3 }, () => ({ action: "ai_select.completed", details: "english", createdAt: today })));
    const records = Array.from({ length: 50 }, () => ({ mode: "practice" as const, answeredAt: today }));
    const state = buildMissionState({ startedAt: new Date("2026-08-01T00:00:00+09:00"), activities, records, now: today });
    const mission = (key: string) => state.monthly.missions.find(item => item.key === key)!;
    expect(mission("login-10")).toMatchObject({ value: 10, complete: true });
    expect(mission("answers-50")).toMatchObject({ value: 50, complete: true });
    expect(mission("ai-3")).toMatchObject({ value: 3, complete: true });
    expect(mission("ai-5")).toMatchObject({ value: 3, complete: false });
  });

  it("土曜・日曜のログイン回数を日本時間の曜日として集計する", () => {
    const activities = ["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-02", "2026-08-09", "2026-08-16"].map(day => ({ action: "login.success", details: "pin", createdAt: new Date(`${day}T12:00:00+09:00`) }));
    const state = buildMissionState({ startedAt: new Date("2026-08-01T00:00:00+09:00"), activities, records: [], now: today });
    const mission = (key: string) => state.monthly.missions.find(item => item.key === key)!;
    expect(mission("saturday-3")).toMatchObject({ value: 3, complete: true });
    expect(mission("sunday-3")).toMatchObject({ value: 3, complete: true });
  });
});
