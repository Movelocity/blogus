import fp from "fastify-plugin";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const dbPlugin = fp(async (app) => {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://blogus:blogus@127.0.0.1:5432/blogus";

  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20
  });

  app.decorate("db", drizzle(client));
  app.addHook("onClose", async () => {
    await client.end();
  });
});
