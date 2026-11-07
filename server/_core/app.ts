import "dotenv/config";
import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleOAuthRoutes } from "./google-oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sendSmartNotification } from "../db";
import { sdk } from "./sdk";

/**
 * Build the API application without binding a TCP port.
 * This is shared by the local Node server and Vercel Functions.
 */
export function createApp(): Express {
  const app = express();

  // File uploads and JSON payloads used by the admin/content flows.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleOAuthRoutes(app);

  app.post("/api/scheduled/smart-notifications", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      return res.json(await sendSmartNotification(user.taskUid));
    } catch (error) {
      return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
