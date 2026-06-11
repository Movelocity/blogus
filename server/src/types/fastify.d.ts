import type { CurrentUser } from "@blogus/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

declare module "fastify" {
  interface FastifyInstance {
    db: PostgresJsDatabase;
    authenticate: import("fastify").preHandlerHookHandler;
  }

  interface FastifyRequest {
    currentUser?: CurrentUser;
  }
}
