import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getPinSession, getSiteAdminSession, getTeacherAdminSession, getUserById } from "../db";
import { sdk } from "./sdk";
import type { ActiveMembership } from "../active-membership";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  activeMembership?: ActiveMembership;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let activeMembership: ActiveMembership | undefined;
  const cookieHeader = opts.req.headers.cookie ?? "";
  const getCookie = (name: string) => cookieHeader.split(";").map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1);
  const adminToken = getCookie("studyverse_admin");
  if (adminToken) {
    try { user = (await getSiteAdminSession(adminToken))?.user ?? null; } catch (error) { console.warn("[Site Admin Auth] Session lookup failed", String(error)); }
  }
  if (!user) {
    const teacherToken = getCookie("studyverse_teacher");
    if (teacherToken) {
      try { user = (await getTeacherAdminSession(teacherToken))?.user ?? null; } catch (error) { console.warn("[Teacher Admin Auth] Session lookup failed", String(error)); }
    }
  }
  if (!user) {
    const pinToken = getCookie("studyverse_pin");
    if (pinToken) {
      try {
        const session = await getPinSession(pinToken);
        if (session) {
          user = await getUserById(session.session.userId) ?? null;
          activeMembership = { userId: session.session.userId, profileId: session.session.profileId, classroomId: session.session.classroomId };
        }
      } catch (error) { console.warn("[PIN Auth] Session lookup failed", String(error)); }
    }
  }

  if (!user) {
    try { user = await sdk.authenticateRequest(opts.req); } catch { /* OAuth session is optional on the public login screen. */ }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    activeMembership,
  };
}
