import cors from "@fastify/cors";
import Fastify from "fastify";
import { authPlugin } from "./plugins/auth.js";
import { dbPlugin } from "./plugins/db.js";
import { authRoutes } from "./routes/auth.js";
import { postRoutes } from "./routes/posts.js";
import { uploadRoutes } from "./routes/upload.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  await app.register(cors, {
    credentials: true,
    origin: process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173"
  });

  await app.register(dbPlugin);
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
