import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { classrooms, pinSessions, practiceResumes, studentProfiles, users, vocabularyWords, wordbooks } from "../drizzle/schema";
import { clearPracticeResume, createClassroom, createPinAccount, createWordbook, getDb, getOrCreateSiteAdmin, getPracticeResume, importWordbookCsv, savePracticeResume } from "./db";

const classroomIds = new Set<number>();
const userIds = new Set<number>();

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  const rooms = [...classroomIds];
  if (rooms.length) {
    const profiles = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(inArray(studentProfiles.classroomId, rooms));
    const members = profiles.map(profile => profile.userId);
    const books = await db.select({ id: wordbooks.id }).from(wordbooks).where(inArray(wordbooks.classroomId, rooms));
    if (books.length) await db.delete(vocabularyWords).where(inArray(vocabularyWords.wordbookId, books.map(book => book.id)));
    if (books.length) await db.delete(wordbooks).where(inArray(wordbooks.id, books.map(book => book.id)));
    if (members.length) await db.delete(practiceResumes).where(inArray(practiceResumes.userId, members));
    await db.delete(pinSessions).where(inArray(pinSessions.classroomId, rooms));
    await db.delete(studentProfiles).where(inArray(studentProfiles.classroomId, rooms));
    await db.delete(classrooms).where(inArray(classrooms.id, rooms));
  }
  const members = [...userIds];
  if (members.length) await db.delete(users).where(inArray(users.id, members));
});

describe("PIN利用者の途中練習保存", () => {
  it("練習の保存、途中位置の更新、更新後の復元、完了時の削除を行う", async () => {
    const admin = await getOrCreateSiteAdmin(); const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const room = await createClassroom(admin.id, { code: `RESUME-${suffix}`.slice(0, 32), name: `途中再開検証 ${suffix}` }); classroomIds.add(room.id);
    const learner = await createPinAccount(admin.id, { classroomId: room.id, displayName: "再開検証利用者", pin: "1357" }); userIds.add(learner.userId);
    const book = await createWordbook(learner.userId, { title: "再開検証単語帳", subject: "english", visibility: "private" });
    await importWordbookCsv(learner.userId, { wordbookId: book.id, csvText: "alpha,最初\nbeta,次\ngamma,三番目" });
    const db = await getDb(); if (!db) return;
    const words = await db.select({ id: vocabularyWords.id }).from(vocabularyWords).where(eq(vocabularyWords.wordbookId, book.id)); const ids = words.map(word => word.id);
    await savePracticeResume(learner.userId, { subject: "english", wordIds: ids, currentIndex: 0, knownCount: 0, reviewCount: 0, missedWordIds: [], cardOrder: "normal", wordPool: "normal" });
    expect(await getPracticeResume(learner.userId)).toMatchObject({ subject: "英単語", index: 0, result: { known: 0, review: 0 } });
    await savePracticeResume(learner.userId, { subject: "english", wordIds: ids, currentIndex: 2, knownCount: 1, reviewCount: 1, missedWordIds: [ids[1]!], cardOrder: "random", wordPool: "mistakes" });
    expect(await getPracticeResume(learner.userId)).toMatchObject({ index: 2, result: { known: 1, review: 1 }, order: "random", pool: "mistakes", missedWords: [{ id: ids[1] }] });
    await clearPracticeResume(learner.userId);
    await expect(getPracticeResume(learner.userId)).resolves.toBeNull();
  }, 30_000);
});
