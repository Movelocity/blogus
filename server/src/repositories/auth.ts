import { and, eq, gt, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { CurrentUser } from "@blogus/shared";
import * as schema from "../db/schema.js";
import { authSessions, users } from "../db/schema.js";

export type AuthDatabase = PostgresJsDatabase<typeof schema>;
type UserRow = typeof users.$inferSelect;
type SessionRow = typeof authSessions.$inferSelect;

export interface AuthSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export function toCurrentUser(row: UserRow): CurrentUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? undefined
  };
}

function toSession(row: SessionRow): AuthSession {
  return {
    id: row.id,
    userId: row.userId,
    refreshTokenHash: row.refreshTokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt
  };
}

export class DrizzleAuthRepository {
  constructor(private readonly db: AuthDatabase) {}

  async findUserByEmail(email: string) {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return row ?? null;
  }

  async findUserById(id: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async createSession(input: { userId: string; refreshTokenHash: string; expiresAt: Date }) {
    const [row] = await this.db
      .insert(authSessions)
      .values({
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt
      })
      .returning();

    return toSession(row);
  }

  async findActiveSession(id: string) {
    const [row] = await this.db
      .select()
      .from(authSessions)
      .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date())))
      .limit(1);

    return row ? toSession(row) : null;
  }

  async rotateSession(id: string, input: { refreshTokenHash: string; expiresAt: Date }) {
    const [row] = await this.db
      .update(authSessions)
      .set({
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        updatedAt: new Date()
      })
      .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date())))
      .returning();

    return row ? toSession(row) : null;
  }

  async revokeSession(id: string) {
    const rows = await this.db
      .update(authSessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt)))
      .returning({ id: authSessions.id });

    return rows.length > 0;
  }
}
