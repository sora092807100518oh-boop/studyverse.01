import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createContext, type TrpcContext } from "./_core/context";

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function createMockContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  return { ctx: { user: null, req: { protocol: "https", headers: {}, cookies: {} } as TrpcContext["req"], res: { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) } as TrpcContext["res"] }, cookies };
}

describe("独立全体管理者のパスワード照合API", () => {
  it("設定済みのサーバー側パスワードだけを受け入れる", async () => {
    const expected = process.env.SITE_ADMIN_PASSWORD;
    expect(expected).toBeTruthy();
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.siteAdmin.check({ password: expected! })).resolves.toEqual({ valid: true });
    await expect(caller.siteAdmin.check({ password: "invalid-password" })).resolves.toEqual({ valid: false });
  });

  it("正しいパスワードで独立管理者セッションCookieを発行する", async () => {
    const { ctx, cookies } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.siteAdmin.login({ password: process.env.SITE_ADMIN_PASSWORD! });

    expect(result.user.role).toBe("admin");
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe("studyverse_admin");
    expect(cookies[0]?.value.length).toBeGreaterThan(20);
    expect(cookies[0]?.options).toMatchObject({ httpOnly: true, maxAge: 28_800_000 });
  });

  it("独立管理者Cookieで通常の認証コンテキストへ入り、ログアウト後は無効になる", async () => {
    const { ctx, cookies } = createMockContext();
    const loginCaller = appRouter.createCaller(ctx);
    await loginCaller.siteAdmin.login({ password: process.env.SITE_ADMIN_PASSWORD! });
    const token = cookies[0]?.value;
    expect(token).toBeTruthy();

    const request = { protocol: "https", headers: { cookie: `studyverse_admin=${token}` } } as TrpcContext["req"];
    const response = { clearCookie: () => undefined } as TrpcContext["res"];
    const authenticatedContext = await createContext({ req: request, res: response });
    await expect(appRouter.createCaller(authenticatedContext).siteAdmin.me()).resolves.toMatchObject({ role: "admin" });

    await appRouter.createCaller(authenticatedContext).siteAdmin.logout();
    const loggedOutContext = await createContext({ req: request, res: response });
    await expect(appRouter.createCaller(loggedOutContext).siteAdmin.me()).resolves.toBeNull();
  });
});
