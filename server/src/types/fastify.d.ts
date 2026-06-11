import type { CurrentUser } from "@blogus/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { StoredFile, PutFileInput } from "../plugins/storage.js";

declare module "fastify" {
  interface FastifyInstance {
    db: PostgresJsDatabase;
    authenticate: import("fastify").preHandlerHookHandler;
    storage: {
      putFile(input: PutFileInput): Promise<StoredFile>;
    };
  }

  interface FastifyRequest {
    currentUser?: CurrentUser;
  }
}
