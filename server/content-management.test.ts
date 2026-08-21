import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { activityLogs, announcements, classrooms, focusSessions, journalEntries, pinSessions, recommendedTests, studentProfiles, studyRecords, users, vocabularyWords, wordbooks } from "../drizzle/schema";
import { createAnnouncement, createClassroom, createPinAccount, createRecommendedTest, createWordbook, deleteAnnouncement, deleteRecommendedTest, deleteWordbook, exportWordbookCsv, getDb, getLearningTrend, getOrCreateSiteAdmin, importWordbookCsv, listAnnouncementHistory, listManageableAnnouncements, listManageableRecommendedTests, listManageableWordbooks, listRecommendedTestsForLearner, listReviewWords, listVisibleAnnouncements, previewWordbookCsv, recordFocusSession, recordLearningResult, updateAnnouncement, updateWordbook } from "./db";

const createdClassroomIds = new Set<number>();
const createdUserIds = new Set<number>();

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  const classroomIds = [...createdClassroomIds];
  if (classroomIds.length) {
    const books = await db.select({ id: wordbooks.id }).from(wordbooks).where(inArray(wordbooks.classroomId, classroomIds));
    const bookIds = books.map(book => book.id);
    await db.delete(recommendedTests).where(inArray(recommendedTests.classroomId, classroomIds));
    if (bookIds.length) await db.delete(vocabularyWords).where(inArray(vocabularyWords.wordbookId, bookIds));
    if (bookIds.length) await db.delete(wordbooks).where(inArray(wordbooks.id, bookIds));
    await db.delete(activityLogs).where(inArray(activityLogs.classroomId, classroomIds));
    await db.delete(announcements).where(inArray(announcements.classroomId, classroomIds));
    await db.delete(studyRecords).where(inArray(studyRecords.classroomId, classroomIds));
    await db.delete(focusSessions).where(inArray(focusSessions.classroomId, classroomIds));
    await db.delete(journalEntries).where(inArray(journalEntries.classroomId, classroomIds));
    await db.delete(pinSessions).where(inArray(pinSessions.classroomId, classroomIds));
    await db.delete(studentProfiles).where(inArray(studentProfiles.classroomId, classroomIds));
    await db.delete(classrooms).where(inArray(classrooms.id, classroomIds));
  }
  const userIds = [...createdUserIds];
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe("教材・お知らせ・学習グラフの保存フロー", () => {
  it("CSVプレビューでは形式不備と重複を識別し、有効行だけを教材に保存する", async () => {
    const admin = await getOrCreateSiteAdmin(); const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const room = await createClassroom(admin.id, { code: `CONTENT-${suffix}`.slice(0, 32), name: `教材検証教室 ${suffix}` }); createdClassroomIds.add(room.id);
    const book = await createWordbook(admin.id, { title: "CSV取込教材", subject: "english", visibility: "classroom", classroomId: room.id });
    const learner = await createPinAccount(admin.id, { classroomId: room.id, displayName: "教材閲覧学習者", pin: "1357" }); createdUserIds.add(learner.userId);
    await expect(previewWordbookCsv(learner.userId, { wordbookId: book.id, csvText: "observe,観察する" })).rejects.toThrow("WORD_BOOK_FORBIDDEN");
    await expect(createWordbook(learner.userId, { title: "権限外教材", subject: "english", visibility: "classroom" })).rejects.toThrow("CLASSROOM_MANAGER_REQUIRED");
    await expect(updateWordbook(learner.userId, book.id, { title: "権限外更新" })).rejects.toThrow("WORD_BOOK_FORBIDDEN");
    await expect(deleteWordbook(learner.userId, book.id)).rejects.toThrow("WORD_BOOK_FORBIDDEN");
    await expect(createAnnouncement(learner.userId, { title: "権限外配信", body: "この操作は拒否される必要があります。", visibility: "classroom" })).rejects.toThrow("CLASSROOM_MANAGER_REQUIRED");
    const protectedAnnouncement = await createAnnouncement(admin.id, { title: "権限確認用お知らせ", body: "管理者のみ更新・削除できます。", visibility: "classroom", classroomId: room.id });
    await expect(updateAnnouncement(learner.userId, protectedAnnouncement.id, { title: "権限外更新" })).rejects.toThrow("CLASSROOM_MANAGER_REQUIRED");
    await expect(deleteAnnouncement(learner.userId, protectedAnnouncement.id)).rejects.toThrow("CLASSROOM_MANAGER_REQUIRED");
    await deleteAnnouncement(admin.id, protectedAnnouncement.id);
    const preview = await previewWordbookCsv(admin.id, { wordbookId: book.id, csvText: "observe,観察する\nobserve,観察する\n,欠損" });
    expect(preview).toMatchObject({ validCount: 1, duplicateCount: 1, invalidCount: 1 });
    await expect(importWordbookCsv(admin.id, { wordbookId: book.id, csvText: "observe,観察する\n,欠損" })).rejects.toThrow("CSV_INVALID_ROWS");
    const imported = await importWordbookCsv(admin.id, { wordbookId: book.id, csvText: "observe,観察する\nobserve,観察する\nretain,保持する" });
    expect(imported).toEqual({ importedCount: 2, skippedCount: 1 });
    const managed = await listManageableWordbooks(admin.id);
    expect(managed.find(item => item.id === book.id)?.wordCount).toBe(2);
    await deleteWordbook(admin.id, book.id);
    expect((await listManageableWordbooks(admin.id)).find(item => item.id === book.id)).toBeUndefined();
  }, 30_000);

  it("教室お知らせは作成・更新・削除でき、期間別学習集計は保存済み記録を返す", async () => {
    const admin = await getOrCreateSiteAdmin(); const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const room = await createClassroom(admin.id, { code: `NOTICE-${suffix}`.slice(0, 32), name: `配信検証教室 ${suffix}` }); createdClassroomIds.add(room.id);
    const account = await createPinAccount(admin.id, { classroomId: room.id, displayName: "集計用学習者", pin: "2468" }); createdUserIds.add(account.userId);
    const announcement = await createAnnouncement(admin.id, { title: "学習のお知らせ", body: "今週の目標を確認しましょう。", visibility: "classroom", classroomId: room.id });
    await updateAnnouncement(admin.id, announcement.id, { title: "更新済みお知らせ", body: "学習記録を見返しましょう。" });
    expect((await listManageableAnnouncements(admin.id)).find(item => item.id === announcement.id)?.title).toBe("更新済みお知らせ");
    const historyAfterUpdate = await listAnnouncementHistory(admin.id);
    expect(historyAfterUpdate.filter(item => item.details === "学習のお知らせ" || item.details === "更新済みお知らせ").map(item => item.action)).toEqual(expect.arrayContaining(["announcement.created", "announcement.updated"]));
    const scheduled = await createAnnouncement(admin.id, { title: "予約中お知らせ", body: "指定時刻まで公開されません。", visibility: "classroom", classroomId: room.id, scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    expect((await listVisibleAnnouncements(account.userId)).some(item => item.id === scheduled.id)).toBe(false);
    await updateAnnouncement(admin.id, scheduled.id, { scheduledAt: new Date(Date.now() - 60_000) });
    expect((await listVisibleAnnouncements(account.userId)).some(item => item.id === scheduled.id)).toBe(true);
    await recordFocusSession(account.userId, { startedAt: new Date(Date.now() - 20 * 60 * 1000), completedAt: new Date(), focusSeconds: 20 * 60 });
    await recordLearningResult(account.userId, { mode: "practice", isCorrect: true });
    await recordLearningResult(account.userId, { mode: "test", isCorrect: false });
    const trend = await getLearningTrend(account.userId, "day");
    expect(trend).toHaveLength(7);
    expect(trend.some(point => point.focusMinutes === 20 && point.answers === 2 && point.accuracy === 50)).toBe(true);
    await deleteAnnouncement(admin.id, announcement.id);
    await deleteAnnouncement(admin.id, scheduled.id);
    expect((await listManageableAnnouncements(admin.id)).find(item => item.id === announcement.id)).toBeUndefined();
    expect((await listAnnouncementHistory(admin.id)).some(item => item.action === "announcement.deleted" && item.details === "更新済みお知らせ")).toBe(true);
  }, 15_000);

  it("単語帳の範囲をおすすめテストとして配信し、同じ教室の学習者だけが受け取る", async () => {
    const admin = await getOrCreateSiteAdmin(); const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const room = await createClassroom(admin.id, { code: `ASSIGN-${suffix}`.slice(0, 32), name: `出題配信教室 ${suffix}` }); createdClassroomIds.add(room.id);
    const otherRoom = await createClassroom(admin.id, { code: `OTHER-${suffix}`.slice(0, 32), name: `別教室 ${suffix}` }); createdClassroomIds.add(otherRoom.id);
    const learner = await createPinAccount(admin.id, { classroomId: room.id, displayName: "配信対象学習者", pin: "1357" }); createdUserIds.add(learner.userId);
    const otherLearner = await createPinAccount(admin.id, { classroomId: otherRoom.id, displayName: "配信対象外学習者", pin: "2468" }); createdUserIds.add(otherLearner.userId);
    const book = await createWordbook(admin.id, { title: "範囲指定教材", subject: "english", visibility: "classroom", classroomId: room.id });
    await importWordbookCsv(admin.id, { wordbookId: book.id, csvText: "alpha,最初\nbeta,次\ngamma,三番目" });
    const exported = await exportWordbookCsv(admin.id, book.id); expect(exported.words).toHaveLength(3); expect(exported.words[0].front).toBe("alpha");
    await expect(createRecommendedTest(admin.id, { wordbookId: book.id, rangeStart: 1, rangeEnd: 4, questionCount: 2, classroomId: room.id })).rejects.toThrow("TEST_RANGE_INVALID");
    const assignment = await createRecommendedTest(admin.id, { wordbookId: book.id, rangeStart: 2, rangeEnd: 3, questionCount: 2, classroomId: room.id });
    const learnerAssignments = await listRecommendedTestsForLearner(learner.userId); expect(learnerAssignments.find(item => item.id === assignment.id)).toMatchObject({ wordbookTitle: "範囲指定教材", rangeStart: 2, rangeEnd: 3, questionCount: 2 }); expect(learnerAssignments.find(item => item.id === assignment.id)?.words.map(word => word.front)).toEqual(["beta", "gamma"]);
    expect((await listRecommendedTestsForLearner(otherLearner.userId)).some(item => item.id === assignment.id)).toBe(false); expect((await listManageableRecommendedTests(admin.id)).some(item => item.id === assignment.id)).toBe(true);
    const db = await getDb(); const words = await db!.select().from(vocabularyWords).where(eq(vocabularyWords.wordbookId, book.id)).orderBy(vocabularyWords.id);
    await recordLearningResult(learner.userId, { wordId: words[0].id, mode: "practice", isCorrect: false }); expect((await listReviewWords(learner.userId)).map(word => word.id)).toContain(words[0].id);
    await recordLearningResult(learner.userId, { wordId: words[0].id, mode: "practice", isCorrect: true }); expect((await listReviewWords(learner.userId)).map(word => word.id)).not.toContain(words[0].id);
    await deleteRecommendedTest(admin.id, assignment.id); expect((await listManageableRecommendedTests(admin.id)).some(item => item.id === assignment.id)).toBe(false);
  }, 20_000);
});
