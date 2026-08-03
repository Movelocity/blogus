import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { config } from "./config.js";
import { apiErrorHandler } from "./http/errors.js";
import { authPlugin } from "./plugins/auth.js";
import { dbPlugin } from "./plugins/db.js";
import { serveClientPlugin } from "./plugins/serve-client.js";
import { storagePlugin } from "./plugins/storage.js";
import { authRoutes } from "./routes/auth.js";
import { folderRoutes } from "./routes/folders.js";
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
    origin: config.nodeEnv === "development" ? true : config.server.clientOrigin
  });
  await app.register(multipart, {
    limits: {
      fileSize: config.upload.maxSizeMb * 1024 * 1024
    }
  });

  await app.register(dbPlugin);
  await app.register(storagePlugin);
  await app.register(authPlugin);

  app.get("/api/health", async (_request, reply) => {
    const dbOk = await app.db
      .execute(sql`SELECT 1`)
      .then(() => true)
      .catch(() => false);

    const storage = await app.storage.check();

    const ok = dbOk && storage.ok;
    const body = {
      ok,
      service: "blogus-api",
      db: dbOk ? "connected" : "disconnected",
      storage
    };

    return reply.status(ok ? 200 : 503).send(body);
  });

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(folderRoutes, { prefix: "/api/folders" });
  await app.register(postRoutes, { prefix: "/api/posts" });
  await app.register(uploadRoutes, { prefix: "/api/upload" });

  if (config.server.serveClient) {
    await app.register(serveClientPlugin);
  }

  return app;
}
