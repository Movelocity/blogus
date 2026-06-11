import fp from "fastify-plugin";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";

export const dbPlugin = fp(async (app) => {
  const client = postgres(config.database.url, {
    max: 10,
    idle_timeout: 20
  });

  app.decorate("db", drizzle(client));
  app.addHook("onClose", async () => {
    await client.end();
  });
});
