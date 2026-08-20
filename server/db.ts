import { and, desc, eq, gt, gte, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { activityLogs, announcements, calendarEvents, classrooms, focusSessions, InsertUser, journalEntries, pinLoginAttempts, pinSessions, siteAdminSessions, studentProfiles, studyRecords, users, vocabularyWords, wordbooks } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { createSessionToken, getAttemptKeyHash, getPinLookupHash, getSessionTokenHash, hashPin, verifyPin } from "./pin-auth";
import { canManageClassroom, canPublishGlobally } from "./classroom-permissions";
import { createSiteAdminSessionToken, getSiteAdminSessionTokenHash } from "./site-admin-auth";

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

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

const SITE_ADMIN_OPEN_ID = "site-admin";
const SITE_ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 8;

export async function getOrCreateSiteAdmin() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(users).values({ openId: SITE_ADMIN_OPEN_ID, name: "全体管理者", loginMethod: "site-password", role: "admin", lastSignedIn: new Date() }).onDuplicateKeyUpdate({ set: { role: "admin", lastSignedIn: new Date() } });
  const user = await getUserByOpenId(SITE_ADMIN_OPEN_ID);
  if (!user) throw new Error("SITE_ADMIN_UNAVAILABLE");
  return user;
}

export async function createSiteAdminSession() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const user = await getOrCreateSiteAdmin();
  const token = createSiteAdminSessionToken();
  const expiresAt = new Date(Date.now() + SITE_ADMIN_SESSION_TTL_MS);
  await db.insert(siteAdminSessions).values({ tokenHash: getSiteAdminSessionTokenHash(token), userId: user.id, expiresAt });
  return { token, expiresAt, user };
}

export async function getSiteAdminSession(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ session: siteAdminSessions, user: users }).from(siteAdminSessions).innerJoin(users, eq(siteAdminSessions.userId, users.id)).where(and(eq(siteAdminSessions.tokenHash, getSiteAdminSessionTokenHash(token)), isNull(siteAdminSessions.revokedAt), gt(siteAdminSessions.expiresAt, new Date()))).limit(1);
  if (rows[0]) await db.update(siteAdminSessions).set({ lastSeenAt: new Date() }).where(eq(siteAdminSessions.id, rows[0].session.id));
  return rows[0];
}

export async function revokeSiteAdminSession(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(siteAdminSessions).set({ revokedAt: new Date() }).where(eq(siteAdminSessions.tokenHash, getSiteAdminSessionTokenHash(token)));
}

export async function getProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ profile: studentProfiles, classroom: classrooms }).from(studentProfiles).innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id)).where(eq(studentProfiles.userId, userId)).limit(1);
  return rows[0];
}

const PIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const PIN_ATTEMPT_WINDOW_MS = 1000 * 60 * 15;
const MAX_PIN_ATTEMPTS = 5;

function getPinPepper() { return ENV.cookieSecret; }

async function writeActivity(input: { actorUserId: number; classroomId?: number; category: "classroom" | "member" | "learning" | "journal"; action: string; details?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values({ actorUserId: input.actorUserId, classroomId: input.classroomId ?? null, category: input.category, action: input.action, details: input.details ?? null });
}

export async function createPinAccount(actorUserId: number, input: { classroomId: number; displayName: string; pin: string; classroomRole?: "student" | "teacher" | "owner" }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, actorUserId)).limit(1);
  const membership = await getProfile(actorUserId);
  const permissionInput = { siteRole: account[0]?.role, classroomRole: membership?.profile.classroomRole, actorClassroomId: membership?.profile.classroomId, targetClassroomId: input.classroomId } as const;
  if (!membership && account[0]?.role !== "admin") throw new Error("CLASSROOM_REQUIRED");
  if (!canManageClassroom(permissionInput)) throw new Error("CLASSROOM_MANAGER_REQUIRED");
  if (!canPublishGlobally(permissionInput) && input.classroomRole && input.classroomRole !== "student") throw new Error("GLOBAL_MANAGER_REQUIRED");
  const classroom = await db.select().from(classrooms).where(eq(classrooms.id, input.classroomId)).limit(1);
  if (!classroom[0]) throw new Error("CLASSROOM_NOT_FOUND");
  const pinHash = await hashPin(input.pin);
  const pinLookupHash = getPinLookupHash(input.classroomId, input.pin, getPinPepper());
  const createdUser = await db.insert(users).values({ openId: `pin:${classroom[0].code}:${randomUUID()}`, name: input.displayName, loginMethod: "pin", role: "user" }).$returningId();
  const userId = createdUser[0]?.id;
  if (!userId) throw new Error("ACCOUNT_CREATE_FAILED");
  try {
    const created = await db.insert(studentProfiles).values({ userId, classroomId: input.classroomId, pinHash, pinLookupHash, displayName: input.displayName, classroomRole: input.classroomRole ?? "student" }).$returningId();
    return { profileId: created[0]?.id, userId };
  } catch (error) {
    await db.delete(users).where(eq(users.id, userId));
    throw error;
  }
}

export async function resetPinForProfile(actorUserId: number, input: { profileId: number; pin: string }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const target = await db.select().from(studentProfiles).where(eq(studentProfiles.id, input.profileId)).limit(1);
  if (!target[0]) throw new Error("PROFILE_NOT_FOUND");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, actorUserId)).limit(1);
  const membership = await getProfile(actorUserId);
  const permissionInput = { siteRole: account[0]?.role, classroomRole: membership?.profile.classroomRole, actorClassroomId: membership?.profile.classroomId, targetClassroomId: target[0].classroomId } as const;
  if (!membership && account[0]?.role !== "admin") throw new Error("CLASSROOM_REQUIRED");
  if (!canManageClassroom(permissionInput)) throw new Error("CLASSROOM_MANAGER_REQUIRED");
  const pinHash = await hashPin(input.pin);
  const pinLookupHash = getPinLookupHash(target[0].classroomId, input.pin, getPinPepper());
  await db.update(studentProfiles).set({ pinHash, pinLookupHash }).where(eq(studentProfiles.id, input.profileId));
  await db.update(pinSessions).set({ revokedAt: new Date() }).where(and(eq(pinSessions.profileId, input.profileId), isNull(pinSessions.revokedAt)));
  await writeActivity({ actorUserId, classroomId: target[0].classroomId, category: "member", action: "pin.reset", details: `profile:${input.profileId}` });
}

export async function authenticateWithPin(input: { classroomCode: string; pin: string; clientFingerprint: string }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const normalizedCode = input.classroomCode.trim().toUpperCase();
  const attemptKeyHash = getAttemptKeyHash(normalizedCode, input.clientFingerprint, getPinPepper());
  const after = new Date(Date.now() - PIN_ATTEMPT_WINDOW_MS);
  const recent = await db.select().from(pinLoginAttempts).where(and(eq(pinLoginAttempts.attemptKeyHash, attemptKeyHash), gte(pinLoginAttempts.attemptedAt, after)));
  if (recent.filter(attempt => !attempt.succeeded).length >= MAX_PIN_ATTEMPTS) throw new Error("PIN_RATE_LIMITED");
  const classroom = await db.select().from(classrooms).where(eq(classrooms.code, normalizedCode)).limit(1);
  const lookupHash = classroom[0] ? getPinLookupHash(classroom[0].id, input.pin, getPinPepper()) : "";
  let profile = classroom[0] ? await db.select().from(studentProfiles).where(and(eq(studentProfiles.classroomId, classroom[0].id), eq(studentProfiles.pinLookupHash, lookupHash))).limit(1) : [];
  let valid = !!profile[0] && await verifyPin(input.pin, profile[0].pinHash);
  if (!profile[0] && classroom[0]) {
    const pinHash = await hashPin(input.pin);
    const createdUser = await db.insert(users).values({ openId: `pin:${classroom[0].code}:${randomUUID()}`, name: "学習者", loginMethod: "pin-auto", role: "user" }).$returningId();
    const userId = createdUser[0]?.id;
    if (!userId) throw new Error("ACCOUNT_CREATE_FAILED");
    try {
      const createdProfile = await db.insert(studentProfiles).values({ userId, classroomId: classroom[0].id, pinHash, pinLookupHash: lookupHash, displayName: `学習者 ${userId}`, classroomRole: "student" }).$returningId();
      const profileId = createdProfile[0]?.id;
      profile = profileId ? await db.select().from(studentProfiles).where(eq(studentProfiles.id, profileId)).limit(1) : [];
      valid = !!profile[0];
      if (profile[0]) await writeActivity({ actorUserId: userId, classroomId: classroom[0].id, category: "member", action: "member.auto_joined", details: `profile:${profile[0].id}` });
    } catch (error) {
      await db.delete(users).where(eq(users.id, userId));
      profile = await db.select().from(studentProfiles).where(and(eq(studentProfiles.classroomId, classroom[0].id), eq(studentProfiles.pinLookupHash, lookupHash))).limit(1);
      valid = !!profile[0] && await verifyPin(input.pin, profile[0].pinHash);
    }
  }
  await db.insert(pinLoginAttempts).values({ attemptKeyHash, succeeded: valid });
  if (!valid || !classroom[0] || !profile[0]) throw new Error("INVALID_PIN_LOGIN");
  const token = createSessionToken();
  const tokenHash = getSessionTokenHash(token, getPinPepper());
  const expiresAt = new Date(Date.now() + PIN_SESSION_TTL_MS);
  await db.insert(pinSessions).values({ tokenHash, profileId: profile[0].id, userId: profile[0].userId, classroomId: classroom[0].id, expiresAt });
  return { token, expiresAt, profile: { id: profile[0].id, userId: profile[0].userId, displayName: profile[0].displayName, classroomRole: profile[0].classroomRole }, classroom: { id: classroom[0].id, code: classroom[0].code, name: classroom[0].name } };
}

export async function getPinSession(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const tokenHash = getSessionTokenHash(token, getPinPepper());
  const rows = await db.select({ session: pinSessions, profile: studentProfiles, classroom: classrooms }).from(pinSessions).innerJoin(studentProfiles, eq(pinSessions.profileId, studentProfiles.id)).innerJoin(classrooms, eq(pinSessions.classroomId, classrooms.id)).where(and(eq(pinSessions.tokenHash, tokenHash), isNull(pinSessions.revokedAt), gt(pinSessions.expiresAt, new Date()))).limit(1);
  if (rows[0]) await db.update(pinSessions).set({ lastSeenAt: new Date() }).where(eq(pinSessions.id, rows[0].session.id));
  return rows[0];
}

export async function revokePinSession(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(pinSessions).set({ revokedAt: new Date() }).where(eq(pinSessions.tokenHash, getSessionTokenHash(token, getPinPepper())));
}

export async function requireClassroomManager(userId: number) {
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  if (profile.profile.classroomRole !== "teacher" && profile.profile.classroomRole !== "owner") throw new Error("CLASSROOM_MANAGER_REQUIRED");
  return profile;
}

export async function listClassroomMembers(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const fields = { id: studentProfiles.id, userId: studentProfiles.userId, classroomId: studentProfiles.classroomId, classroomName: classrooms.name, displayName: studentProfiles.displayName, classroomRole: studentProfiles.classroomRole, createdAt: studentProfiles.createdAt };
  if (account[0]?.role === "admin") return db.select(fields).from(studentProfiles).innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id));
  const manager = await requireClassroomManager(userId);
  return db.select(fields).from(studentProfiles).innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id)).where(eq(studentProfiles.classroomId, manager.profile.classroomId));
}

export async function requireGlobalAdmin(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const profile = await getProfile(userId);
  if (account[0]?.role !== "admin" && profile?.profile.classroomRole !== "owner") throw new Error("GLOBAL_MANAGER_REQUIRED");
}

export async function listClassroomsForUser(userId: number, query?: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const profile = await getProfile(userId);
  const broadAccess = account[0]?.role === "admin" || profile?.profile.classroomRole === "owner";
  const base = broadAccess ? db.select().from(classrooms).orderBy(desc(classrooms.createdAt)) : profile ? db.select().from(classrooms).where(eq(classrooms.id, profile.profile.classroomId)) : [];
  const rows = await base;
  const normalized = query?.trim().toLocaleLowerCase();
  return normalized ? rows.filter(classroom => `${classroom.code} ${classroom.name}`.toLocaleLowerCase().includes(normalized)) : rows;
}

export async function createClassroom(userId: number, input: { code: string; name: string; teacherUserId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await requireGlobalAdmin(userId);
  const result = await db.insert(classrooms).values({ code: input.code.toUpperCase(), name: input.name, teacherUserId: input.teacherUserId ?? null }).$returningId();
  const room = result[0];
  if (!room) throw new Error("CLASSROOM_CREATE_FAILED");
  await writeActivity({ actorUserId: userId, classroomId: room.id, category: "classroom", action: "classroom.created", details: `${input.name}｜${input.code.toUpperCase()}` });
  return room;
}

export async function updateClassroom(userId: number, classroomId: number, input: { name?: string; teacherUserId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await requireGlobalAdmin(userId);
  await db.update(classrooms).set(input).where(eq(classrooms.id, classroomId));
  await writeActivity({ actorUserId: userId, classroomId, category: "classroom", action: "classroom.updated", details: input.name ?? "担当先生を更新" });
}

export async function listVisibleAnnouncements(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const profile = await getProfile(userId);
  const visible = profile ? or(eq(announcements.visibility, "global"), and(eq(announcements.visibility, "classroom"), eq(announcements.classroomId, profile.profile.classroomId))) : eq(announcements.visibility, "global");
  return db.select().from(announcements).where(visible).orderBy(desc(announcements.publishedAt));
}

export async function createAnnouncement(userId: number, input: { title: string; body: string; visibility: "classroom" | "global"; expiresAt?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await requireClassroomManager(userId);
  if (input.visibility === "global" && profile.profile.classroomRole !== "owner") throw new Error("GLOBAL_MANAGER_REQUIRED");
  const result = await db.insert(announcements).values({ classroomId: input.visibility === "classroom" ? profile.profile.classroomId : null, authorUserId: userId, ...input, expiresAt: input.expiresAt ?? null }).$returningId();
  return result[0];
}

export async function listVisibleCalendarEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const profile = await getProfile(userId);
  const visible = profile ? or(eq(calendarEvents.visibility, "global"), and(eq(calendarEvents.visibility, "classroom"), eq(calendarEvents.classroomId, profile.profile.classroomId))) : eq(calendarEvents.visibility, "global");
  return db.select().from(calendarEvents).where(visible).orderBy(desc(calendarEvents.startsAt));
}

export async function createCalendarEvent(userId: number, input: { title: string; startsAt: Date; endsAt?: Date; visibility: "classroom" | "global" }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await requireClassroomManager(userId);
  if (input.visibility === "global" && profile.profile.classroomRole !== "owner") throw new Error("GLOBAL_MANAGER_REQUIRED");
  const result = await db.insert(calendarEvents).values({ classroomId: input.visibility === "classroom" ? profile.profile.classroomId : null, authorUserId: userId, ...input, endsAt: input.endsAt ?? null }).$returningId();
  return result[0];
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
  await writeActivity({ actorUserId: userId, classroomId: profile.profile.classroomId, category: "learning", action: `answer.${input.mode}`, details: input.isCorrect ? "correct" : "review" });
}

export async function recordFocusSession(userId: number, input: { startedAt: Date; completedAt: Date; focusSeconds: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  await db.insert(focusSessions).values({ userId, classroomId: profile.profile.classroomId, ...input });
  await writeActivity({ actorUserId: userId, classroomId: profile.profile.classroomId, category: "learning", action: "focus.completed", details: `${input.focusSeconds}s` });
}

export async function saveJournalEntry(userId: number, input: { subject: "english" | "kanji"; difficulty: string; sourceType: "ai" | "news"; sourceTitle?: string; sourceUrl?: string; articleTitle: string; articleBody: string; questions: Array<{ question: string; answer: string; explanation: string }> }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  const inserted = await db.insert(journalEntries).values({ userId, classroomId: profile.profile.classroomId, subject: input.subject, difficulty: input.difficulty, sourceType: input.sourceType, sourceTitle: input.sourceTitle ?? null, sourceUrl: input.sourceUrl ?? null, articleTitle: input.articleTitle, articleBody: input.articleBody, questionsJson: JSON.stringify(input.questions) }).$returningId();
  await writeActivity({ actorUserId: userId, classroomId: profile.profile.classroomId, category: "journal", action: "journal.generated", details: input.articleTitle });
  return inserted[0];
}

export async function listJournalEntries(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(journalEntries).where(eq(journalEntries.userId, userId)).orderBy(desc(journalEntries.createdAt)).limit(30);
  return rows.map(row => {
    let questions: Array<{ question: string; answer: string; explanation: string }> = [];
    try { const parsed = JSON.parse(row.questionsJson); if (Array.isArray(parsed)) questions = parsed; } catch { /* 破損した履歴は設問なしとして安全に表示する */ }
    return { ...row, questions };
  });
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

export async function getManagementInsights(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const profile = await getProfile(userId);
  if (account[0]?.role !== "admin" && profile?.profile.classroomRole !== "owner") throw new Error("GLOBAL_MANAGER_REQUIRED");
  const classroomFilter = account[0]?.role === "admin" ? undefined : profile?.profile.classroomId;
  const [members, sessions, records, journals, logs] = await Promise.all([
    db.select().from(studentProfiles), db.select().from(focusSessions), db.select().from(studyRecords), db.select().from(journalEntries), db.select({ log: activityLogs, actorName: users.name, classroomName: classrooms.name }).from(activityLogs).leftJoin(users, eq(activityLogs.actorUserId, users.id)).leftJoin(classrooms, eq(activityLogs.classroomId, classrooms.id)).orderBy(desc(activityLogs.createdAt)).limit(40),
  ]);
  const include = (classroomId: number) => classroomFilter === undefined || classroomId === classroomFilter;
  const scopedMembers = members.filter(member => include(member.classroomId)); const scopedSessions = sessions.filter(session => include(session.classroomId)); const scopedRecords = records.filter(record => include(record.classroomId)); const scopedJournals = journals.filter(entry => include(entry.classroomId));
  const totalFocusSeconds = scopedSessions.reduce((sum, session) => sum + session.focusSeconds, 0);
  const correct = scopedRecords.filter(record => record.isCorrect).length;
  return { memberCount: scopedMembers.length, totalFocusSeconds, answers: scopedRecords.length, retention: scopedRecords.length ? Math.round((correct / scopedRecords.length) * 100) : 0, journalCount: scopedJournals.length, recentActivities: logs.filter(row => row.log.classroomId === null || include(row.log.classroomId)).map(row => ({ id: row.log.id, category: row.log.category, action: row.log.action, details: row.log.details, createdAt: row.log.createdAt, actorName: row.actorName ?? "管理者", classroomName: row.classroomName ?? "全体" })) };
}
