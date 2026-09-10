import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import webpush from "web-push";
import { activityLogs, announcements, calendarEvents, classrooms, focusSessions, InsertUser, journalEntries, monsterEggs, monsterImageSettings, monsterMissionClaims, monsterProfiles, pinLoginAttempts, pinSessions, recommendedTestClaims, recommendedTests, revivalDays, savedStudySets, siteAdminSessions, siteSettings, smartNotificationSettings, smartNotificationSubscriptions, studentProfiles, studyRecords, teacherAdminSessions, users, vocabularyWordNotes, vocabularyWords, wordbooks } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { createSessionToken, getAttemptKeyHash, getPinLookupHash, getSessionTokenHash, hashPin, verifyPin } from "./pin-auth";
import { canManageClassroom, canPublishGlobally } from "./classroom-permissions";
import { createSiteAdminSessionToken, getSiteAdminSessionTokenHash } from "./site-admin-auth";
import { createTeacherAdminSessionToken, getTeacherAdminSessionTokenHash } from "./teacher-admin-auth";
import { previewVocabularyRows } from "./studyverse.utils";
import { buildMissionState, calculateMonsterStage } from "./monster";
import { storagePut } from "./storage";

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
const TEACHER_ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 8;

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

export async function createTeacherAdminSession(teacherId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const classroom = (await db.select().from(classrooms).where(eq(classrooms.teacherUserId, teacherId)).limit(1))[0];
  if (!classroom) throw new Error("TEACHER_ID_NOT_FOUND");
  const teacherOpenId = `teacher-admin:${teacherId}`;
  await db.insert(users).values({ openId: teacherOpenId, name: `先生 #${teacherId}`, loginMethod: "teacher-id", role: "user", lastSignedIn: new Date() }).onDuplicateKeyUpdate({ set: { name: `先生 #${teacherId}`, lastSignedIn: new Date() } });
  const user = await getUserByOpenId(teacherOpenId);
  if (!user) throw new Error("TEACHER_SESSION_UNAVAILABLE");
  const profile = (await db.select().from(studentProfiles).where(and(eq(studentProfiles.userId, user.id), eq(studentProfiles.classroomId, classroom.id))).limit(1))[0];
  if (!profile) {
    const internalPin = `teacher:${teacherId}:${randomUUID()}`;
    await db.insert(studentProfiles).values({ userId: user.id, classroomId: classroom.id, pinHash: await hashPin(internalPin), pinLookupHash: `teacher-session:${teacherId}`, displayName: `先生 #${teacherId}`, classroomRole: "teacher" });
  }
  const token = createTeacherAdminSessionToken();
  const expiresAt = new Date(Date.now() + TEACHER_ADMIN_SESSION_TTL_MS);
  await db.insert(teacherAdminSessions).values({ tokenHash: getTeacherAdminSessionTokenHash(token), userId: user.id, classroomId: classroom.id, teacherId, expiresAt });
  return { token, expiresAt, user, classroom };
}

export async function getTeacherAdminSession(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ session: teacherAdminSessions, user: users, classroom: classrooms }).from(teacherAdminSessions).innerJoin(users, eq(teacherAdminSessions.userId, users.id)).innerJoin(classrooms, and(eq(classrooms.id, teacherAdminSessions.classroomId), eq(classrooms.teacherUserId, teacherAdminSessions.teacherId))).where(and(eq(teacherAdminSessions.tokenHash, getTeacherAdminSessionTokenHash(token)), isNull(teacherAdminSessions.revokedAt), gt(teacherAdminSessions.expiresAt, new Date()))).limit(1);
  if (rows[0]) await db.update(teacherAdminSessions).set({ lastSeenAt: new Date() }).where(eq(teacherAdminSessions.id, rows[0].session.id));
  return rows[0];
}

export async function revokeTeacherAdminSession(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(teacherAdminSessions).set({ revokedAt: new Date() }).where(eq(teacherAdminSessions.tokenHash, getTeacherAdminSessionTokenHash(token)));
}

export async function getProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ profile: studentProfiles, classroom: classrooms }).from(studentProfiles).innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id)).where(eq(studentProfiles.userId, userId)).limit(1);
  return rows[0];
}

const PIN_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
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
  const createdUser = await db.insert(users).values({ openId: `pin:${input.classroomId}:${randomUUID()}`, name: input.displayName, loginMethod: "pin", role: "user" }).$returningId();
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

export async function authenticateWithPin(input: { classroomCode: string; pin: string; clientFingerprint: string; personalClientId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const normalizedCode = input.classroomCode.trim().toUpperCase();
  const personalCodes = await getPersonalClassroomCodes(db);
  const isPersonalCode = personalCodes.includes(normalizedCode);
  const personalIdentity = `${input.personalClientId?.trim() || input.clientFingerprint}:${input.pin}`;
  const isolatedCode = isPersonalCode ? `P-${getAttemptKeyHash(normalizedCode, personalIdentity, getPinPepper()).slice(0, 16)}` : normalizedCode;
  const attemptKeyHash = getAttemptKeyHash(isolatedCode, input.clientFingerprint, getPinPepper());
  const after = new Date(Date.now() - PIN_ATTEMPT_WINDOW_MS);
  const recent = await db.select().from(pinLoginAttempts).where(and(eq(pinLoginAttempts.attemptKeyHash, attemptKeyHash), gte(pinLoginAttempts.attemptedAt, after)));
  if (recent.filter(attempt => !attempt.succeeded).length >= MAX_PIN_ATTEMPTS) throw new Error("PIN_RATE_LIMITED");
  let classroom = await db.select().from(classrooms).where(eq(classrooms.code, isolatedCode)).limit(1);
  if (!classroom[0] && isPersonalCode) {
    const created = await db.insert(classrooms).values({ code: isolatedCode, name: "個人利用", teacherUserId: null }).$returningId();
    if (created[0]?.id) classroom = await db.select().from(classrooms).where(eq(classrooms.id, created[0].id)).limit(1);
  }
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
  await writeActivity({ actorUserId: profile[0].userId, classroomId: classroom[0].id, category: "learning", action: "login.success", details: "pin" });
  return { token, expiresAt, profile: { id: profile[0].id, userId: profile[0].userId, displayName: profile[0].displayName, avatarUrl: profile[0].avatarUrl, classroomRole: profile[0].classroomRole }, classroom: { id: classroom[0].id, code: classroom[0].code, name: classroom[0].name } };
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
  const fields = { id: studentProfiles.id, userId: studentProfiles.userId, classroomId: studentProfiles.classroomId, classroomName: classrooms.name, displayName: studentProfiles.displayName, avatarUrl: studentProfiles.avatarUrl, classroomRole: studentProfiles.classroomRole, createdAt: studentProfiles.createdAt };
  if (account[0]?.role === "admin") return db.select(fields).from(studentProfiles).innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id)).where(eq(studentProfiles.classroomRole, "student"));
  const manager = await requireClassroomManager(userId);
  return db.select(fields).from(studentProfiles).innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id)).where(and(eq(studentProfiles.classroomId, manager.profile.classroomId), eq(studentProfiles.classroomRole, "student")));
}

export async function getClassroomMemberDetail(actorUserId: number, profileId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const target = (await db.select({ profile: studentProfiles, classroom: classrooms }).from(studentProfiles).innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id)).where(eq(studentProfiles.id, profileId)).limit(1))[0];
  if (!target || target.profile.classroomRole !== "student") throw new Error("MEMBER_NOT_FOUND");
  const account = (await db.select({ role: users.role }).from(users).where(eq(users.id, actorUserId)).limit(1))[0];
  if (account?.role !== "admin") {
    const manager = await requireClassroomManager(actorUserId);
    if (manager.profile.classroomId !== target.profile.classroomId) throw new Error("MEMBER_DETAIL_FORBIDDEN");
  }
  const [summary, dashboard, monster, sets, recentAnswers, recentFocusSessions, revivalHistory] = await Promise.all([
    getLearningSummary(target.profile.userId),
    getLearningDashboard(target.profile.userId),
    getMonsterDashboard(target.profile.userId),
    listSavedStudySets(target.profile.userId),
    db.select({ id: studyRecords.id, mode: studyRecords.mode, isCorrect: studyRecords.isCorrect, answeredAt: studyRecords.answeredAt }).from(studyRecords).where(eq(studyRecords.userId, target.profile.userId)).orderBy(desc(studyRecords.answeredAt), desc(studyRecords.id)).limit(8),
    db.select({ completedAt: focusSessions.completedAt, focusSeconds: focusSessions.focusSeconds }).from(focusSessions).where(eq(focusSessions.userId, target.profile.userId)).orderBy(desc(focusSessions.completedAt)).limit(5),
    db.select({ dateKey: revivalDays.dateKey, usedAt: revivalDays.usedAt }).from(revivalDays).where(eq(revivalDays.userId, target.profile.userId)).orderBy(desc(revivalDays.usedAt)).limit(10),
  ]);
  return {
    profile: { id: target.profile.id, displayName: target.profile.displayName, classroomName: target.classroom.name, classroomCode: target.classroom.code, joinedAt: target.profile.createdAt, revivalTickets: target.profile.revivalTickets },
    learning: summary,
    wordbooks: dashboard.wordbooks,
    savedSets: sets.map(set => ({ id: set.id, label: set.label, wordbookTitle: set.wordbookTitle, subject: set.subject, wordCount: set.words.length, updatedAt: set.updatedAt })),
    reviewWordCount: dashboard.reviewWords.length,
    recentAnswers,
    recentFocusSessions,
    revivalHistory,
    monster: { stage: monster.active.progression.stage, eggNumber: monster.active.eggNumber, totalFocusSeconds: monster.totalFocusSeconds, eggCount: monster.eggs.length, historyCount: monster.history.length },
  };
}

export async function requireGlobalAdmin(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const profile = await getProfile(userId);
  if (account[0]?.role !== "admin" && profile?.profile.classroomRole !== "owner") throw new Error("GLOBAL_MANAGER_REQUIRED");
}

const WORD_BOOK_CREATION_SETTING_KEY = "wordbookCreationDisabled";
const PERSONAL_CLASSROOM_CODES_SETTING_KEY = "personalClassroomCodes";

function parsePersonalClassroomCodes(value?: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? Array.from(new Set(parsed.filter((code): code is string => typeof code === "string").map(code => code.trim().toUpperCase()).filter(code => /^[A-Z0-9-]{3,32}$/.test(code)))) : [];
  } catch { return []; }
}

async function getPersonalClassroomCodes(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const row = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, PERSONAL_CLASSROOM_CODES_SETTING_KEY)).limit(1);
  return parsePersonalClassroomCodes(row[0]?.value);
}

export async function listPersonalClassroomCodes(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await requireGlobalAdmin(userId);
  return getPersonalClassroomCodes(db);
}

export async function addPersonalClassroomCode(userId: number, code: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await requireGlobalAdmin(userId);
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(normalized)) throw new Error("INVALID_CLASSROOM_CODE");
  const existingClassroom = await db.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.code, normalized)).limit(1);
  if (existingClassroom[0]) throw new Error("CLASSROOM_CODE_ALREADY_USED");
  const codes = await getPersonalClassroomCodes(db);
  if (codes.includes(normalized)) return { code: normalized, codes };
  const nextCodes = [...codes, normalized];
  const row = await db.select({ key: siteSettings.key }).from(siteSettings).where(eq(siteSettings.key, PERSONAL_CLASSROOM_CODES_SETTING_KEY)).limit(1);
  if (row[0]) await db.update(siteSettings).set({ value: JSON.stringify(nextCodes) }).where(eq(siteSettings.key, PERSONAL_CLASSROOM_CODES_SETTING_KEY));
  else await db.insert(siteSettings).values({ key: PERSONAL_CLASSROOM_CODES_SETTING_KEY, value: JSON.stringify(nextCodes) });
  return { code: normalized, codes: nextCodes };
}

export async function removePersonalClassroomCode(userId: number, code: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await requireGlobalAdmin(userId);
  const normalized = code.trim().toUpperCase();
  const nextCodes = (await getPersonalClassroomCodes(db)).filter(item => item !== normalized);
  const row = await db.select({ key: siteSettings.key }).from(siteSettings).where(eq(siteSettings.key, PERSONAL_CLASSROOM_CODES_SETTING_KEY)).limit(1);
  if (row[0]) await db.update(siteSettings).set({ value: JSON.stringify(nextCodes) }).where(eq(siteSettings.key, PERSONAL_CLASSROOM_CODES_SETTING_KEY));
  return { codes: nextCodes };
}

export async function getWordbookCreationPolicy() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const row = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, WORD_BOOK_CREATION_SETTING_KEY)).limit(1);
  return { disabled: row[0]?.value === "true" };
}

export async function setWordbookCreationDisabled(userId: number, disabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await requireGlobalAdmin(userId);
  const existing = await db.select({ key: siteSettings.key }).from(siteSettings).where(eq(siteSettings.key, WORD_BOOK_CREATION_SETTING_KEY)).limit(1);
  if (existing[0]) await db.update(siteSettings).set({ value: disabled ? "true" : "false" }).where(eq(siteSettings.key, WORD_BOOK_CREATION_SETTING_KEY));
  else await db.insert(siteSettings).values({ key: WORD_BOOK_CREATION_SETTING_KEY, value: disabled ? "true" : "false" });
  return { disabled };
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

export async function deleteClassroom(userId: number, classroomId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const actor = (await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (actor?.role !== "admin") throw new Error("GLOBAL_MANAGER_REQUIRED");
  const classroom = (await db.select().from(classrooms).where(eq(classrooms.id, classroomId)).limit(1))[0];
  if (!classroom) throw new Error("CLASSROOM_NOT_FOUND");

  const profiles = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.classroomId, classroomId));
  const memberUserIds = profiles.map(profile => profile.userId);
  const books = await db.select({ id: wordbooks.id }).from(wordbooks).where(eq(wordbooks.classroomId, classroomId));
  const wordbookIds = books.map(book => book.id);

  await db.transaction(async tx => {
    if (wordbookIds.length) {
      await tx.delete(savedStudySets).where(inArray(savedStudySets.wordbookId, wordbookIds));
      await tx.delete(vocabularyWords).where(inArray(vocabularyWords.wordbookId, wordbookIds));
      await tx.delete(wordbooks).where(inArray(wordbooks.id, wordbookIds));
    }
    await tx.delete(recommendedTests).where(eq(recommendedTests.classroomId, classroomId));
    await tx.delete(announcements).where(eq(announcements.classroomId, classroomId));
    await tx.delete(calendarEvents).where(eq(calendarEvents.classroomId, classroomId));
    await tx.delete(studyRecords).where(eq(studyRecords.classroomId, classroomId));
    await tx.delete(focusSessions).where(eq(focusSessions.classroomId, classroomId));
    await tx.delete(journalEntries).where(eq(journalEntries.classroomId, classroomId));
    await tx.delete(teacherAdminSessions).where(eq(teacherAdminSessions.classroomId, classroomId));
    await tx.delete(pinSessions).where(eq(pinSessions.classroomId, classroomId));
    await tx.delete(activityLogs).where(eq(activityLogs.classroomId, classroomId));
    if (memberUserIds.length) {
      await tx.delete(savedStudySets).where(inArray(savedStudySets.userId, memberUserIds));
      await tx.delete(revivalDays).where(inArray(revivalDays.userId, memberUserIds));
      await tx.delete(vocabularyWordNotes).where(inArray(vocabularyWordNotes.userId, memberUserIds));
      await tx.delete(smartNotificationSubscriptions).where(inArray(smartNotificationSubscriptions.userId, memberUserIds));
      await tx.delete(smartNotificationSettings).where(inArray(smartNotificationSettings.userId, memberUserIds));
      await tx.delete(monsterMissionClaims).where(inArray(monsterMissionClaims.userId, memberUserIds));
      await tx.delete(monsterEggs).where(inArray(monsterEggs.userId, memberUserIds));
      await tx.delete(monsterProfiles).where(inArray(monsterProfiles.userId, memberUserIds));
      await tx.delete(calendarEvents).where(inArray(calendarEvents.authorUserId, memberUserIds));
      await tx.delete(journalEntries).where(inArray(journalEntries.userId, memberUserIds));
      await tx.delete(activityLogs).where(inArray(activityLogs.actorUserId, memberUserIds));
      await tx.delete(studentProfiles).where(eq(studentProfiles.classroomId, classroomId));
      await tx.delete(users).where(inArray(users.id, memberUserIds));
    }
    await tx.delete(classrooms).where(eq(classrooms.id, classroomId));
  });
  await writeActivity({ actorUserId: userId, category: "classroom", action: "classroom.deleted", details: `${classroom.name}｜${classroom.code}｜利用者${memberUserIds.length}人・教材${wordbookIds.length}件` });
  return { deletedClassroomId: classroomId, deletedMemberCount: memberUserIds.length, deletedWordbookCount: wordbookIds.length };
}

export async function listVisibleAnnouncements(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const profile = await getProfile(userId);
  const visible = profile ? or(eq(announcements.visibility, "global"), and(eq(announcements.visibility, "classroom"), eq(announcements.classroomId, profile.profile.classroomId))) : eq(announcements.visibility, "global");
  const availableNow = or(isNull(announcements.scheduledAt), lte(announcements.scheduledAt, new Date()));
  return db.select().from(announcements).where(and(visible, availableNow)).orderBy(desc(announcements.publishedAt));
}

async function getAnnouncementManagementScope(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const profile = await getProfile(userId);
  const isAdmin = account[0]?.role === "admin";
  const isManager = profile?.profile.classroomRole === "teacher" || profile?.profile.classroomRole === "owner";
  if (!isAdmin && !isManager) throw new Error(profile ? "CLASSROOM_MANAGER_REQUIRED" : "CLASSROOM_REQUIRED");
  return { isAdmin, profile };
}

async function resolveAnnouncementClassroomId(scope: Awaited<ReturnType<typeof getAnnouncementManagementScope>>, visibility: "classroom" | "global", requestedClassroomId?: number) {
  if (visibility === "global") {
    if (!scope.isAdmin && scope.profile?.profile.classroomRole !== "owner") throw new Error("GLOBAL_MANAGER_REQUIRED");
    return null;
  }
  if (scope.isAdmin) {
    if (requestedClassroomId) return requestedClassroomId;
    const db = await getDb();
    const latestClassroom = db ? (await db.select({ id: classrooms.id }).from(classrooms).orderBy(desc(classrooms.createdAt)).limit(1))[0] : undefined;
    if (!latestClassroom) throw new Error("CLASSROOM_REQUIRED");
    return latestClassroom.id;
  }
  return scope.profile?.profile.classroomId;
}

export async function listManageableAnnouncements(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const scope = await getAnnouncementManagementScope(userId);
  const where = scope.isAdmin ? undefined : or(eq(announcements.classroomId, scope.profile!.profile.classroomId), eq(announcements.authorUserId, userId));
  const query = db.select().from(announcements).orderBy(desc(announcements.publishedAt));
  return where ? query.where(where) : query;
}

export async function listAnnouncementHistory(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const scope = await getAnnouncementManagementScope(userId);
  const rows = await db.select({ log: activityLogs, actorName: users.name, classroomName: classrooms.name }).from(activityLogs).leftJoin(users, eq(activityLogs.actorUserId, users.id)).leftJoin(classrooms, eq(activityLogs.classroomId, classrooms.id)).orderBy(desc(activityLogs.createdAt)).limit(120);
  return rows.filter(row => row.log.category === "classroom" && row.log.action.startsWith("announcement.") && (scope.isAdmin || row.log.classroomId === scope.profile?.profile.classroomId)).slice(0, 30).map(row => ({ id: row.log.id, action: row.log.action, details: row.log.details, createdAt: row.log.createdAt, actorName: row.actorName ?? "管理者", classroomName: row.classroomName ?? "全体" }));
}

async function requireAnnouncementEditor(userId: number, announcementId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const row = await db.select().from(announcements).where(eq(announcements.id, announcementId)).limit(1);
  if (!row[0]) throw new Error("ANNOUNCEMENT_NOT_FOUND");
  const scope = await getAnnouncementManagementScope(userId);
  if (!scope.isAdmin && row[0].classroomId !== scope.profile?.profile.classroomId && row[0].authorUserId !== userId) throw new Error("CLASSROOM_MANAGER_REQUIRED");
  return { db, announcement: row[0], scope };
}

export async function createAnnouncement(userId: number, input: { title: string; body: string; visibility: "classroom" | "global"; expiresAt?: Date; scheduledAt?: Date; classroomId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const scope = await getAnnouncementManagementScope(userId);
  const classroomId = await resolveAnnouncementClassroomId(scope, input.visibility, input.classroomId);
  const result = await db.insert(announcements).values({ classroomId, authorUserId: userId, title: input.title, body: input.body, visibility: input.visibility, scheduledAt: input.scheduledAt ?? null, expiresAt: input.expiresAt ?? null }).$returningId();
  await writeActivity({ actorUserId: userId, classroomId: classroomId ?? undefined, category: "classroom", action: "announcement.created", details: input.title });
  return result[0];
}

export async function updateAnnouncement(userId: number, announcementId: number, input: { title?: string; body?: string; visibility?: "classroom" | "global"; expiresAt?: Date | null; scheduledAt?: Date | null; classroomId?: number }) {
  const { db, announcement, scope } = await requireAnnouncementEditor(userId, announcementId);
  const visibility = input.visibility ?? announcement.visibility;
  const classroomId = input.visibility || input.classroomId !== undefined ? await resolveAnnouncementClassroomId(scope, visibility, input.classroomId) : announcement.classroomId;
  await db.update(announcements).set({ title: input.title, body: input.body, visibility, classroomId, scheduledAt: input.scheduledAt, expiresAt: input.expiresAt }).where(eq(announcements.id, announcementId));
  await writeActivity({ actorUserId: userId, classroomId: classroomId ?? undefined, category: "classroom", action: "announcement.updated", details: input.title ?? announcement.title });
}

export async function deleteAnnouncement(userId: number, announcementId: number) {
  const { db, announcement } = await requireAnnouncementEditor(userId, announcementId);
  await db.delete(announcements).where(eq(announcements.id, announcementId));
  await writeActivity({ actorUserId: userId, classroomId: announcement.classroomId ?? undefined, category: "classroom", action: "announcement.deleted", details: announcement.title });
}

export async function listVisibleCalendarEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const profile = await getProfile(userId);
  const personal = and(eq(calendarEvents.visibility, "personal"), eq(calendarEvents.authorUserId, userId));
  const visible = profile ? or(personal, eq(calendarEvents.visibility, "global"), and(eq(calendarEvents.visibility, "classroom"), eq(calendarEvents.classroomId, profile.profile.classroomId))) : or(personal, eq(calendarEvents.visibility, "global"));
  return db.select().from(calendarEvents).where(visible).orderBy(desc(calendarEvents.startsAt));
}

export async function createCalendarEvent(userId: number, input: { title: string; startsAt: Date; endsAt?: Date; visibility: "personal" | "classroom" | "global" }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  if (input.visibility === "personal") {
    const result = await db.insert(calendarEvents).values({ classroomId: null, authorUserId: userId, ...input, endsAt: input.endsAt ?? null }).$returningId();
    return result[0];
  }
  const profile = await requireClassroomManager(userId);
  if (input.visibility === "global" && profile.profile.classroomRole !== "owner") throw new Error("GLOBAL_MANAGER_REQUIRED");
  const result = await db.insert(calendarEvents).values({ classroomId: input.visibility === "classroom" ? profile.profile.classroomId : null, authorUserId: userId, ...input, endsAt: input.endsAt ?? null }).$returningId();
  return result[0];
}

export async function deletePersonalCalendarEvent(userId: number, calendarEventId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const event = (await db.select().from(calendarEvents).where(eq(calendarEvents.id, calendarEventId)).limit(1))[0];
  if (!event) throw new Error("CALENDAR_EVENT_NOT_FOUND");
  if (event.visibility !== "personal" || event.authorUserId !== userId) throw new Error("CALENDAR_EVENT_FORBIDDEN");
  await db.delete(calendarEvents).where(eq(calendarEvents.id, calendarEventId));
}

async function getRecommendedTestClassroomIds(userId: number, requestedClassroomId?: number, allClassrooms = false) {
  const scope = await getAnnouncementManagementScope(userId);
  if (!scope.isAdmin) return [scope.profile!.profile.classroomId];
  if (allClassrooms) {
    const db = await getDb();
    const targets = db ? await db.select({ id: classrooms.id }).from(classrooms).orderBy(desc(classrooms.createdAt)) : [];
    if (!targets.length) throw new Error("CLASSROOM_REQUIRED");
    return targets.map(target => target.id);
  }
  if (requestedClassroomId) return [requestedClassroomId];
  const db = await getDb();
  const latest = db ? (await db.select({ id: classrooms.id }).from(classrooms).orderBy(desc(classrooms.createdAt)).limit(1))[0] : undefined;
  if (!latest) throw new Error("CLASSROOM_REQUIRED");
  return [latest.id];
}

export async function createRecommendedTest(userId: number, input: { wordbookId: number; rangeStart: number; rangeEnd: number; questionCount: number; deliveryMode?: "normal" | "announcement"; deliveryType?: "test" | "wordbook"; classroomId?: number; allClassrooms?: boolean; availableFrom?: Date; availableUntil?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const classroomIds = await getRecommendedTestClassroomIds(userId, input.classroomId, input.allClassrooms);
  const scope = await getAnnouncementManagementScope(userId);
  const book = (await db.select().from(wordbooks).where(eq(wordbooks.id, input.wordbookId)).limit(1))[0];
  if (!book) throw new Error("WORD_BOOK_NOT_FOUND");
  if (!scope.isAdmin && book.classroomId !== classroomIds[0] && book.ownerUserId !== userId) throw new Error("WORD_BOOK_FORBIDDEN");
  if (classroomIds.length > 1 && book.visibility !== "global") throw new Error("WORD_BOOK_FORBIDDEN");
  const words = await db.select({ id: vocabularyWords.id }).from(vocabularyWords).where(eq(vocabularyWords.wordbookId, book.id)).orderBy(vocabularyWords.id);
  if (input.rangeStart < 1 || input.rangeEnd < input.rangeStart || input.rangeEnd > words.length) throw new Error("TEST_RANGE_INVALID");
  const rangeLength = input.rangeEnd - input.rangeStart + 1;
  if (input.questionCount < 1 || input.questionCount > rangeLength) throw new Error("TEST_QUESTION_COUNT_INVALID");
  const deliveryMode = input.deliveryMode ?? "normal";
  const deliveryType = input.deliveryType ?? "test";
  if (deliveryType === "wordbook" && (input.rangeStart !== 1 || input.rangeEnd !== words.length || input.questionCount !== words.length)) throw new Error("WORD_BOOK_DELIVERY_RANGE_INVALID");
  if (deliveryMode === "announcement" && !input.availableUntil) throw new Error("TEST_PERIOD_REQUIRED");
  if (input.availableUntil && input.availableFrom && input.availableUntil < input.availableFrom) throw new Error("TEST_PERIOD_INVALID");
  const values = classroomIds.map(classroomId => ({ classroomId, authorUserId: userId, wordbookId: book.id, rangeStart: input.rangeStart, rangeEnd: input.rangeEnd, questionCount: input.questionCount, deliveryMode, deliveryType, availableFrom: input.availableFrom ?? new Date(Date.now() - 1_000), availableUntil: input.availableUntil ?? null }));
  const createdIds = classroomIds.length === 1 ? (await db.insert(recommendedTests).values(values[0]!).$returningId()).map(item => item.id) : (await db.insert(recommendedTests).values(values), [] as number[]);
  await Promise.all(classroomIds.map(classroomId => writeActivity({ actorUserId: userId, classroomId, category: "classroom", action: "recommendedTest.created", details: `${book.title}｜第${input.rangeStart}〜${input.rangeEnd}語` })));
  return { id: createdIds[0], createdIds, targetCount: classroomIds.length };
}

async function decorateRecommendedTests(rows: Array<typeof recommendedTests.$inferSelect>) {
  const db = await getDb();
  if (!db) return [];
  return Promise.all(rows.map(async item => {
    const book = (await db.select().from(wordbooks).where(eq(wordbooks.id, item.wordbookId)).limit(1))[0];
    if (!book) return null;
    const words = await db.select().from(vocabularyWords).where(eq(vocabularyWords.wordbookId, item.wordbookId)).orderBy(vocabularyWords.id);
    return { ...item, wordbookTitle: book.title, subject: book.subject, words: words.slice(item.rangeStart - 1, item.rangeEnd) };
  })).then(items => items.filter((item): item is NonNullable<typeof item> => Boolean(item)));
}

export async function listRecommendedTestsForLearner(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const profile = await getProfile(userId);
  if (!profile) return [];
  const now = new Date();
  const rows = await db.select().from(recommendedTests).where(and(eq(recommendedTests.classroomId, profile.profile.classroomId), eq(recommendedTests.deliveryMode, "normal"), lte(recommendedTests.availableFrom, now), or(isNull(recommendedTests.availableUntil), gte(recommendedTests.availableUntil, now)))).orderBy(desc(recommendedTests.createdAt));
  const decorated = await decorateRecommendedTests(rows);
  const claims = await db.select({ recommendedTestId: recommendedTestClaims.recommendedTestId, receivedWordbookId: recommendedTestClaims.receivedWordbookId }).from(recommendedTestClaims).where(eq(recommendedTestClaims.userId, userId));
  const claimByTest = new Map(claims.map(claim => [claim.recommendedTestId, claim.receivedWordbookId]));
  return decorated.map(item => ({ ...item, claimed: item.deliveryType === "wordbook" ? claimByTest.has(item.id) : false, receivedWordbookId: item.deliveryType === "wordbook" ? claimByTest.get(item.id) ?? null : null }));
}

export async function listAnnouncementRecommendedTests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const profile = await getProfile(userId);
  if (!profile) return [];
  const now = new Date();
  const rows = await db.select().from(recommendedTests).where(and(eq(recommendedTests.classroomId, profile.profile.classroomId), eq(recommendedTests.deliveryMode, "announcement"), lte(recommendedTests.availableFrom, now), or(isNull(recommendedTests.availableUntil), gte(recommendedTests.availableUntil, now)))).orderBy(desc(recommendedTests.createdAt));
  const decorated = await decorateRecommendedTests(rows);
  const claims = await db.select({ recommendedTestId: recommendedTestClaims.recommendedTestId, receivedWordbookId: recommendedTestClaims.receivedWordbookId }).from(recommendedTestClaims).where(eq(recommendedTestClaims.userId, userId));
  const claimByTest = new Map(claims.map(claim => [claim.recommendedTestId, claim.receivedWordbookId]));
  return decorated.map(item => ({ ...item, claimed: claimByTest.has(item.id), receivedWordbookId: claimByTest.get(item.id) ?? null }));
}

export async function claimAnnouncementRecommendedTest(userId: number, recommendedTestId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  const existing = (await db.select().from(recommendedTestClaims).where(and(eq(recommendedTestClaims.recommendedTestId, recommendedTestId), eq(recommendedTestClaims.userId, userId))).limit(1))[0];
  if (existing) return { receivedWordbookId: existing.receivedWordbookId, alreadyClaimed: true } as const;
  const now = new Date();
  const item = (await db.select().from(recommendedTests).where(and(eq(recommendedTests.id, recommendedTestId), eq(recommendedTests.classroomId, profile.profile.classroomId), eq(recommendedTests.deliveryMode, "announcement"), lte(recommendedTests.availableFrom, now), or(isNull(recommendedTests.availableUntil), gte(recommendedTests.availableUntil, now)))).limit(1))[0];
  if (!item) throw new Error("RECOMMENDED_TEST_NOT_AVAILABLE");
  const sourceBook = (await db.select().from(wordbooks).where(eq(wordbooks.id, item.wordbookId)).limit(1))[0];
  if (!sourceBook) throw new Error("WORD_BOOK_NOT_FOUND");
  const sourceWords = await db.select().from(vocabularyWords).where(eq(vocabularyWords.wordbookId, item.wordbookId)).orderBy(vocabularyWords.id);
  const selectedWords = sourceWords.slice(item.rangeStart - 1, item.rangeEnd);
  if (!selectedWords.length) throw new Error("TEST_RANGE_INVALID");
  const insertedBook = await db.insert(wordbooks).values({ title: `${sourceBook.title}（受取）`, subject: sourceBook.subject, visibility: "private", ownerUserId: userId, classroomId: profile.profile.classroomId }).$returningId();
  const receivedWordbookId = insertedBook[0]!.id;
  await db.insert(vocabularyWords).values(selectedWords.map(word => ({ wordbookId: receivedWordbookId, front: word.front, back: word.back, reading: word.reading, imageUrl: word.imageUrl, exampleSentence: word.exampleSentence, exampleTranslation: word.exampleTranslation, source: "admin" as const })));
  await db.insert(recommendedTestClaims).values({ recommendedTestId, userId, receivedWordbookId });
  await writeActivity({ actorUserId: userId, classroomId: profile.profile.classroomId, category: "learning", action: "recommendedTest.claimed", details: `${sourceBook.title}｜第${item.rangeStart}〜${item.rangeEnd}語` });
  return { receivedWordbookId, alreadyClaimed: false } as const;
}

export async function claimRecommendedWordbook(userId: number, recommendedTestId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  const existing = (await db.select().from(recommendedTestClaims).where(and(eq(recommendedTestClaims.recommendedTestId, recommendedTestId), eq(recommendedTestClaims.userId, userId))).limit(1))[0];
  if (existing) return { receivedWordbookId: existing.receivedWordbookId, alreadyClaimed: true } as const;
  const now = new Date();
  const item = (await db.select().from(recommendedTests).where(and(eq(recommendedTests.id, recommendedTestId), eq(recommendedTests.classroomId, profile.profile.classroomId), eq(recommendedTests.deliveryType, "wordbook"), lte(recommendedTests.availableFrom, now), or(isNull(recommendedTests.availableUntil), gte(recommendedTests.availableUntil, now)))).limit(1))[0];
  if (!item) throw new Error("RECOMMENDED_WORD_BOOK_NOT_AVAILABLE");
  const sourceBook = (await db.select().from(wordbooks).where(eq(wordbooks.id, item.wordbookId)).limit(1))[0];
  if (!sourceBook) throw new Error("WORD_BOOK_NOT_FOUND");
  const sourceWords = await db.select().from(vocabularyWords).where(eq(vocabularyWords.wordbookId, item.wordbookId)).orderBy(vocabularyWords.id);
  const selectedWords = sourceWords.slice(item.rangeStart - 1, item.rangeEnd);
  if (!selectedWords.length) throw new Error("TEST_RANGE_INVALID");
  const insertedBook = await db.insert(wordbooks).values({ title: `${sourceBook.title}（配布）`, subject: sourceBook.subject, visibility: "private", ownerUserId: userId, classroomId: profile.profile.classroomId }).$returningId();
  const receivedWordbookId = insertedBook[0]!.id;
  await db.insert(vocabularyWords).values(selectedWords.map(word => ({ wordbookId: receivedWordbookId, front: word.front, back: word.back, reading: word.reading, imageUrl: word.imageUrl, exampleSentence: word.exampleSentence, exampleTranslation: word.exampleTranslation, source: "admin" as const })));
  await db.insert(recommendedTestClaims).values({ recommendedTestId, userId, receivedWordbookId });
  await writeActivity({ actorUserId: userId, classroomId: profile.profile.classroomId, category: "learning", action: "recommendedTest.wordbookClaimed", details: sourceBook.title });
  return { receivedWordbookId, alreadyClaimed: false } as const;
}

export async function listManageableRecommendedTests(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const scope = await getAnnouncementManagementScope(userId);
  const query = db.select().from(recommendedTests).orderBy(desc(recommendedTests.createdAt));
  const rows = scope.isAdmin ? await query : await query.where(eq(recommendedTests.classroomId, scope.profile!.profile.classroomId));
  return decorateRecommendedTests(rows);
}

export async function deleteRecommendedTest(userId: number, recommendedTestId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const item = (await db.select().from(recommendedTests).where(eq(recommendedTests.id, recommendedTestId)).limit(1))[0];
  if (!item) throw new Error("RECOMMENDED_TEST_NOT_FOUND");
  const scope = await getAnnouncementManagementScope(userId);
  if (!scope.isAdmin && item.classroomId !== scope.profile?.profile.classroomId) throw new Error("CLASSROOM_MANAGER_REQUIRED");
  await db.delete(recommendedTests).where(eq(recommendedTests.id, recommendedTestId));
  await writeActivity({ actorUserId: userId, classroomId: item.classroomId, category: "classroom", action: "recommendedTest.deleted", details: `配信 #${item.id}` });
}

export async function listVisibleWordbooks(userId: number, subject?: "english" | "kanji") {
  const db = await getDb();
  if (!db) return [];
  const membership = await getProfile(userId);
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const isAdmin = account[0]?.role === "admin";
  const visibility = membership
    ? or(eq(wordbooks.visibility, "global"), eq(wordbooks.ownerUserId, userId), and(eq(wordbooks.visibility, "classroom"), eq(wordbooks.classroomId, membership.profile.classroomId)))
    : or(eq(wordbooks.visibility, "global"), eq(wordbooks.ownerUserId, userId));
  const rows = await db.select().from(wordbooks).where(subject ? and(visibility, eq(wordbooks.subject, subject)) : visibility).orderBy(desc(wordbooks.updatedAt));
  return Promise.all(rows.map(async book => {
    const words = await db.select().from(vocabularyWords).where(eq(vocabularyWords.wordbookId, book.id));
    const canManageClassroomMaterial = (membership?.profile.classroomRole === "teacher" || membership?.profile.classroomRole === "owner") && book.classroomId === membership.profile.classroomId;
    const canEdit = isAdmin || (book.visibility === "private" ? book.ownerUserId === userId : canManageClassroomMaterial);
    return { ...book, wordCount: words.length, words, canEdit };
  }));
}

async function getWordbookEditor(userId: number, wordbookId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const book = await db.select().from(wordbooks).where(eq(wordbooks.id, wordbookId)).limit(1);
  if (!book[0]) throw new Error("WORD_BOOK_NOT_FOUND");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const profile = await getProfile(userId);
  const isClassroomMaterial = book[0].visibility === "classroom" || book[0].visibility === "global";
  const canManageClassroomMaterial = (profile?.profile.classroomRole === "teacher" || profile?.profile.classroomRole === "owner") && book[0].classroomId === profile.profile.classroomId;
  const canEdit = account[0]?.role === "admin" || (isClassroomMaterial ? canManageClassroomMaterial : book[0].ownerUserId === userId);
  if (!canEdit) throw new Error("WORD_BOOK_FORBIDDEN");
  return { db, book: book[0], isAdmin: account[0]?.role === "admin", profile };
}

function normalizeVocabularyPair(front: string, back: string) {
  return `${front.normalize("NFKC").trim().toLocaleLowerCase()}\u0000${back.normalize("NFKC").trim().toLocaleLowerCase()}`;
}

export async function createWordbook(userId: number, input: { title: string; subject: "english" | "kanji"; visibility: "private" | "classroom" | "global"; classroomId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const isAdmin = account[0]?.role === "admin";
  const isManager = profile?.profile.classroomRole === "teacher" || profile?.profile.classroomRole === "owner";
  const creationPolicy = await getWordbookCreationPolicy();
  if (creationPolicy.disabled && !isAdmin && !isManager) throw new Error("WORDBOOK_CREATION_DISABLED");
  if ((input.visibility === "classroom" || input.visibility === "global") && !isAdmin && !isManager) throw new Error(profile ? "CLASSROOM_MANAGER_REQUIRED" : "CLASSROOM_REQUIRED");
  if (input.visibility === "global" && !isAdmin) throw new Error("GLOBAL_MANAGER_REQUIRED");
  const classroomId = input.visibility === "global" ? null : input.visibility === "classroom" ? (isAdmin ? input.classroomId : profile?.profile.classroomId) : profile?.profile.classroomId ?? null;
  if (input.visibility === "classroom" && !classroomId) throw new Error("CLASSROOM_REQUIRED");
  const inserted = await db.insert(wordbooks).values({ title: input.title, subject: input.subject, visibility: input.visibility, ownerUserId: userId, classroomId }).$returningId();
  await writeActivity({ actorUserId: userId, classroomId: classroomId ?? undefined, category: "classroom", action: "wordbook.created", details: input.title });
  return inserted[0];
}

export async function addWordToWordbook(userId: number, input: { wordbookId: number; front: string; back: string; reading?: string; source?: "manual" | "csv" | "admin" }) {
  const { db, book } = await getWordbookEditor(userId, input.wordbookId);
  const inserted = await db.insert(vocabularyWords).values({ wordbookId: input.wordbookId, front: input.front, back: input.back, reading: input.reading ?? null, source: input.source ?? "manual" }).$returningId();
  await writeActivity({ actorUserId: userId, classroomId: book.classroomId ?? undefined, category: "classroom", action: "wordbook.word_added", details: input.front });
  return inserted[0];
}

async function getVocabularyWordEditor(userId: number, vocabularyWordId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const row = await db.select().from(vocabularyWords).where(eq(vocabularyWords.id, vocabularyWordId)).limit(1);
  if (!row[0]) throw new Error("WORD_BOOK_NOT_FOUND");
  const editor = await getWordbookEditor(userId, row[0].wordbookId);
  return { ...editor, vocabularyWord: row[0] };
}

export async function updateVocabularyWord(userId: number, vocabularyWordId: number, input: { front?: string; back?: string; reading?: string | null; imageUrl?: string | null; exampleSentence?: string | null; exampleTranslation?: string | null }) {
  const { db, book, vocabularyWord } = await getVocabularyWordEditor(userId, vocabularyWordId);
  await db.update(vocabularyWords).set(input).where(eq(vocabularyWords.id, vocabularyWordId));
  await writeActivity({ actorUserId: userId, classroomId: book.classroomId ?? undefined, category: "classroom", action: "wordbook.word_updated", details: input.front ?? vocabularyWord.front });
}

export async function uploadVocabularyWordImage(userId: number, vocabularyWordId: number, dataUrl: string) {
  const { db, book } = await getVocabularyWordEditor(userId, vocabularyWordId);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("VOCABULARY_IMAGE_INVALID");
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 5_000_000) throw new Error("VOCABULARY_IMAGE_INVALID");
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const uploaded = await storagePut(`vocabulary/${book.id}/${vocabularyWordId}.${extension}`, buffer, contentType);
  await db.update(vocabularyWords).set({ imageUrl: uploaded.url }).where(eq(vocabularyWords.id, vocabularyWordId));
  await writeActivity({ actorUserId: userId, classroomId: book.classroomId ?? undefined, category: "classroom", action: "wordbook.word_image_updated", details: vocabularyWordId.toString() });
  return { imageUrl: uploaded.url };
}

export async function deleteVocabularyWord(userId: number, vocabularyWordId: number) {
  const { db, book, vocabularyWord } = await getVocabularyWordEditor(userId, vocabularyWordId);
  await db.delete(vocabularyWordNotes).where(eq(vocabularyWordNotes.wordId, vocabularyWordId));
  await db.delete(vocabularyWords).where(eq(vocabularyWords.id, vocabularyWordId));
  await writeActivity({ actorUserId: userId, classroomId: book.classroomId ?? undefined, category: "classroom", action: "wordbook.word_deleted", details: vocabularyWord.front });
}

export async function previewWordbookCsv(userId: number, input: { wordbookId: number; csvText: string }) {
  const { db } = await getWordbookEditor(userId, input.wordbookId);
  const [existing, parsed] = await Promise.all([db.select({ front: vocabularyWords.front, back: vocabularyWords.back }).from(vocabularyWords).where(eq(vocabularyWords.wordbookId, input.wordbookId)), Promise.resolve(previewVocabularyRows(input.csvText))]);
  const knownPairs = new Set(existing.map(word => normalizeVocabularyPair(word.front, word.back)));
  const previewPairs = new Set<string>();
  const rows = parsed.map(row => {
    if (!row.valid) return { ...row, duplicate: false };
    const pair = normalizeVocabularyPair(row.front, row.back);
    const duplicate = knownPairs.has(pair) || previewPairs.has(pair);
    previewPairs.add(pair);
    return { ...row, duplicate };
  });
  return { rows, validCount: rows.filter(row => row.valid && !row.duplicate).length, duplicateCount: rows.filter(row => row.duplicate).length, invalidCount: rows.filter(row => !row.valid).length };
}

export async function importWordbookCsv(userId: number, input: { wordbookId: number; csvText: string }) {
  const { db, book } = await getWordbookEditor(userId, input.wordbookId);
  const preview = await previewWordbookCsv(userId, input);
  if (preview.invalidCount) throw new Error("CSV_INVALID_ROWS");
  const accepted = preview.rows.filter(row => row.valid && !row.duplicate).map(row => ({ wordbookId: input.wordbookId, front: row.front, back: row.back, source: "csv" as const }));
  if (accepted.length) await db.insert(vocabularyWords).values(accepted);
  if (accepted.length) await writeActivity({ actorUserId: userId, classroomId: book.classroomId ?? undefined, category: "classroom", action: "wordbook.csv_imported", details: `${accepted.length}語` });
  return { importedCount: accepted.length, skippedCount: preview.duplicateCount };
}

export async function exportWordbookCsv(userId: number, wordbookId: number) {
  const { db, book } = await getWordbookEditor(userId, wordbookId);
  const words = await db.select({ front: vocabularyWords.front, back: vocabularyWords.back, reading: vocabularyWords.reading }).from(vocabularyWords).where(eq(vocabularyWords.wordbookId, wordbookId)).orderBy(vocabularyWords.id);
  return { title: book.title, words };
}

export async function downloadVisibleWordbookCsv(userId: number, wordbookId: number) {
  const book = (await listVisibleWordbooks(userId)).find(item => item.id === wordbookId);
  if (!book) throw new Error("WORD_BOOK_NOT_FOUND");
  return { title: book.title, words: book.words.map(word => ({ front: word.front, back: word.back, reading: word.reading })) };
}

export async function listManageableWordbooks(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const profile = await getProfile(userId);
  const canManage = account[0]?.role === "admin" || profile?.profile.classroomRole === "teacher" || profile?.profile.classroomRole === "owner";
  if (!canManage) throw new Error(profile ? "CLASSROOM_MANAGER_REQUIRED" : "CLASSROOM_REQUIRED");
  const where = account[0]?.role === "admin"
    ? or(eq(wordbooks.visibility, "classroom"), eq(wordbooks.visibility, "global"))
    : and(or(eq(wordbooks.visibility, "classroom"), eq(wordbooks.visibility, "global")), eq(wordbooks.classroomId, profile!.profile.classroomId));
  const query = db.select().from(wordbooks).orderBy(desc(wordbooks.updatedAt));
  const rows = where ? await query.where(where) : await query;
  return Promise.all(rows.map(async book => {
    const words = await db.select({ id: vocabularyWords.id, front: vocabularyWords.front, back: vocabularyWords.back, reading: vocabularyWords.reading, imageUrl: vocabularyWords.imageUrl, exampleSentence: vocabularyWords.exampleSentence, exampleTranslation: vocabularyWords.exampleTranslation }).from(vocabularyWords).where(eq(vocabularyWords.wordbookId, book.id)).orderBy(vocabularyWords.id);
    return { ...book, wordCount: words.length, words };
  }));
}

export async function updateWordbook(userId: number, wordbookId: number, input: { title?: string; visibility?: "private" | "classroom" }) {
  const { db, book, isAdmin, profile } = await getWordbookEditor(userId, wordbookId);
  if (input.visibility === "classroom" && !isAdmin && profile?.profile.classroomRole !== "teacher" && profile?.profile.classroomRole !== "owner") throw new Error("CLASSROOM_MANAGER_REQUIRED");
  await db.update(wordbooks).set({ title: input.title, visibility: input.visibility }).where(eq(wordbooks.id, wordbookId));
  await writeActivity({ actorUserId: userId, classroomId: book.classroomId ?? undefined, category: "classroom", action: "wordbook.updated", details: input.title ?? book.title });
}

export async function deleteWordbook(userId: number, wordbookId: number) {
  const { db, book } = await getWordbookEditor(userId, wordbookId);
  const wordIds = await db.select({ id: vocabularyWords.id }).from(vocabularyWords).where(eq(vocabularyWords.wordbookId, wordbookId));
  if (wordIds.length) await db.delete(vocabularyWordNotes).where(inArray(vocabularyWordNotes.wordId, wordIds.map(word => word.id)));
  await db.delete(vocabularyWords).where(eq(vocabularyWords.wordbookId, wordbookId));
  await db.delete(wordbooks).where(eq(wordbooks.id, wordbookId));
  await writeActivity({ actorUserId: userId, classroomId: book.classroomId ?? undefined, category: "classroom", action: "wordbook.deleted", details: book.title });
}

export type PracticeRating = "known" | "review" | "instant" | "slow";

export async function recordLearningResult(userId: number, input: { wordId?: number; mode: "practice" | "test" | "journal" | "ai_select"; isCorrect: boolean; practiceRating?: PracticeRating }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  const practiceRating = input.practiceRating ?? (input.isCorrect ? "known" : "review");
  await db.insert(studyRecords).values({ userId, classroomId: profile.profile.classroomId, wordId: input.wordId ?? null, mode: input.mode, isCorrect: input.isCorrect, practiceRating });
  await writeActivity({ actorUserId: userId, classroomId: profile.profile.classroomId, category: "learning", action: `answer.${input.mode}`, details: input.isCorrect ? "correct" : "review" });
}

export async function listReviewWords(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const records = await db.select({ id: studyRecords.id, wordId: studyRecords.wordId, isCorrect: studyRecords.isCorrect, practiceRating: studyRecords.practiceRating, answeredAt: studyRecords.answeredAt }).from(studyRecords).where(and(eq(studyRecords.userId, userId), isNotNull(studyRecords.wordId))).orderBy(desc(studyRecords.answeredAt), desc(studyRecords.id)).limit(300);
  const latestByWord = new Map<number, { isCorrect: boolean; practiceRating: PracticeRating; answeredAt: Date }>();
  for (const record of records) if (record.wordId !== null && !latestByWord.has(record.wordId)) latestByWord.set(record.wordId, { isCorrect: record.isCorrect, practiceRating: record.practiceRating, answeredAt: record.answeredAt });
  const reviewIds = Array.from(latestByWord.entries()).filter(([, latest]) => !latest.isCorrect || latest.practiceRating === "review" || latest.practiceRating === "slow").map(([wordId]) => wordId);
  if (!reviewIds.length) return [];
  const words = await db.select().from(vocabularyWords).where(inArray(vocabularyWords.id, reviewIds));
  return words.map(word => ({ ...word, practiceRating: latestByWord.get(word.id)?.practiceRating ?? "review", missedAt: latestByWord.get(word.id)?.answeredAt ?? new Date(0) }));
}

export async function getLearningDashboard(userId: number) {
  const db = await getDb();
  if (!db) return { wordbooks: [], reviewWords: [], unstartedSets: [], mistakeCounts: [], practiceRatings: [] };
  const [books, sets, records] = await Promise.all([
    listVisibleWordbooks(userId),
    listSavedStudySets(userId),
    db.select({ id: studyRecords.id, wordId: studyRecords.wordId, mode: studyRecords.mode, isCorrect: studyRecords.isCorrect, practiceRating: studyRecords.practiceRating, answeredAt: studyRecords.answeredAt }).from(studyRecords).where(and(eq(studyRecords.userId, userId), isNotNull(studyRecords.wordId))).orderBy(desc(studyRecords.answeredAt), desc(studyRecords.id)).limit(1_000),
  ]);
  const latestByWord = new Map<number, { isCorrect: boolean; practiceRating: PracticeRating; answeredAt: Date }>();
  const latestPracticeRatingByWord = new Map<number, PracticeRating>();
  const attemptsByWord = new Map<number, Array<{ isCorrect: boolean; practiceRating: PracticeRating }>>();
  for (const record of records) {
    if (record.wordId === null) continue;
    if (!latestByWord.has(record.wordId)) latestByWord.set(record.wordId, { isCorrect: record.isCorrect, practiceRating: record.practiceRating, answeredAt: record.answeredAt });
    if (record.mode === "practice" && !latestPracticeRatingByWord.has(record.wordId)) latestPracticeRatingByWord.set(record.wordId, record.practiceRating);
    const attempts = attemptsByWord.get(record.wordId) ?? [];
    attempts.push({ isCorrect: record.isCorrect, practiceRating: record.practiceRating });
    attemptsByWord.set(record.wordId, attempts);
  }
  const wordsById = new Map(books.flatMap(book => book.words.map(word => [word.id, { ...word, wordbookId: book.id, wordbookTitle: book.title }] as const)));
  const wordbooks = books.map(book => {
    const wordIds = book.words.map(word => word.id);
    const studiedWordCount = wordIds.filter(wordId => latestByWord.has(wordId)).length;
    const masteredWordCount = wordIds.filter(wordId => latestByWord.get(wordId)?.isCorrect).length;
    const attempts = wordIds.flatMap(wordId => attemptsByWord.get(wordId) ?? []);
    const correctAttempts = attempts.filter(attempt => attempt.isCorrect).length;
    return { id: book.id, title: book.title, subject: book.subject, visibility: book.visibility, wordCount: wordIds.length, studiedWordCount, masteredWordCount, progressPercent: wordIds.length ? Math.round((masteredWordCount / wordIds.length) * 100) : 0, accuracyPercent: attempts.length ? Math.round((correctAttempts / attempts.length) * 100) : 0 };
  });
  const reviewWords = Array.from(latestByWord.entries()).filter(([, latest]) => !latest.isCorrect || latest.practiceRating === "review" || latest.practiceRating === "slow").map(([wordId, latest]) => {
    const word = wordsById.get(wordId);
    return word ? { ...word, practiceRating: latest.practiceRating, missedAt: latest.answeredAt } : null;
  }).filter((word): word is NonNullable<typeof word> => Boolean(word)).slice(0, 5);
  const unstartedSets = sets.filter(set => set.words.length > 0 && set.words.every(word => !latestByWord.has(word.id))).slice(0, 3).map(set => ({ id: set.id, label: set.label, wordbookId: set.wordbookId, wordbookTitle: set.wordbookTitle, wordCount: set.words.length }));
  const mistakeCounts = Array.from(attemptsByWord.entries()).map(([wordId, attempts]) => ({ wordId, mistakeCount: attempts.filter(attempt => !attempt.isCorrect || attempt.practiceRating === "review" || attempt.practiceRating === "slow").length })).filter(item => item.mistakeCount > 0);
  const practiceRatings = Array.from(latestPracticeRatingByWord.entries()).map(([wordId, rating]) => ({ wordId, rating }));
  return { wordbooks, reviewWords, unstartedSets, mistakeCounts, practiceRatings };
}

export async function recordFocusSession(userId: number, input: { clientSessionId: string; startedAt: Date; completedAt: Date; focusSeconds: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  const existing = await db.select({ userId: focusSessions.userId }).from(focusSessions).where(eq(focusSessions.clientSessionId, input.clientSessionId)).limit(1);
  if (existing[0]) {
    if (existing[0].userId !== userId) throw new Error("FOCUS_SESSION_CONFLICT");
    return { saved: false } as const;
  }
  await db.insert(focusSessions).values({ userId, classroomId: profile.profile.classroomId, ...input });
  await writeActivity({ actorUserId: userId, classroomId: profile.profile.classroomId, category: "learning", action: "focus.completed", details: `${input.focusSeconds}s` });
  return { saved: true } as const;
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

type MonsterEggNumber = "1" | "2" | "3";

async function createInitialMonsterProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const egg = await db.insert(monsterEggs).values({ userId, eggNumber: "1", source: "starter", consumedAt: new Date() }).$returningId();
  const profile = await db.insert(monsterProfiles).values({ userId, eggNumber: "1", active: true }).$returningId();
  const profileId = profile[0]?.id;
  if (!profileId) throw new Error("MONSTER_PROFILE_CREATE_FAILED");
  if (egg[0]?.id) await db.update(monsterEggs).set({ monsterProfileId: profileId }).where(eq(monsterEggs.id, egg[0].id));
  return (await db.select().from(monsterProfiles).where(eq(monsterProfiles.id, profileId)).limit(1))[0];
}

async function ensureMonsterEgg(userId: number, eggNumber: MonsterEggNumber, source: "focus_260" | "focus_520") {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const existing = await db.select().from(monsterEggs).where(and(eq(monsterEggs.userId, userId), eq(monsterEggs.source, source))).limit(1);
  if (!existing[0]) await db.insert(monsterEggs).values({ userId, eggNumber, source });
}

export async function getMonsterDashboard(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [sessions, records, activities, claims, profiles] = await Promise.all([
    db.select().from(focusSessions).where(eq(focusSessions.userId, userId)),
    db.select().from(studyRecords).where(eq(studyRecords.userId, userId)).orderBy(desc(studyRecords.answeredAt)),
    db.select({ action: activityLogs.action, details: activityLogs.details, createdAt: activityLogs.createdAt }).from(activityLogs).where(eq(activityLogs.actorUserId, userId)).orderBy(desc(activityLogs.createdAt)),
    db.select().from(monsterMissionClaims).where(eq(monsterMissionClaims.userId, userId)),
    db.select().from(monsterProfiles).where(eq(monsterProfiles.userId, userId)).orderBy(desc(monsterProfiles.createdAt)),
  ]);
  const totalFocusSeconds = sessions.reduce((sum, session) => sum + session.focusSeconds, 0);
  if (totalFocusSeconds >= 260 * 60 * 60) await ensureMonsterEgg(userId, "2", "focus_260");
  if (totalFocusSeconds >= 520 * 60 * 60) await ensureMonsterEgg(userId, "3", "focus_520");
  let active = profiles.find(profile => profile.active);
  if (!active) active = await createInitialMonsterProfile(userId);
  if (!active) throw new Error("MONSTER_PROFILE_NOT_FOUND");
  const allProfiles = profiles.some(profile => profile.id === active!.id) ? profiles : [active, ...profiles];
  const mission = buildMissionState({ startedAt: active.startedAt, records, activities });
  const claimedKeys = new Set(claims.map(claim => `${claim.missionKey}:${claim.periodKey}`));
  const claimedPointsSinceStart = claims.filter(claim => claim.claimedAt >= active!.startedAt).reduce((sum, claim) => sum + claim.points, 0);
  const focusSessionsSinceStart = sessions.filter(session => session.completedAt >= active!.startedAt);
  const focusSecondsSinceStart = focusSessionsSinceStart.reduce((sum, session) => sum + session.focusSeconds, 0);
  const activeProgress = calculateMonsterStage(focusSecondsSinceStart, claimedPointsSinceStart);
  let activeCompletedAt = active.completedAt;
  if (activeProgress.stage === 13 && !active.completedAt) {
    const now = new Date();
    const latestFocusCompletedAt = focusSessionsSinceStart.reduce<Date | null>((latest, session) => !latest || session.completedAt > latest ? session.completedAt : latest, null);
    activeCompletedAt = latestFocusCompletedAt && latestFocusCompletedAt > now ? latestFocusCompletedAt : now;
    await db.update(monsterProfiles).set({ completedAt: activeCompletedAt }).where(eq(monsterProfiles.id, active.id));
  }
  const eggs = await db.select().from(monsterEggs).where(eq(monsterEggs.userId, userId)).orderBy(desc(monsterEggs.acquiredAt));
  const images = await db.select().from(monsterImageSettings).orderBy(monsterImageSettings.slotKey);
  const history = allProfiles.map(profile => {
    const profileFocus = sessions.filter(session => session.completedAt >= profile.startedAt && (!profile.completedAt || session.completedAt <= profile.completedAt)).reduce((sum, session) => sum + session.focusSeconds, 0);
    const profilePoints = claims.filter(claim => claim.claimedAt >= profile.startedAt && (!profile.completedAt || claim.claimedAt <= profile.completedAt)).reduce((sum, claim) => sum + claim.points, 0);
    return { ...profile, progression: calculateMonsterStage(profileFocus, profilePoints) };
  });
  const eggNumbers: MonsterEggNumber[] = ["1", "2", "3"];
  const completedEggNumbers = new Set(history.filter(profile => profile.progression.stage === 13).map(profile => profile.eggNumber));
  const allThreeCompleted = eggNumbers.every(eggNumber => completedEggNumbers.has(eggNumber));
  const completionCounts = new Map<MonsterEggNumber, number>(eggNumbers.map(eggNumber => [eggNumber, history.filter(profile => profile.eggNumber === eggNumber && profile.progression.stage === 13).length]));
  const nextCycleEggNumber = allThreeCompleted ? [...eggNumbers].sort((left, right) => (completionCounts.get(left) ?? 0) - (completionCounts.get(right) ?? 0) || Number(left) - Number(right))[0] : null;
  return { active: { ...active, completedAt: activeCompletedAt, progression: activeProgress }, totalFocusSeconds, claimedPoints: claimedPointsSinceStart, eggs, history, images, completedEggNumbers: Array.from(completedEggNumbers), allThreeCompleted, nextCycleEggNumber, mission: { daily: { ...mission.daily, periodKey: mission.today }, monthly: { ...mission.monthly, periodKey: mission.month }, claimable: mission.rewards.filter(reward => !claimedKeys.has(`${reward.missionKey}:${reward.periodKey}`)), claimedKeys: Array.from(claimedKeys) } };
}

export async function claimMonsterMission(userId: number, missionKey: string, periodKey: string) {
  const dashboard = await getMonsterDashboard(userId);
  const reward = [...dashboard.mission.daily.rewards, ...dashboard.mission.monthly.rewards].find(item => item.missionKey === missionKey && item.periodKey === periodKey);
  if (!reward) throw new Error("MONSTER_MISSION_NOT_READY");
  if (dashboard.mission.claimedKeys.includes(`${missionKey}:${periodKey}`)) throw new Error("MONSTER_MISSION_ALREADY_CLAIMED");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(monsterMissionClaims).values({ userId, missionKey, periodKey, points: reward.points });
  const profile = await getProfile(userId);
  await writeActivity({ actorUserId: userId, classroomId: profile?.profile.classroomId, category: "learning", action: "monster.mission_claimed", details: reward.label });
  return { points: reward.points, label: reward.label };
}

export async function claimAvailableMonsterMissions(userId: number) {
  const dashboard = await getMonsterDashboard(userId);
  const rewards = dashboard.mission.claimable;
  if (!rewards.length) return { claims: [], totalPoints: 0 } as const;
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.transaction(async tx => {
    for (const reward of rewards) await tx.insert(monsterMissionClaims).values({ userId, missionKey: reward.missionKey, periodKey: reward.periodKey, points: reward.points });
  });
  const profile = await getProfile(userId);
  await writeActivity({ actorUserId: userId, classroomId: profile?.profile.classroomId, category: "learning", action: "monster.missions_claimed", details: `${rewards.length}件` });
  return { claims: rewards, totalPoints: rewards.reduce((sum, reward) => sum + reward.points, 0) };
}

export async function recordAiSelectCompletion(userId: number, subject: "english" | "kanji") {
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  await writeActivity({ actorUserId: userId, classroomId: profile.profile.classroomId, category: "learning", action: "ai_select.completed", details: subject });
}

export async function startNewMonster(userId: number, eggNumber: MonsterEggNumber) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const dashboard = await getMonsterDashboard(userId);
  if (dashboard.active.progression.stage !== 13) throw new Error("MONSTER_NOT_COMPLETE");
  let egg = dashboard.eggs.find(item => item.eggNumber === eggNumber && !item.consumedAt);
  if (dashboard.allThreeCompleted) {
    if (dashboard.nextCycleEggNumber !== eggNumber) throw new Error("MONSTER_CYCLE_ORDER_REQUIRED");
    const createdEgg = await db.insert(monsterEggs).values({ userId, eggNumber, source: "completion" }).$returningId();
    const createdEggId = createdEgg[0]?.id;
    if (!createdEggId) throw new Error("MONSTER_EGG_CREATE_FAILED");
    egg = (await db.select().from(monsterEggs).where(eq(monsterEggs.id, createdEggId)).limit(1))[0];
  }
  if (!egg) throw new Error("MONSTER_EGG_UNAVAILABLE");
  await db.update(monsterProfiles).set({ active: false, completedAt: dashboard.active.completedAt ?? new Date() }).where(eq(monsterProfiles.id, dashboard.active.id));
  // MySQL timestamp columns can be second precision. Start from the next second so
  // sessions completed immediately before the egg exchange never count toward the new monster.
  const created = await db.insert(monsterProfiles).values({ userId, eggNumber, active: true, startedAt: new Date(Date.now() + 1_000) }).$returningId();
  const profileId = created[0]?.id;
  if (!profileId) throw new Error("MONSTER_PROFILE_CREATE_FAILED");
  await db.update(monsterEggs).set({ consumedAt: new Date(), monsterProfileId: profileId }).where(eq(monsterEggs.id, egg.id));
  return { profileId };
}

export async function uploadMonsterImage(userId: number, input: { slotKey: string; imageType: "egg" | "evolution"; eggNumber?: number; evolutionStage?: number; dataUrl: string }) {
  await requireGlobalAdmin(userId);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(input.dataUrl);
  if (!match) throw new Error("MONSTER_IMAGE_INVALID");
  const contentType = match[1]; const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 5_000_000) throw new Error("MONSTER_IMAGE_INVALID");
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const uploaded = await storagePut(`monsters/${input.slotKey}.${extension}`, buffer, contentType);
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(monsterImageSettings).values({ slotKey: input.slotKey, imageType: input.imageType, eggNumber: input.eggNumber ?? null, evolutionStage: input.evolutionStage ?? null, imageUrl: uploaded.url, updatedByUserId: userId }).onDuplicateKeyUpdate({ set: { imageType: input.imageType, eggNumber: input.eggNumber ?? null, evolutionStage: input.evolutionStage ?? null, imageUrl: uploaded.url, updatedByUserId: userId, updatedAt: new Date() } });
  return { url: uploaded.url };
}

export async function listMonsterImageSettings(userId: number) {
  await requireGlobalAdmin(userId);
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.select().from(monsterImageSettings).orderBy(monsterImageSettings.slotKey);
}

type LearningTrendPeriod = "day" | "week" | "month";

function startOfUtcDay(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
function startOfUtcWeek(date: Date) { const start = startOfUtcDay(date); start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)); return start; }
function startOfUtcMonth(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); }
function getTrendKey(date: Date, period: LearningTrendPeriod) { const start = period === "day" ? startOfUtcDay(date) : period === "week" ? startOfUtcWeek(date) : startOfUtcMonth(date); return start.toISOString().slice(0, 10); }
function createTrendBuckets(period: LearningTrendPeriod) {
  const count = period === "day" ? 7 : period === "week" ? 8 : 12;
  const now = new Date(); const start = period === "day" ? startOfUtcDay(now) : period === "week" ? startOfUtcWeek(now) : startOfUtcMonth(now);
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(start);
    if (period === "day") date.setUTCDate(date.getUTCDate() - (count - 1 - offset));
    else if (period === "week") date.setUTCDate(date.getUTCDate() - 7 * (count - 1 - offset));
    else date.setUTCMonth(date.getUTCMonth() - (count - 1 - offset));
    const label = period === "month" ? `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}` : `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
    return { key: date.toISOString().slice(0, 10), label, focusMinutes: 0, answers: 0, correct: 0, accuracy: 0 };
  });
}

export async function getLearningTrend(userId: number, period: LearningTrendPeriod) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [sessions, records] = await Promise.all([db.select().from(focusSessions).where(eq(focusSessions.userId, userId)), db.select().from(studyRecords).where(eq(studyRecords.userId, userId))]);
  const points = createTrendBuckets(period); const byKey = new Map(points.map(point => [point.key, point]));
  for (const session of sessions) { const point = byKey.get(getTrendKey(session.completedAt, period)); if (point) point.focusMinutes += session.focusSeconds / 60; }
  for (const record of records) { const point = byKey.get(getTrendKey(record.answeredAt, period)); if (point) { point.answers += 1; if (record.isCorrect) point.correct += 1; } }
  return points.map(({ correct, ...point }) => ({ ...point, focusMinutes: Math.round(point.focusMinutes * 10) / 10, accuracy: point.answers ? Math.round((correct / point.answers) * 100) : 0 }));
}

export async function getManagementInsights(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const profile = await getProfile(userId);
  if (account[0]?.role !== "admin" && profile?.profile.classroomRole !== "owner" && profile?.profile.classroomRole !== "teacher") throw new Error("GLOBAL_MANAGER_REQUIRED");
  const classroomFilter = account[0]?.role === "admin" ? undefined : profile?.profile.classroomId;
  const [members, sessions, records, logs] = await Promise.all([
    db.select().from(studentProfiles), db.select().from(focusSessions), db.select().from(studyRecords), db.select({ log: activityLogs, actorName: users.name, classroomName: classrooms.name }).from(activityLogs).leftJoin(users, eq(activityLogs.actorUserId, users.id)).leftJoin(classrooms, eq(activityLogs.classroomId, classrooms.id)).orderBy(desc(activityLogs.createdAt)).limit(40),
  ]);
  const include = (classroomId: number) => classroomFilter === undefined || classroomId === classroomFilter;
  const scopedMembers = members.filter(member => member.classroomRole === "student" && include(member.classroomId)); const scopedSessions = sessions.filter(session => include(session.classroomId)); const scopedRecords = records.filter(record => include(record.classroomId));
  const totalFocusSeconds = scopedSessions.reduce((sum, session) => sum + session.focusSeconds, 0);
  const correct = scopedRecords.filter(record => record.isCorrect).length;
  return { memberCount: scopedMembers.length, totalFocusSeconds, answers: scopedRecords.length, retention: scopedRecords.length ? Math.round((correct / scopedRecords.length) * 100) : 0, recentActivities: logs.filter(row => classroomFilter === undefined ? true : row.log.classroomId !== null && include(row.log.classroomId)).map(row => ({ id: row.log.id, category: row.log.category, action: row.log.action, details: row.log.details, createdAt: row.log.createdAt, actorName: row.actorName ?? "管理者", classroomName: row.classroomName ?? "全体" })) };
}

const japanDateKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);

export async function listSavedStudySets(userId: number) {
  const db = await getDb(); if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [sets, books] = await Promise.all([db.select().from(savedStudySets).where(eq(savedStudySets.userId, userId)).orderBy(desc(savedStudySets.updatedAt)), listVisibleWordbooks(userId)]);
  return sets.map(set => { const book = books.find(item => item.id === set.wordbookId); return book ? { ...set, wordbookTitle: book.title, subject: book.subject, words: book.words.slice(set.rangeStart - 1, set.rangeEnd) } : null; }).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function saveStudySet(userId: number, input: { wordbookId: number; rangeStart: number; rangeEnd: number; label: string }) {
  const books = await listVisibleWordbooks(userId); const book = books.find(item => item.id === input.wordbookId);
  if (!book) throw new Error("WORD_BOOK_FORBIDDEN");
  if (input.rangeStart < 1 || input.rangeEnd < input.rangeStart || input.rangeEnd > book.words.length) throw new Error("STUDY_SET_RANGE_INVALID");
  const db = await getDb(); if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const created = await db.insert(savedStudySets).values({ userId, ...input, label: input.label.trim() || `${book.title} 第${input.rangeStart}〜${input.rangeEnd}語` }).$returningId();
  return created[0];
}

export async function deleteSavedStudySet(userId: number, savedStudySetId: number) { const db = await getDb(); if (!db) throw new Error("DATABASE_UNAVAILABLE"); await db.delete(savedStudySets).where(and(eq(savedStudySets.id, savedStudySetId), eq(savedStudySets.userId, userId))); }

export async function updateOwnDisplayName(userId: number, displayName: string) { const profile = await getProfile(userId); if (!profile) throw new Error("CLASSROOM_REQUIRED"); const normalized = displayName.trim(); if (!normalized || normalized.length > 80) throw new Error("DISPLAY_NAME_INVALID"); const db = await getDb(); if (!db) throw new Error("DATABASE_UNAVAILABLE"); await db.update(studentProfiles).set({ displayName: normalized }).where(eq(studentProfiles.id, profile.profile.id)); return { displayName: normalized }; }

export async function uploadOwnAvatar(userId: number, dataUrl: string) {
  const profile = await getProfile(userId);
  if (!profile) throw new Error("CLASSROOM_REQUIRED");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("PROFILE_IMAGE_INVALID");
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 3_000_000) throw new Error("PROFILE_IMAGE_INVALID");
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const uploaded = await storagePut(`profiles/${profile.profile.id}/avatar.${extension}`, buffer, contentType);
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.update(studentProfiles).set({ avatarUrl: uploaded.url }).where(eq(studentProfiles.id, profile.profile.id));
  return { avatarUrl: uploaded.url };
}

export async function listVocabularyWordNotes(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.select({ wordId: vocabularyWordNotes.wordId, note: vocabularyWordNotes.note, updatedAt: vocabularyWordNotes.updatedAt }).from(vocabularyWordNotes).where(eq(vocabularyWordNotes.userId, userId));
}

export async function saveVocabularyWordNote(userId: number, wordId: number, note: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const visibleBooks = await listVisibleWordbooks(userId);
  if (!visibleBooks.some(book => book.words.some(word => word.id === wordId))) throw new Error("WORD_BOOK_FORBIDDEN");
  const normalized = note.trim();
  if (!normalized) {
    await db.delete(vocabularyWordNotes).where(and(eq(vocabularyWordNotes.userId, userId), eq(vocabularyWordNotes.wordId, wordId)));
    return { wordId, note: "" };
  }
  await db.insert(vocabularyWordNotes).values({ userId, wordId, note: normalized }).onDuplicateKeyUpdate({ set: { note: normalized, updatedAt: new Date() } });
  return { wordId, note: normalized };
}

export async function listClassroomOnlineStatus(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const viewer = await getProfile(userId);
  if (!viewer) throw new Error("CLASSROOM_REQUIRED");
  const now = new Date();
  const todayKey = japanDateKey(now);
  const todayStart = new Date(`${todayKey}T00:00:00+09:00`);
  const [members, sessions, focusRows, answerRows] = await Promise.all([
    db.select({ id: studentProfiles.id, userId: studentProfiles.userId, displayName: studentProfiles.displayName, avatarUrl: studentProfiles.avatarUrl, classroomRole: studentProfiles.classroomRole }).from(studentProfiles).where(eq(studentProfiles.classroomId, viewer.profile.classroomId)),
    db.select({ userId: pinSessions.userId, lastSeenAt: pinSessions.lastSeenAt }).from(pinSessions).where(and(eq(pinSessions.classroomId, viewer.profile.classroomId), isNull(pinSessions.revokedAt), gt(pinSessions.expiresAt, now))),
    db.select({ userId: focusSessions.userId, focusSeconds: focusSessions.focusSeconds }).from(focusSessions).where(and(eq(focusSessions.classroomId, viewer.profile.classroomId), gte(focusSessions.completedAt, todayStart))),
    db.select({ userId: studyRecords.userId, wordId: studyRecords.wordId, practiceRating: studyRecords.practiceRating }).from(studyRecords).where(and(eq(studyRecords.classroomId, viewer.profile.classroomId), gte(studyRecords.answeredAt, todayStart), isNotNull(studyRecords.wordId))),
  ]);
  const lastSeenByUser = new Map<number, Date>();
  for (const session of sessions) { const previous = lastSeenByUser.get(session.userId); if (!previous || session.lastSeenAt > previous) lastSeenByUser.set(session.userId, session.lastSeenAt); }
  const focusByUser = new Map<number, number>();
  for (const session of focusRows) focusByUser.set(session.userId, (focusByUser.get(session.userId) ?? 0) + session.focusSeconds);
  const masteredByUser = new Map<number, Set<number>>();
  for (const record of answerRows) if (record.wordId !== null && (record.practiceRating === "known" || record.practiceRating === "instant")) { const ids = masteredByUser.get(record.userId) ?? new Set<number>(); ids.add(record.wordId); masteredByUser.set(record.userId, ids); }
  const rows = await Promise.all(members.map(async member => {
    const lastSeenAt = lastSeenByUser.get(member.userId) ?? null;
    const monster = await getMonsterDashboard(member.userId);
    return { profileId: member.id, userId: member.userId, displayName: member.displayName, avatarUrl: member.avatarUrl, classroomRole: member.classroomRole, isSelf: member.userId === userId, online: Boolean(lastSeenAt && now.getTime() - lastSeenAt.getTime() <= 90_000), lastSeenAt, todayFocusSeconds: focusByUser.get(member.userId) ?? 0, todayMasteredWords: masteredByUser.get(member.userId)?.size ?? 0, monster: { eggNumber: monster.active.eggNumber, stage: monster.active.progression.stage } };
  }));
  return { classroom: { id: viewer.classroom.id, name: viewer.classroom.name }, members: rows.sort((left, right) => Number(right.online) - Number(left.online) || (right.lastSeenAt?.getTime() ?? 0) - (left.lastSeenAt?.getTime() ?? 0)) };
}

export async function getCalendarDashboard(userId: number) {
  const db = await getDb(); if (!db) throw new Error("DATABASE_UNAVAILABLE"); const profile = await getProfile(userId); if (!profile) throw new Error("CLASSROOM_REQUIRED");
  const [sessions, records, events, restored] = await Promise.all([db.select().from(focusSessions).where(eq(focusSessions.userId, userId)), db.select().from(studyRecords).where(eq(studyRecords.userId, userId)), listVisibleCalendarEvents(userId), db.select().from(revivalDays).where(eq(revivalDays.userId, userId))]);
  const days = new Map<string, { focusSeconds: number; answers: number; events: Array<{ id: number; title: string; startsAt: Date; endsAt: Date | null }> }>();
  for (const session of sessions) { const key = japanDateKey(session.completedAt); const day = days.get(key) ?? { focusSeconds: 0, answers: 0, events: [] }; day.focusSeconds += session.focusSeconds; days.set(key, day); }
  for (const record of records) { const key = japanDateKey(record.answeredAt); const day = days.get(key) ?? { focusSeconds: 0, answers: 0, events: [] }; day.answers += 1; days.set(key, day); }
  for (const event of events) { const key = japanDateKey(event.startsAt); const day = days.get(key) ?? { focusSeconds: 0, answers: 0, events: [] }; day.events.push({ id: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt }); days.set(key, day); }
  return { days: Array.from(days, ([dateKey, value]) => ({ dateKey, ...value, revived: restored.some((item: { dateKey: string }) => item.dateKey === dateKey) })), revivalTickets: profile.profile.revivalTickets, futureEvents: (events as Array<{ id: number; title: string; startsAt: Date; endsAt: Date | null }>).filter((event) => event.startsAt >= new Date()).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()) };
}

export async function useRevivalTicket(userId: number, dateKey: string) { const profile = await getProfile(userId); if (!profile) throw new Error("CLASSROOM_REQUIRED"); if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("REVIVAL_DATE_INVALID"); if (profile.profile.revivalTickets < 1) throw new Error("REVIVAL_TICKET_EMPTY"); const db = await getDb(); if (!db) throw new Error("DATABASE_UNAVAILABLE"); await db.insert(revivalDays).values({ userId, dateKey }); await db.update(studentProfiles).set({ revivalTickets: profile.profile.revivalTickets - 1 }).where(eq(studentProfiles.id, profile.profile.id)); }

export async function resetRevivalTickets(actorUserId: number, profileId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const target = await db.select().from(studentProfiles).where(eq(studentProfiles.id, profileId)).limit(1);
  if (!target[0]) throw new Error("PROFILE_NOT_FOUND");
  const account = await db.select({ role: users.role }).from(users).where(eq(users.id, actorUserId)).limit(1);
  const membership = await getProfile(actorUserId);
  const permissionInput = { siteRole: account[0]?.role, classroomRole: membership?.profile.classroomRole, actorClassroomId: membership?.profile.classroomId, targetClassroomId: target[0].classroomId } as const;
  if (!membership && account[0]?.role !== "admin") throw new Error("CLASSROOM_REQUIRED");
  if (!canManageClassroom(permissionInput)) throw new Error("CLASSROOM_MANAGER_REQUIRED");
  await db.update(studentProfiles).set({ revivalTickets: 2 }).where(eq(studentProfiles.id, profileId));
  await writeActivity({ actorUserId, classroomId: target[0].classroomId, category: "member", action: "revival_tickets.reset", details: `profile:${profileId}` });
  return { revivalTickets: 2 };
}


export type SmartNotificationDirection = "question" | "answer";

const NOTIFICATION_TIME_ZONE = "Asia/Tokyo";
const NOTIFICATION_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isWithinSmartNotificationWindow(date: Date, startTime: string, endTime: string, timeZone = NOTIFICATION_TIME_ZONE) {
  if (!NOTIFICATION_TIME_PATTERN.test(startTime) || !NOTIFICATION_TIME_PATTERN.test(endTime)) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const rawHour = Number(parts.find(part => part.type === "hour")?.value ?? 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? 0);
  const current = hour * 60 + minute;
  const parse = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const start = parse(startTime);
  const end = parse(endTime);
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export async function getSmartNotificationSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(smartNotificationSettings).where(eq(smartNotificationSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function saveSmartNotificationSettings(userId: number, input: { wordbookId: number; direction: SmartNotificationDirection; enabled: boolean; startTime?: string; endTime?: string }) {
  if (input.startTime !== undefined && !NOTIFICATION_TIME_PATTERN.test(input.startTime)) throw new Error("SMART_NOTIFICATION_TIME_INVALID");
  if (input.endTime !== undefined && !NOTIFICATION_TIME_PATTERN.test(input.endTime)) throw new Error("SMART_NOTIFICATION_TIME_INVALID");
  const visibleBooks = await listVisibleWordbooks(userId);
  if (!visibleBooks.some(book => book.id === input.wordbookId)) throw new Error("SMART_NOTIFICATION_WORDBOOK_FORBIDDEN");
  const existing = await getSmartNotificationSettings(userId);
  const startTime = input.startTime ?? existing?.startTime ?? "08:00";
  const endTime = input.endTime ?? existing?.endTime ?? "21:00";
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const values = { userId, wordbookId: input.wordbookId, direction: input.direction, startTime, endTime, enabled: input.enabled } as const;
  await db.insert(smartNotificationSettings).values(values).onDuplicateKeyUpdate({ set: { wordbookId: input.wordbookId, direction: input.direction, startTime, endTime, enabled: input.enabled, updatedAt: new Date() } });
  return getSmartNotificationSettings(userId);
}

export async function saveSmartNotificationSubscription(userId: number, subscription: { endpoint: string; keys?: Record<string, string> }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(smartNotificationSubscriptions).values({ userId, endpoint: subscription.endpoint, subscriptionJson: JSON.stringify(subscription) }).onDuplicateKeyUpdate({ set: { userId, subscriptionJson: JSON.stringify(subscription), updatedAt: new Date() } });
  return { success: true } as const;
}

export async function setSmartNotificationTaskUid(userId: number, taskUid: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.update(smartNotificationSettings).set({ scheduleCronTaskUid: taskUid, updatedAt: new Date() }).where(eq(smartNotificationSettings.userId, userId));
}

type SmartNotificationSendOptions = { ignoreTimeWindow?: boolean };

async function sendSmartNotificationForSettings(settings: typeof smartNotificationSettings.$inferSelect, options: SmartNotificationSendOptions = {}) {
  const db = await getDb();
  if (!db) return { sent: 0, skipped: "database" } as const;
  if (!settings.enabled) return { sent: 0, skipped: "disabled" } as const;
  if (!options.ignoreTimeWindow && !isWithinSmartNotificationWindow(new Date(), settings.startTime, settings.endTime)) return { sent: 0, skipped: "outside_hours" } as const;
  const books = await listVisibleWordbooks(settings.userId);
  const book = books.find(item => item.id === settings.wordbookId);
  if (!book || !book.words.length) return { sent: 0, skipped: "empty" } as const;
  const subscriptions = await db.select().from(smartNotificationSubscriptions).where(eq(smartNotificationSubscriptions.userId, settings.userId));
  if (!subscriptions.length) return { sent: 0, skipped: "no_subscription", wordId: book.words[0]?.id } as const;
  const word = book.words[Math.floor(Math.random() * book.words.length)];
  try { webpush.setVapidDetails(ENV.vapidSubject, ENV.vapidPublicKey, ENV.vapidPrivateKey); }
  catch (error) { console.error("[SmartNotification] VAPID configuration failed", error); return { sent: 0, skipped: "configuration", wordId: word.id } as const; }
  const payload = JSON.stringify({ title: `StudyVerse｜${book.title}`, body: settings.direction === "question" ? word.front : word.back, answer: settings.direction === "question" ? word.back : word.front, direction: settings.direction, wordId: word.id, tag: `smart-${word.id}` });
  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    try { await webpush.sendNotification(JSON.parse(subscription.subscriptionJson), payload); sent += 1; }
    catch (error) {
      failed += 1;
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) await db.delete(smartNotificationSubscriptions).where(eq(smartNotificationSubscriptions.id, subscription.id));
      else console.warn("[SmartNotification] send failed", { statusCode, error });
    }
  }
  console.info("[SmartNotification] delivery", { userId: settings.userId, wordId: word.id, sent, failed, subscriptions: subscriptions.length });
  if (!sent) return { sent: 0, skipped: "delivery_failed", wordId: word.id } as const;
  return { sent, wordId: word.id } as const;
}

export async function sendSmartNotification(taskUid: string) {
  const db = await getDb();
  if (!db) return { sent: 0, skipped: "database" } as const;
  const settings = (await db.select().from(smartNotificationSettings).where(eq(smartNotificationSettings.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!settings) return { sent: 0, skipped: "not_found" } as const;
  return sendSmartNotificationForSettings(settings);
}

export async function sendSmartNotificationNow(userId: number) {
  const settings = await getSmartNotificationSettings(userId);
  if (!settings) return { sent: 0, skipped: "not_found" } as const;
  return sendSmartNotificationForSettings(settings, { ignoreTimeWindow: true });
}
