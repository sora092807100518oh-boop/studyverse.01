import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { activityLogs, classrooms, focusSessions, monsterEggs, monsterMissionClaims, monsterProfiles, pinSessions, studentProfiles, users } from "../drizzle/schema";
import { createClassroom, createPinAccount, getDb, getMonsterDashboard, getOrCreateSiteAdmin, startNewMonster } from "./db";

const roomIds = new Set<number>();
const userIds = new Set<number>();

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  const ids = [...userIds];
  if (ids.length) {
    await db.delete(monsterMissionClaims).where(inArray(monsterMissionClaims.userId, ids));
    await db.delete(monsterEggs).where(inArray(monsterEggs.userId, ids));
    await db.delete(monsterProfiles).where(inArray(monsterProfiles.userId, ids));
    await db.delete(focusSessions).where(inArray(focusSessions.userId, ids));
    await db.delete(activityLogs).where(inArray(activityLogs.actorUserId, ids));
    await db.delete(pinSessions).where(inArray(pinSessions.userId, ids));
    await db.delete(studentProfiles).where(inArray(studentProfiles.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }
  const rooms = [...roomIds];
  if (rooms.length) await db.delete(classrooms).where(inArray(classrooms.id, rooms));
});

describe("モンスター育成の卵・履歴ワークフロー", () => {
  it("260時間・520時間で卵を獲得し、最終進化後に新しい卵で育成を始められる", async () => {
    const db = await getDb();
    if (!db) return;
    const admin = await getOrCreateSiteAdmin(); const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const room = await createClassroom(admin.id, { code: `MON-${suffix}`.slice(0, 32), name: `モンスター検証 ${suffix}` }); roomIds.add(room.id);
    const learner = await createPinAccount(admin.id, { classroomId: room.id, displayName: "モンスター検証学習者", pin: "1357" }); userIds.add(learner.userId);
    const first = await getMonsterDashboard(learner.userId);
    expect(first.active.progression.stage).toBe(1);
    expect(first.active.eggNumber).toBe("1");

    const now = new Date();
    await db.insert(focusSessions).values({ userId: learner.userId, classroomId: room.id, startedAt: new Date(now.getTime() - 260 * 60 * 60 * 1000), completedAt: now, focusSeconds: 260 * 60 * 60 });
    const at260 = await getMonsterDashboard(learner.userId);
    expect(at260.eggs.some(egg => egg.eggNumber === "2" && !egg.consumedAt)).toBe(true);
    expect(at260.eggs.some(egg => egg.eggNumber === "3")).toBe(false);

    await db.insert(focusSessions).values({ userId: learner.userId, classroomId: room.id, startedAt: new Date(now.getTime() - 520 * 60 * 60 * 1000), completedAt: now, focusSeconds: 260 * 60 * 60 });
    const finalForm = await getMonsterDashboard(learner.userId);
    expect(finalForm.active.progression.stage).toBe(13);
    expect(finalForm.eggs.some(egg => egg.eggNumber === "3" && !egg.consumedAt)).toBe(true);

    await startNewMonster(learner.userId, "2");
    const next = await getMonsterDashboard(learner.userId);
    expect(next.active).toMatchObject({ eggNumber: "2", active: true, progression: { stage: 1 } });
    expect(next.history.some(profile => profile.eggNumber === "1" && !profile.active)).toBe(true);
    expect(next.history.some(profile => profile.eggNumber === "2" && profile.active)).toBe(true);
  }, 20_000);
});
