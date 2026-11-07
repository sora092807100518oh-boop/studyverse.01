import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/_core/app";

// Express is supported as a Vercel Node.js Function handler.
// The app is created once per warm invocation and reused across requests.
const app = createApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
