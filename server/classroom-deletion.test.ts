import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { announcements, classrooms, pinSessions, recommendedTests, studentProfiles, users, vocabularyWords, wordbooks } from "../drizzle/schema";
import { authenticateWithPin, createAnnouncement, createClassroom, createPinAccount, createRecommendedTest, createWordbook, deleteClassroom, getDb, getOrCreateSiteAdmin, importWordbookCsv } from "./db";

describe("全体管理の教室削除", () => {
  it("全体管理者だけが教室と教室に紐づく利用者・教材・配信を削除できる", async () => {
    const db = await getDb();
    if (!db) return;
    const admin = await getOrCreateSiteAdmin();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const classroomCode = `DEL-${suffix}`.slice(0, 32);
    const room = await createClassroom(admin.id, { code: classroomCode, name: `削除検証教室 ${suffix}` });
    const learner = await createPinAccount(admin.id, { classroomId: room.id, displayName: "削除対象学習者", pin: "1357" });
    const book = await createWordbook(admin.id, { title: "削除対象教材", subject: "english", visibility: "classroom", classroomId: room.id });
    await importWordbookCsv(admin.id, { wordbookId: book.id, csvText: "alpha,最初\nbeta,次" });
    await createAnnouncement(admin.id, { title: "削除対象お知らせ", body: "削除対象", visibility: "classroom", classroomId: room.id });
    await createRecommendedTest(admin.id, { wordbookId: book.id, rangeStart: 1, rangeEnd: 2, questionCount: 2, classroomId: room.id });
    await authenticateWithPin({ classroomCode, pin: "1357", clientFingerprint: `delete-test-${suffix}` });

    await expect(deleteClassroom(learner.userId, room.id)).rejects.toThrow("GLOBAL_MANAGER_REQUIRED");
    const result = await deleteClassroom(admin.id, room.id);

    expect(result).toMatchObject({ deletedClassroomId: room.id, deletedMemberCount: 1, deletedWordbookCount: 1 });
    expect(await db.select().from(classrooms).where(eq(classrooms.id, room.id))).toHaveLength(0);
    expect(await db.select().from(studentProfiles).where(eq(studentProfiles.classroomId, room.id))).toHaveLength(0);
    expect(await db.select().from(pinSessions).where(eq(pinSessions.classroomId, room.id))).toHaveLength(0);
    expect(await db.select().from(wordbooks).where(eq(wordbooks.id, book.id))).toHaveLength(0);
    expect(await db.select().from(vocabularyWords).where(eq(vocabularyWords.wordbookId, book.id))).toHaveLength(0);
    expect(await db.select().from(announcements).where(eq(announcements.classroomId, room.id))).toHaveLength(0);
    expect(await db.select().from(recommendedTests).where(eq(recommendedTests.classroomId, room.id))).toHaveLength(0);
    expect(await db.select().from(users).where(and(eq(users.id, learner.userId), eq(users.loginMethod, "pin")))).toHaveLength(0);
  }, 30_000);
});
