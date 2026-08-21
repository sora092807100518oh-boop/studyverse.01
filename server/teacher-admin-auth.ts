import { createHash, randomBytes } from "node:crypto";

export function createTeacherAdminSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function getTeacherAdminSessionTokenHash(token: string) {
  return createHash("sha256").update(`studyverse:teacher-admin-session:v1:${token}:${process.env.JWT_SECRET ?? ""}`).digest("hex");
}
