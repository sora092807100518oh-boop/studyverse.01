import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
const mock = vi.hoisted(() => ({ authenticate: vi.fn(), enter: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mock.authenticate } }));
vi.mock("./db", async importOriginal => {
  const original = await importOriginal<typeof import("./db")>();
  return { ...original, authenticateWithOAuth: mock.enter };
});
import { appRouter } from "./routers";

function context() {
  return {
    user: { id: 1, openId: "stale-admin", role: "admin", name: "Admin" },
    req: { protocol: "https", headers: { cookie: "studyverse_admin=old-admin; studyverse_pin=old-pin; app_session_id=oauth-B" } },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as unknown as TrpcContext;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.authenticate.mockResolvedValue({ id: 99, openId: "oauth-B", role: "user", name: "B" });
  mock.enter.mockResolvedValue({ token: "new-membership", profile: { userId: 99 }, classroom: { id: 7 }, expiresAt: new Date() });
});

describe("OAuth identity isolation", () => {
  it("auth.me resolves the OAuth account even when generic context selected an administrator", async () => {
    const caller = appRouter.createCaller(context());
    expect(await caller.auth.me()).toMatchObject({ id: 99, openId: "oauth-B" });
  });
  it("school enrollment uses only the verified OAuth account, not an old PIN or admin user", async () => {
    const caller = appRouter.createCaller(context());
    await caller.auth.oauthClassroomLogin({ classroomCode: "SCHOOL-7" });
    expect(mock.enter).toHaveBeenCalledWith(99, { classroomCode: "SCHOOL-7" });
  });
  it("an administrator cookie alone cannot substitute for OAuth authentication", async () => {
    mock.authenticate.mockRejectedValue(new Error("no OAuth session"));
    const caller = appRouter.createCaller(context());
    expect(await caller.auth.me()).toBeNull();
    await expect(caller.auth.oauthClassroomLogin({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mock.enter).not.toHaveBeenCalled();
  });
});
