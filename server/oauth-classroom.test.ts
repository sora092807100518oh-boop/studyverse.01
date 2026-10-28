import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { activityLogs, classrooms, oauthClassroomApplications, pinSessions, studentProfiles, users, wordbooks } from "../drizzle/schema";
import { authenticateWithOAuth, getDb, getOrCreateSiteAdmin, getProfile, requestOAuthClassroomApplication, reviewOAuthClassroomApplication } from "./db";
import { withActiveMembership } from "./active-membership";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
let userId = 0;
const rooms: number[] = [];
const books: number[] = [];

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (books.length) await db.delete(wordbooks).where(inArray(wordbooks.id, books));
  if (userId) {
    await db.delete(oauthClassroomApplications).where(eq(oauthClassroomApplications.userId, userId));
    await db.delete(pinSessions).where(eq(pinSessions.userId, userId));
    await db.delete(activityLogs).where(eq(activityLogs.actorUserId, userId));
    await db.delete(studentProfiles).where(eq(studentProfiles.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
  if (rooms.length) await db.delete(classrooms).where(inArray(classrooms.id, rooms));
}, 60_000);

describe("OAuth selected school", () => {
  it("uses the selected membership instead of the user's first school", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const admin = await getOrCreateSiteAdmin();
    const key = randomUUID().slice(0, 8);
    const created = await db.insert(users).values({ openId: `oauth-school-test-${key}`, name: "OAuth Learner", role: "user", loginMethod: "google" }).$returningId();
    userId = created[0].id;
    const account = (await db.select().from(users).where(eq(users.id, userId)))[0];
    for (const suffix of ["A", "B"]) {
      const room = await db.insert(classrooms).values({ code: `OAT-${key}-${suffix}`, name: `OAuth Test ${suffix}` }).$returningId();
      rooms.push(room[0].id);
      const book = await db.insert(wordbooks).values({ title: `OAuth Test ${suffix}`, subject: "english", ownerUserId: admin.id, classroomId: room[0].id, visibility: "classroom" }).$returningId();
      books.push(book[0].id);
    }
    for (const suffix of ["A", "B"]) {
      const application = await requestOAuthClassroomApplication(userId, `OAT-${key}-${suffix}`);
      await reviewOAuthClassroomApplication(admin.id, application.applicationId!, "approved");
    }
    const first = await authenticateWithOAuth(userId, { classroomCode: `OAT-${key}-A` });
    const second = await authenticateWithOAuth(userId, { classroomCode: `OAT-${key}-B` });
    expect(first.profile.id).not.toBe(second.profile.id);
    for (const [index, session] of [first, second].entries()) {
      const selected = { userId, profileId: session.profile.id, classroomId: session.classroom.id };
      const profile = await withActiveMembership(selected, () => getProfile(userId));
      expect(profile?.classroom.id).toBe(rooms[index]);
      const ctx = { user: account, activeMembership: selected, req: { headers: {} }, res: {} } as TrpcContext;
      const visible = await appRouter.createCaller(ctx).wordbooks.list({ subject: "english" });
      expect(visible.some(book => book.id === books[index])).toBe(true);
      expect(visible.some(book => book.id === books[index === 0 ? 1 : 0])).toBe(false);
    }
  }, 60_000);
});
