import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME, decodeOAuthState, OAUTH_STATE_COOKIE } from "../../shared/const";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sendSmartNotification } from "../db";
import { sdk } from "./sdk";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  app.get("/api/oauth/callback", async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const rawState = typeof req.query.state === "string" ? req.query.state : "";
      const { nonce } = decodeOAuthState(rawState);
      const cookies = parseCookieHeader(req.headers.cookie ?? "");
      if (!code || !nonce || cookies[OAUTH_STATE_COOKIE] !== nonce) return res.status(403).send("OAuth認証を確認できませんでした。最初からログインしてください。");
      const token = await sdk.exchangeCodeForToken(code, rawState);
      const info = await sdk.getUserInfo(token.accessToken);
      await upsertUser({ openId: info.openId, name: info.name ?? null, email: info.email ?? null, loginMethod: info.loginMethod ?? info.platform ?? null, lastSignedIn: new Date() });
      const session = await sdk.createSessionToken(info.openId, { name: info.name ?? "" });
      res.clearCookie(OAUTH_STATE_COOKIE, { ...getSessionCookieOptions(req), maxAge: -1 });
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: 365 * 24 * 60 * 60 * 1000 });
      return res.redirect("/");
    } catch (error) {
      console.error("[OAuth] callback failed", error);
      return res.status(502).send("OAuthログインに失敗しました。もう一度お試しください。");
    }
  });
  app.post("/api/scheduled/smart-notifications", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      return res.json(await sendSmartNotification(user.taskUid));
    } catch (error) {
      return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
