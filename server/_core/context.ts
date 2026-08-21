import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getPinSession, getSiteAdminSession, getTeacherAdminSession, getUserById } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
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
        if (session) user = await getUserById(session.session.userId) ?? null;
      } catch (error) { console.warn("[PIN Auth] Session lookup failed", String(error)); }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
