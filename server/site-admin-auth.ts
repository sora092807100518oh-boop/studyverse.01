import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function verifySiteAdminPassword(candidate: string) {
  const expected = process.env.SITE_ADMIN_PASSWORD;
  if (!expected || !candidate) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const candidateBuffer = Buffer.from(candidate, "utf8");
  return expectedBuffer.length === candidateBuffer.length && timingSafeEqual(expectedBuffer, candidateBuffer);
}

export function createSiteAdminSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function getSiteAdminSessionTokenHash(token: string) {
  return createHash("sha256").update(`studyverse:site-admin-session:v1:${token}:${process.env.JWT_SECRET ?? ""}`).digest("hex");
}
