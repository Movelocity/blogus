import type { CurrentUser } from "@blogus/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../db/schema.js";
import type { StoredFile, PutFileInput } from "../plugins/storage.js";

declare module "fastify" {
  interface FastifyInstance {
    db: PostgresJsDatabase<typeof schema>;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    storage: {
      putFile(input: PutFileInput): Promise<StoredFile>;
    };
  }

  interface FastifyRequest {
    authSessionId?: string;
    currentUser?: CurrentUser;
  }
}
