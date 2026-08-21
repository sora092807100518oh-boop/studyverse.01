import { describe, expect, it } from "vitest";
import { authenticateWithPin, createClassroom, createPinAccount, getDb, getManagementInsights, getOrCreateSiteAdmin, recordLearningResult, resetPinForProfile, resetRevivalTickets } from "./db";
import { activityLogs, classrooms, focusSessions, pinSessions, studentProfiles, studyRecords, users } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll } from "vitest";

const createdRoomIds = new Set<number>();
const createdUserIds = new Set<number>();

afterAll(async () => {
  const db = await getDb();
  if (!db) return;

  const roomIds = [...createdRoomIds];
  if (roomIds.length) {
    await db.delete(activityLogs).where(inArray(activityLogs.classroomId, roomIds));
    await db.delete(studyRecords).where(inArray(studyRecords.classroomId, roomIds));
    await db.delete(focusSessions).where(inArray(focusSessions.classroomId, roomIds));
    await db.delete(pinSessions).where(inArray(pinSessions.classroomId, roomIds));
    await db.delete(studentProfiles).where(inArray(studentProfiles.classroomId, roomIds));
    await db.delete(classrooms).where(inArray(classrooms.id, roomIds));
  }

  const userIds = [...createdUserIds];
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe("独立全体管理者の教室初期設定フロー", () => {
  it("教室作成、オーナーPIN発行、PIN再発行をOAuthなしで実行できる", async () => {
    const admin = await getOrCreateSiteAdmin();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const code = `TEST-${suffix}`.slice(0, 32);
    const room = await createClassroom(admin.id, { code, name: `認証検証教室 ${suffix}` });
    createdRoomIds.add(room.id);
    expect(room.id).toBeGreaterThan(0);

    const account = await createPinAccount(admin.id, { classroomId: room.id, displayName: "検証オーナー", pin: "1357", classroomRole: "owner" });
    createdUserIds.add(account.userId);
    expect(account.profileId).toBeGreaterThan(0);

    await resetPinForProfile(admin.id, { profileId: account.profileId!, pin: "2468" });
    const autoJoined = await authenticateWithPin({ classroomCode: code, pin: "1357", clientFingerprint: `test-${suffix}` });
    const owner = await authenticateWithPin({ classroomCode: code, pin: "2468", clientFingerprint: `test-${suffix}-new` });
    createdUserIds.add(autoJoined.profile.userId);
    expect(autoJoined.profile.userId).not.toBe(account.userId);
    expect(owner.profile.userId).toBe(account.userId);
    expect(owner.classroom).toMatchObject({ code });
  }, 15_000);

  it("教室に所属しない一般利用者の教室作成・PIN操作を拒否する", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const inserted = await db.insert(users).values({ openId: `test-guest:${suffix}`, name: "検証利用者", loginMethod: "test", role: "user" }).$returningId();
    const guestId = inserted[0]?.id;
    if (!guestId) throw new Error("TEST_USER_CREATE_FAILED");
    createdUserIds.add(guestId);
    await expect(createClassroom(guestId, { code: `NO-${suffix}`.slice(0, 32), name: "拒否検証教室" })).rejects.toThrow("GLOBAL_MANAGER_REQUIRED");
    const admin = await getOrCreateSiteAdmin(); const room = await createClassroom(admin.id, { code: `DENY-${suffix}`.slice(0, 32), name: "権限検証教室" }); createdRoomIds.add(room.id);
    const target = await createPinAccount(admin.id, { classroomId: room.id, displayName: "拒否対象", pin: "1357" });
    createdUserIds.add(target.userId);
    await expect(createPinAccount(guestId, { classroomId: room.id, displayName: "不正作成", pin: "8642" })).rejects.toThrow("CLASSROOM_REQUIRED");
    await expect(resetPinForProfile(guestId, { profileId: target.profileId!, pin: "2468" })).rejects.toThrow("CLASSROOM_REQUIRED");
  }, 15_000);

  it("事前登録なしの新しいPINは初回ログイン時に学習者として自動作成される", async () => {
    const admin = await getOrCreateSiteAdmin();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const code = `AUTO-${suffix}`.slice(0, 32);
    const room = await createClassroom(admin.id, { code, name: `自動参加教室 ${suffix}` });
    createdRoomIds.add(room.id);
    const first = await authenticateWithPin({ classroomCode: code, pin: "6042", clientFingerprint: `auto-${suffix}` });
    const second = await authenticateWithPin({ classroomCode: code, pin: "6042", clientFingerprint: `auto-${suffix}-again` });
    createdUserIds.add(first.profile.userId);
    expect(first.profile.classroomRole).toBe("student");
    expect(first.profile.userId).toBe(second.profile.userId);
    expect(first.profile.displayName).toMatch(/^学習者 \d+$/);
  }, 15_000);

  it("全体管理者は利用者の復活チケットを2枚へ補充できる", async () => {
    const admin = await getOrCreateSiteAdmin(); const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const room = await createClassroom(admin.id, { code: `TICKET-${suffix}`.slice(0, 32), name: `チケット補充検証 ${suffix}` });
    createdRoomIds.add(room.id);
    const learner = await createPinAccount(admin.id, { classroomId: room.id, displayName: "チケット対象", pin: "1357" });
    createdUserIds.add(learner.userId);
    const db = await getDb();
    await db!.update(studentProfiles).set({ revivalTickets: 0 }).where(eq(studentProfiles.id, learner.profileId!));
    await expect(resetRevivalTickets(admin.id, learner.profileId!)).resolves.toEqual({ revivalTickets: 2 });
    const profile = (await db!.select({ revivalTickets: studentProfiles.revivalTickets }).from(studentProfiles).where(eq(studentProfiles.id, learner.profileId!)).limit(1))[0];
    expect(profile?.revivalTickets).toBe(2);
  }, 15_000);

  it("カード練習・テストの正誤履歴を保存し、管理記録から確認できる", async () => {
    const admin = await getOrCreateSiteAdmin(); const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`; const code = `TRACE-${suffix}`.slice(0, 32);
    const room = await createClassroom(admin.id, { code, name: `記録検証教室 ${suffix}` }); createdRoomIds.add(room.id);
    const learner = await authenticateWithPin({ classroomCode: code, pin: "7391", clientFingerprint: `trace-${suffix}` });
    createdUserIds.add(learner.profile.userId);
    await recordLearningResult(learner.profile.userId, { mode: "practice", isCorrect: true });
    await recordLearningResult(learner.profile.userId, { mode: "test", isCorrect: false });
    const insights = await getManagementInsights(admin.id);
    expect(insights.answers).toBeGreaterThanOrEqual(2);
    expect(insights.recentActivities.some(item => item.action === "answer.practice" && item.details === "correct")).toBe(true);
    expect(insights.recentActivities.some(item => item.action === "answer.test" && item.details === "review")).toBe(true);
  }, 15_000);
});
