import { describe, expect, it } from "vitest";
import { canManageClassroom, canPublishGlobally } from "./classroom-permissions";

describe("教室権限", () => {
  it("先生は自教室だけを管理し、全体管理者とオーナーは横断管理できる", () => {
    expect(canManageClassroom({ siteRole: "user", classroomRole: "teacher", actorClassroomId: 1, targetClassroomId: 1 })).toBe(true);
    expect(canManageClassroom({ siteRole: "user", classroomRole: "teacher", actorClassroomId: 1, targetClassroomId: 2 })).toBe(false);
    expect(canManageClassroom({ siteRole: "admin", classroomRole: undefined, actorClassroomId: undefined, targetClassroomId: 2 })).toBe(true);
    expect(canManageClassroom({ siteRole: "user", classroomRole: "owner", actorClassroomId: 1, targetClassroomId: 2 })).toBe(true);
  });

  it("全体公開は全体管理者または教室オーナーに限定する", () => {
    expect(canPublishGlobally({ siteRole: "user", classroomRole: "teacher" })).toBe(false);
    expect(canPublishGlobally({ siteRole: "user", classroomRole: "owner" })).toBe(true);
  });
});
