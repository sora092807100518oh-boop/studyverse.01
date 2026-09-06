import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { activityLogs, classrooms, focusSessions, pinSessions, recommendedTestClaims, recommendedTests, studentProfiles, studyRecords, vocabularyWords, wordbooks, users } from "../drizzle/schema";
import { claimAnnouncementRecommendedTest, createClassroom, createPinAccount, createRecommendedTest, createWordbook, getDb, getOrCreateSiteAdmin, importWordbookCsv, listAnnouncementRecommendedTests, listManageableWordbooks, listRecommendedTestsForLearner, listVisibleWordbooks, updateVocabularyWord } from "./db";

const classroomIds = new Set<number>();
const userIds = new Set<number>();

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  const rooms = [...classroomIds];
  if (rooms.length) {
    const tests = await db.select({ id: recommendedTests.id }).from(recommendedTests).where(inArray(recommendedTests.classroomId, rooms));
    const testIds = tests.map(test => test.id);
    if (testIds.length) await db.delete(recommendedTestClaims).where(inArray(recommendedTestClaims.recommendedTestId, testIds));
    if (testIds.length) await db.delete(recommendedTests).where(inArray(recommendedTests.id, testIds));
    const books = await db.select({ id: wordbooks.id }).from(wordbooks).where(inArray(wordbooks.classroomId, rooms));
    const bookIds = books.map(book => book.id);
    if (bookIds.length) await db.delete(vocabularyWords).where(inArray(vocabularyWords.wordbookId, bookIds));
    if (bookIds.length) await db.delete(wordbooks).where(inArray(wordbooks.id, bookIds));
    await db.delete(activityLogs).where(inArray(activityLogs.classroomId, rooms));
    await db.delete(studyRecords).where(inArray(studyRecords.classroomId, rooms));
    await db.delete(focusSessions).where(inArray(focusSessions.classroomId, rooms));
    await db.delete(pinSessions).where(inArray(pinSessions.classroomId, rooms));
    await db.delete(studentProfiles).where(inArray(studentProfiles.classroomId, rooms));
    await db.delete(classrooms).where(inArray(classrooms.id, rooms));
  }
  const learners = [...userIds];
  if (learners.length) await db.delete(users).where(inArray(users.id, learners));
});

describe("お知らせ教材の受取と単語詳細", () => {
  it("期限付きお知らせを一覧表示し、受取後は自分の単語帳として利用できる", async () => {
    const admin = await getOrCreateSiteAdmin();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const classroom = await createClassroom(admin.id, { code: `CLAIM-${suffix}`.slice(0, 32), name: `受取検証教室 ${suffix}` });
    classroomIds.add(classroom.id);
    const learner = await createPinAccount(admin.id, { classroomId: classroom.id, displayName: "受取検証学習者", pin: "1357" });
    userIds.add(learner.userId);
    const book = await createWordbook(admin.id, { title: "詳細付きお知らせ教材", subject: "english", visibility: "classroom", classroomId: classroom.id });
    await importWordbookCsv(admin.id, { wordbookId: book.id, csvText: "apple,りんご,アップル\nbook,本,ブック\ncat,猫,キャット" });
    const normal = await createRecommendedTest(admin.id, { wordbookId: book.id, rangeStart: 1, rangeEnd: 1, questionCount: 1, deliveryMode: "normal", classroomId: classroom.id });
    const wordbookDelivery = await createRecommendedTest(admin.id, { wordbookId: book.id, rangeStart: 1, rangeEnd: 3, questionCount: 3, deliveryType: "wordbook", deliveryMode: "normal", classroomId: classroom.id });
    await expect(createRecommendedTest(admin.id, { wordbookId: book.id, rangeStart: 1, rangeEnd: 2, questionCount: 2, deliveryMode: "announcement", classroomId: classroom.id, availableFrom: new Date(Date.now() + 60_000), availableUntil: new Date(Date.now() - 60_000) })).rejects.toThrow("TEST_PERIOD_INVALID");
    const announcement = await createRecommendedTest(admin.id, { wordbookId: book.id, rangeStart: 1, rangeEnd: 2, questionCount: 2, deliveryMode: "announcement", classroomId: classroom.id, availableFrom: new Date(Date.now() - 60_000), availableUntil: new Date(Date.now() + 60 * 60 * 1000) });

    expect((await listRecommendedTestsForLearner(learner.userId)).map(item => item.id)).toContain(normal.id);
    expect((await listRecommendedTestsForLearner(learner.userId)).find(item => item.id === wordbookDelivery.id)).toMatchObject({ deliveryType: "wordbook", claimed: false, receivedWordbookId: null });
    expect((await listRecommendedTestsForLearner(learner.userId)).map(item => item.id)).not.toContain(announcement.id);
    const before = await listAnnouncementRecommendedTests(learner.userId);
    expect(before.find(item => item.id === announcement.id)).toMatchObject({ claimed: false, receivedWordbookId: null, rangeStart: 1, rangeEnd: 2 });

    const firstClaim = await claimAnnouncementRecommendedTest(learner.userId, announcement.id);
    expect(firstClaim.alreadyClaimed).toBe(false);
    const secondClaim = await claimAnnouncementRecommendedTest(learner.userId, announcement.id);
    expect(secondClaim).toEqual({ ...firstClaim, alreadyClaimed: true });
    expect((await listAnnouncementRecommendedTests(learner.userId)).find(item => item.id === announcement.id)).toMatchObject({ claimed: true, receivedWordbookId: firstClaim.receivedWordbookId });

    const received = (await listVisibleWordbooks(learner.userId)).find(item => item.id === firstClaim.receivedWordbookId);
    expect(received).toMatchObject({ title: "詳細付きお知らせ教材（受取）", canEdit: true, wordCount: 2 });
    expect(received?.words.map(word => word.front)).toEqual(["apple", "book"]);

    const sourceWords = await dbWords(book.id);
    await updateVocabularyWord(admin.id, sourceWords[0]!.id, { imageUrl: "https://example.com/apple.png", exampleSentence: "I eat an apple.", exampleTranslation: "私はりんごを食べます。" });
    const managed = (await listManageableWordbooks(admin.id)).find(item => item.id === book.id);
    expect(managed?.words[0]).toMatchObject({ imageUrl: "https://example.com/apple.png", exampleSentence: "I eat an apple.", exampleTranslation: "私はりんごを食べます。" });
  }, 35_000);
});

async function dbWords(wordbookId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.select().from(vocabularyWords).where(eq(vocabularyWords.wordbookId, wordbookId)).orderBy(vocabularyWords.id);
}
