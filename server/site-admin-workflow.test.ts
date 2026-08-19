import { describe, expect, it } from "vitest";
import { authenticateWithPin, createClassroom, createPinAccount, getDb, getOrCreateSiteAdmin, resetPinForProfile } from "./db";
import { users } from "../drizzle/schema";

describe("独立全体管理者の教室初期設定フロー", () => {
  it("教室作成、オーナーPIN発行、PIN再発行をOAuthなしで実行できる", async () => {
    const admin = await getOrCreateSiteAdmin();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const code = `TEST-${suffix}`.slice(0, 32);
    const room = await createClassroom(admin.id, { code, name: `認証検証教室 ${suffix}` });
    expect(room.id).toBeGreaterThan(0);

    const account = await createPinAccount(admin.id, { classroomId: room.id, displayName: "検証オーナー", pin: "1357", classroomRole: "owner" });
    expect(account.profileId).toBeGreaterThan(0);

    await resetPinForProfile(admin.id, { profileId: account.profileId!, pin: "2468" });
    await expect(authenticateWithPin({ classroomCode: code, pin: "1357", clientFingerprint: `test-${suffix}` })).rejects.toThrow("INVALID_PIN_LOGIN");
    await expect(authenticateWithPin({ classroomCode: code, pin: "2468", clientFingerprint: `test-${suffix}-new` })).resolves.toMatchObject({ classroom: { code } });
  }, 15_000);

  it("教室に所属しない一般利用者の教室作成・PIN操作を拒否する", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const inserted = await db.insert(users).values({ openId: `test-guest:${suffix}`, name: "検証利用者", loginMethod: "test", role: "user" }).$returningId();
    const guestId = inserted[0]?.id;
    if (!guestId) throw new Error("TEST_USER_CREATE_FAILED");
    await expect(createClassroom(guestId, { code: `NO-${suffix}`.slice(0, 32), name: "拒否検証教室" })).rejects.toThrow("GLOBAL_MANAGER_REQUIRED");
    await expect(createPinAccount(guestId, { classroomId: 1, displayName: "拒否対象", pin: "1357" })).rejects.toThrow("CLASSROOM_REQUIRED");
    await expect(resetPinForProfile(guestId, { profileId: 1, pin: "2468" })).rejects.toThrow("CLASSROOM_REQUIRED");
  }, 15_000);
});
