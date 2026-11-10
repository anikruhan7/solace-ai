import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./controllers/auth.controller";
import moodRoutes from "./controllers/mood.controller";
import convRoutes from "./controllers/conversation.controller";
import wellnessRoutes from "./controllers/wellness.controller";
import profileRoutes from "./controllers/profile.controller";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin === "*" ? true : env.clientOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

  app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/moods", moodRoutes);
  app.use("/api/conversations", convRoutes);
  app.use("/api/wellness", wellnessRoutes);
  app.use("/api/profile", profileRoutes);

  app.use(errorHandler);
  return app;
}