import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getPinSession, getUserById } from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user) {
    const cookieHeader = opts.req.headers.cookie ?? "";
    const token = cookieHeader.split(";").map(item => item.trim()).find(item => item.startsWith("studyverse_pin="))?.slice("studyverse_pin=".length);
    if (token) {
      try {
        const session = await getPinSession(token);
        if (session) user = await getUserById(session.session.userId) ?? null;
      } catch (error) {
        console.warn("[PIN Auth] Session lookup failed", String(error));
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
