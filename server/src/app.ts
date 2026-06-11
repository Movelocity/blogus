import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { config } from "./config.js";
import { apiErrorHandler } from "./http/errors.js";
import { authPlugin } from "./plugins/auth.js";
import { dbPlugin } from "./plugins/db.js";
import { storagePlugin } from "./plugins/storage.js";
import { authRoutes } from "./routes/auth.js";
import { postRoutes } from "./routes/posts.js";
import { uploadRoutes } from "./routes/upload.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });
  app.setErrorHandler(apiErrorHandler);

  await app.register(cors, {
    credentials: true,
    origin: config.server.clientOrigin
  });
  await app.register(multipart, {
    limits: {
      fileSize: config.upload.maxSizeMb * 1024 * 1024
    }
  });

  await app.register(dbPlugin);
  await app.register(storagePlugin);
  await app.register(authPlugin);

  app.get("/api/health", async () => ({
    ok: true,
    service: "blogus-api"
  }));

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(postRoutes, { prefix: "/api/posts" });
  await app.register(uploadRoutes, { prefix: "/api/upload" });

  return app;
}
