import { and, desc, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { classrooms, focusSessions, InsertUser, studentProfiles, studyRecords, users, vocabularyWords, wordbooks } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ profile: studentProfiles, classroom: classrooms }).from(studentProfiles).innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id)).where(eq(studentProfiles.userId, userId)).limit(1);
  return rows[0];
}

export async function listVisibleWordbooks(userId: number, subject?: "english" | "kanji") {
  const db = await getDb();
  if (!db) return [];
  const membership = await getProfile(userId);
  const visibility = membership
    ? or(eq(wordbooks.visibility, "global"), eq(wordbooks.ownerUserId, userId), and(eq(wordbooks.visibility, "classroom"), eq(wordbooks.classroomId, membership.profile.classroomId)))
    : or(eq(wordbooks.visibility, "global"), eq(wordbooks.ownerUserId, userId));
  const rows = await db.select().from(wordbooks).where(subject ? and(visibility, eq(wordbooks.subject, subject)) : visibility).orderBy(desc(wordbooks.updatedAt));
  return Promise.all(rows.map(async book => {
    const words = await db.select().from(vocabularyWords).where(eq(vocabularyWords.wordbookId, book.id));
    return { ...book, wordCount: words.length, words };
  }));
}

export async function createWordbook(userId: number, input: { title: string; subject: "english" | "kanji"; visibility: "private" | "classroom" }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  const inserted = await db.insert(wordbooks).values({ title: input.title, subject: input.subject, visibility: input.visibility, ownerUserId: userId, classroomId: profile.profile.classroomId }).$returningId();
  return inserted[0];
}

export async function addWordToWordbook(userId: number, input: { wordbookId: number; front: string; back: string; reading?: string; source?: "manual" | "csv" | "admin" }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const book = await db.select().from(wordbooks).where(eq(wordbooks.id, input.wordbookId)).limit(1);
  if (!book[0] || book[0].ownerUserId !== userId) throw new Error("WORD_BOOK_FORBIDDEN");
  const inserted = await db.insert(vocabularyWords).values({ wordbookId: input.wordbookId, front: input.front, back: input.back, reading: input.reading ?? null, source: input.source ?? "manual" }).$returningId();
  return inserted[0];
}

export async function recordLearningResult(userId: number, input: { wordId?: number; mode: "practice" | "test" | "journal" | "ai_select"; isCorrect: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  await db.insert(studyRecords).values({ userId, classroomId: profile.profile.classroomId, wordId: input.wordId ?? null, mode: input.mode, isCorrect: input.isCorrect });
}

export async function recordFocusSession(userId: number, input: { startedAt: Date; completedAt: Date; focusSeconds: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  await db.insert(focusSessions).values({ userId, classroomId: profile.profile.classroomId, ...input });
}

export async function getLearningSummary(userId: number) {
  const db = await getDb();
  if (!db) return { totalFocusSeconds: 0, retention: 0, streak: 0, records: 0 };
  const [sessions, records] = await Promise.all([
    db.select().from(focusSessions).where(eq(focusSessions.userId, userId)),
    db.select().from(studyRecords).where(eq(studyRecords.userId, userId)).orderBy(desc(studyRecords.answeredAt)).limit(120),
  ]);
  const totalFocusSeconds = sessions.reduce((sum, session) => sum + session.focusSeconds, 0);
  const retention = records.length ? Math.round((records.filter(record => record.isCorrect).length / records.length) * 100) : 0;
  const activeDays = new Set(records.map(record => record.answeredAt.toISOString().slice(0, 10)));
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) { const date = new Date(); date.setUTCDate(date.getUTCDate() - offset); if (activeDays.has(date.toISOString().slice(0, 10))) streak += 1; else if (offset > 0) break; }
  return { totalFocusSeconds, retention, streak, records: records.length };
}
