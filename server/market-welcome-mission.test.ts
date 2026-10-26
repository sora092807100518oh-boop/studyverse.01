import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { claimMonsterMission, getDb, getMarketCoinWallet, getMonsterDashboard } from "./db";
import { activityLogs, marketCoinTransactions, monsterEggs, monsterMissionClaims, monsterProfiles, users } from "../drizzle/schema";

let userId: number | null = null;

afterAll(async () => {
  if (!userId) return;
  const db = await getDb();
  if (!db) return;
  await db.delete(marketCoinTransactions).where(eq(marketCoinTransactions.userId, userId));
  await db.delete(monsterMissionClaims).where(eq(monsterMissionClaims.userId, userId));
  await db.delete(monsterEggs).where(eq(monsterEggs.userId, userId));
  await db.delete(monsterProfiles).where(eq(monsterProfiles.userId, userId));
  await db.delete(activityLogs).where(eq(activityLogs.actorUserId, userId));
  await db.delete(users).where(eq(users.id, userId));
}, 60_000);

describe("初回ログインのマーケットコイン報酬", () => {
  it("ノーマルミッションの受取で200コインを一度だけ加算する", async () => {
    const db = await getDb();
    if (!db) return;
    const inserted = await db.insert(users).values({ openId: `welcome-mission-test:${Date.now()}`, name: "初回ログイン利用者", loginMethod: "test" }).$returningId();
    userId = inserted[0]?.id ?? null;
    if (!userId) throw new Error("ACCOUNT_CREATE_FAILED");
    await db.insert(activityLogs).values({ actorUserId: userId, category: "learning", action: "login.success", details: "test" });

    const dashboard = await getMonsterDashboard(userId);
    expect(dashboard.mission.claimable).toEqual(expect.arrayContaining([expect.objectContaining({ missionKey: "normal.first-login", periodKey: "lifetime", coins: 200, points: 0 })]));
    await expect(claimMonsterMission(userId, "normal.first-login", "lifetime")).resolves.toMatchObject({ coins: 200, points: 0 });
    expect(await getMarketCoinWallet(userId)).toEqual({ balance: 200 });
    await expect(claimMonsterMission(userId, "normal.first-login", "lifetime")).rejects.toThrow("MONSTER_MISSION_ALREADY_CLAIMED");
    expect(await db.select().from(marketCoinTransactions).where(eq(marketCoinTransactions.userId, userId))).toHaveLength(1);
  }, 30_000);
});
