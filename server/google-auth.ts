import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { googleSessions, users } from "../drizzle/schema";
import { getDb, getUserByOpenId, upsertUser } from "./db";
import { getSessionTokenHash } from "./pin-auth";

const GOOGLE_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const sessionPepper = () => process.env.JWT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "studyverse-google-session";

export async function upsertGoogleUser(input: { subject: string; name?: string | null; email?: string | null }) {
  const openId = `google:${input.subject}`;
  await upsertUser({ openId, name: input.name ?? null, email: input.email ?? null, loginMethod: "google", lastSignedIn: new Date() });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("GOOGLE_USER_UNAVAILABLE");
  return user;
}

export async function createGoogleSession(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + GOOGLE_SESSION_TTL_MS);
  await db.insert(googleSessions).values({ tokenHash: getSessionTokenHash(token, sessionPepper()), userId, expiresAt });
  return { token, expiresAt };
}

export async function getGoogleSession(token: string) {
  const db = await getDb();
  if (!db) return null;
  const tokenHash = getSessionTokenHash(token, sessionPepper());
  const rows = await db.select({ session: googleSessions, user: users }).from(googleSessions).innerJoin(users, eq(googleSessions.userId, users.id)).where(and(eq(googleSessions.tokenHash, tokenHash), isNull(googleSessions.revokedAt), gt(googleSessions.expiresAt, new Date()))).limit(1);
  return rows[0] ?? null;
}

export async function revokeGoogleSession(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(googleSessions).set({ revokedAt: new Date() }).where(eq(googleSessions.tokenHash, getSessionTokenHash(token, sessionPepper())));
}
