import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { classrooms, monsterEggs, monsterMissionClaims, monsterProfiles, pinSessions, studentProfiles, teacherAdminSessions, users } from "../drizzle/schema";
import { appRouter } from "./routers";
import { createContext, type TrpcContext } from "./_core/context";
import { createClassroom, createPinAccount, getDb, getOrCreateSiteAdmin } from "./db";

const createdClassroomIds = new Set<number>();
const createdUserIds = new Set<number>();

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  const classroomIds = [...createdClassroomIds];
  if (classroomIds.length) {
    const profiles = await db.select({ id: studentProfiles.id, userId: studentProfiles.userId }).from(studentProfiles).where(inArray(studentProfiles.classroomId, classroomIds));
    if (profiles.length) {
      await db.delete(pinSessions).where(inArray(pinSessions.profileId, profiles.map(profile => profile.id)));
      await db.delete(studentProfiles).where(inArray(studentProfiles.id, profiles.map(profile => profile.id)));
      profiles.forEach(profile => createdUserIds.add(profile.userId));
    }
    await db.delete(teacherAdminSessions).where(inArray(teacherAdminSessions.classroomId, classroomIds));
    await db.delete(classrooms).where(inArray(classrooms.id, classroomIds));
  }
  const userIds = [...createdUserIds];
  if (userIds.length) {
    await db.delete(monsterMissionClaims).where(inArray(monsterMissionClaims.userId, userIds));
    await db.delete(monsterEggs).where(inArray(monsterEggs.userId, userIds));
    await db.delete(monsterProfiles).where(inArray(monsterProfiles.userId, userIds));
    await db.delete(users).where(and(inArray(users.id, userIds), eq(users.role, "user")));
  }
});

function createMockContext(): { ctx: TrpcContext; cookies: Array<{ name: string; value: string }> } {
  const cookies: Array<{ name: string; value: string }> = [];
  return {
    ctx: {
      user: null,
      req: { protocol: "https", headers: {}, cookies: {} } as TrpcContext["req"],
      res: { cookie: (name: string, value: string) => cookies.push({ name, value }) } as TrpcContext["res"],
    },
    cookies,
  };
}

describe("先生IDによる教室限定管理", () => {
  it("担当先生IDは全体管理とは別のCookieを発行し、自教室の学習者だけを返す", async () => {
    const admin = await getOrCreateSiteAdmin();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const teacherId = Number(`${Date.now()}`.slice(-8));
    const ownRoomCode = `TEACHER-${suffix}`.slice(0, 32);
    const otherRoomCode = `OTHER-${suffix}`.slice(0, 32);
    const ownRoom = await createClassroom(admin.id, { code: ownRoomCode, name: `先生管理教室 ${suffix}`, teacherUserId: teacherId });
    const otherRoom = await createClassroom(admin.id, { code: otherRoomCode, name: `別教室 ${suffix}`, teacherUserId: teacherId + 1 });
    createdClassroomIds.add(ownRoom.id); createdClassroomIds.add(otherRoom.id);
    const ownStudent = await createPinAccount(admin.id, { classroomId: ownRoom.id, displayName: "担当教室の学習者", pin: "1234" });
    const otherStudent = await createPinAccount(admin.id, { classroomId: otherRoom.id, displayName: "別教室の学習者", pin: "5678" });
    createdUserIds.add(ownStudent.userId); createdUserIds.add(otherStudent.userId);

    const { ctx, cookies } = createMockContext();
    const login = await appRouter.createCaller(ctx).teacherAdmin.login({ teacherId });
    expect(login.teacher.classroomId).toBe(ownRoom.id);
    expect(cookies[0]).toMatchObject({ name: "studyverse_teacher" });

    const token = cookies[0]?.value;
    const request = { protocol: "https", headers: { cookie: `studyverse_teacher=${token}` }, cookies: { studyverse_teacher: token } } as TrpcContext["req"];
    const response = { clearCookie: () => undefined } as TrpcContext["res"];
    const teacherContext = await createContext({ req: request, res: response });
    const teacherCaller = appRouter.createCaller(teacherContext);
    await expect(teacherCaller.teacherAdmin.me()).resolves.toMatchObject({ teacher: { classroomId: ownRoom.id } });
    await expect(teacherCaller.classroom.members.list()).resolves.toMatchObject([{ displayName: "担当教室の学習者", classroomId: ownRoom.id }]);
    await expect(teacherCaller.management.insights()).resolves.toMatchObject({ memberCount: 1 });
    if (!ownStudent.profileId || !otherStudent.profileId) throw new Error("学習者プロフィールを作成できませんでした。");
    await expect(teacherCaller.classroom.members.detail({ profileId: ownStudent.profileId })).resolves.toMatchObject({
      profile: { displayName: "担当教室の学習者", classroomCode: ownRoomCode },
      learning: { totalFocusSeconds: 0, records: 0 },
      monster: { stage: 1 },
    });
    await expect(teacherCaller.classroom.members.detail({ profileId: otherStudent.profileId })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await teacherCaller.teacherAdmin.logout();
    const loggedOut = await createContext({ req: request, res: response });
    await expect(appRouter.createCaller(loggedOut).teacherAdmin.me()).resolves.toBeNull();
  }, 20_000);
});
