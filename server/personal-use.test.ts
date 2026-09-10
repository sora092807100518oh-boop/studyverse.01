import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { addPersonalClassroomCode, authenticateWithPin, deleteClassroom, getDb, getOrCreateSiteAdmin, removePersonalClassroomCode } from "./db";
import { classrooms } from "../drizzle/schema";

const createdRoomIds: number[] = [];
let code = "";

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  const admin = await getOrCreateSiteAdmin();
  for (const classroomId of createdRoomIds) {
    try { await deleteClassroom(admin.id, classroomId); } catch { /* cleanup should not hide the assertion result */ }
  }
  if (code) { try { await removePersonalClassroomCode(admin.id, code); } catch { /* cleanup */ } }
  if (createdRoomIds.length) await db.delete(classrooms).where(inArray(classrooms.id, createdRoomIds));
}, 60_000);

describe("個人利用コード", () => {
  it("同じコードでも個人識別子ごとに教室・記録空間を分離する", async () => {
    const db = await getDb();
    if (!db) return;
    const admin = await getOrCreateSiteAdmin();
    code = `PERSONAL-${Date.now()}`.slice(0, 32);
    await addPersonalClassroomCode(admin.id, code);
    const first = await authenticateWithPin({ classroomCode: code, pin: "1357", personalClientId: "personal-client-alpha-0001", clientFingerprint: "personal-test-alpha" });
    const second = await authenticateWithPin({ classroomCode: code, pin: "1357", personalClientId: "personal-client-beta-0001", clientFingerprint: "personal-test-beta" });
    const firstAgain = await authenticateWithPin({ classroomCode: code, pin: "1357", personalClientId: "personal-client-alpha-0001", clientFingerprint: "personal-test-alpha-again" });
    createdRoomIds.push(first.classroom.id, second.classroom.id);
    expect(first.classroom.name).toBe("個人利用");
    expect(second.classroom.name).toBe("個人利用");
    expect(first.classroom.id).not.toBe(second.classroom.id);
    expect(firstAgain.classroom.id).toBe(first.classroom.id);
    expect(await db.select().from(classrooms).where(eq(classrooms.code, code))).toHaveLength(0);
  }, 15_000);
});
