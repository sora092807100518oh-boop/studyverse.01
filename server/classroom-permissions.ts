export type ClassroomRole = "student" | "teacher" | "owner";

export function canManageClassroom(input: { siteRole: "user" | "admin" | undefined; classroomRole: ClassroomRole | undefined; actorClassroomId: number | undefined; targetClassroomId: number }) {
  if (input.siteRole === "admin" || input.classroomRole === "owner") return true;
  return input.classroomRole === "teacher" && input.actorClassroomId === input.targetClassroomId;
}

export function canPublishGlobally(input: { siteRole: "user" | "admin" | undefined; classroomRole: ClassroomRole | undefined }) {
  return input.siteRole === "admin" || input.classroomRole === "owner";
}
