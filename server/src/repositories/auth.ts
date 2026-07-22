import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { CurrentUser, InviteCode } from "@blogus/shared";
import { hashPassword } from "../auth/password.js";
import * as schema from "../db/schema.js";
import { authSessions, inviteCodes, users } from "../db/schema.js";

export type AuthDatabase = PostgresJsDatabase<typeof schema>;
type UserRow = typeof users.$inferSelect;
type SessionRow = typeof authSessions.$inferSelect;
type InviteCodeRow = typeof inviteCodes.$inferSelect;
export type UserRole = "admin" | "user";

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  passwordHash: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface RegisterUserInput {
  email: string;
  name?: string;
  password: string;
  inviteCode?: string;
}

export interface CreateInviteInput {
  code?: string;
  createdBy: string;
  maxUses?: number;
  expiresAt?: Date;
}

export class AuthRepositoryError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  countUsers(): Promise<number>;
  registerUser(input: RegisterUserInput): Promise<UserRecord>;
  upsertDevUser(input: { email: string; name?: string }): Promise<UserRecord>;
  createSession(input: { userId: string; refreshTokenHash: string; expiresAt: Date }): Promise<AuthSession>;
  findActiveSession(id: string): Promise<AuthSession | null>;
  rotateSession(id: string, input: { refreshTokenHash: string; expiresAt: Date }): Promise<AuthSession | null>;
  revokeSession(id: string): Promise<boolean>;
  listInviteCodes(): Promise<InviteCode[]>;
  createInviteCode(input: CreateInviteInput): Promise<InviteCode>;
  disableInviteCode(id: string): Promise<InviteCode | null>;
}

export function toCurrentUser(row: UserRecord): CurrentUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? undefined,
    role: row.role
  };
}

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "user",
    passwordHash: row.passwordHash
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

function toInviteCode(row: InviteCodeRow): InviteCode {
  return {
    id: row.id,
    code: row.code,
    createdBy: row.createdBy ?? undefined,
    usedCount: row.usedCount,
    maxUses: row.maxUses ?? undefined,
    expiresAt: row.expiresAt?.toISOString(),
    disabledAt: row.disabledAt?.toISOString(),
    createdAt: row.createdAt.toISOString()
  };
}

function assertInviteUsable(row: InviteCodeRow | undefined, now: Date) {
  if (!row) {
    throw new AuthRepositoryError(400, "invalid_invite_code", "Invalid invite code");
  }
  if (row.disabledAt) {
    throw new AuthRepositoryError(400, "disabled_invite_code", "Invite code is disabled");
  }
  if (row.expiresAt && row.expiresAt <= now) {
    throw new AuthRepositoryError(400, "expired_invite_code", "Invite code has expired");
  }
  if (row.maxUses !== null && row.usedCount >= row.maxUses) {
    throw new AuthRepositoryError(400, "exhausted_invite_code", "Invite code has no remaining uses");
  }
}

export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly db: AuthDatabase) {}

  async findUserByEmail(email: string) {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return row ? toUser(row) : null;
  }

  async findUserById(id: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toUser(row) : null;
  }

  async countUsers() {
    const [{ value }] = await this.db.select({ value: count() }).from(users);
    return value;
  }

  async registerUser(input: RegisterUserInput) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(19071997)`);

      const email = input.email.toLowerCase();
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        throw new AuthRepositoryError(409, "email_exists", "Email is already registered");
      }

      const [{ value: userCount }] = await tx.select({ value: count() }).from(users);
      const isFirstUser = userCount === 0;
      const now = new Date();
      let invite: InviteCodeRow | undefined;

      if (!isFirstUser) {
        const code = input.inviteCode?.trim();
        if (!code) {
          throw new AuthRepositoryError(400, "missing_invite_code", "Invite code is required");
        }

        [invite] = await tx.select().from(inviteCodes).where(eq(inviteCodes.code, code)).limit(1);
        assertInviteUsable(invite, now);
      }

      const passwordHash = await hashPassword(input.password);
      const [user] = await tx
        .insert(users)
        .values({
          email,
          name: input.name ?? null,
          role: isFirstUser ? "admin" : "user",
          passwordHash
        })
        .returning();

      if (invite) {
        await tx
          .update(inviteCodes)
          .set({ usedCount: sql`${inviteCodes.usedCount} + 1` })
          .where(eq(inviteCodes.id, invite.id));
      }

      return toUser(user);
    });
  }

  async upsertDevUser(input: { email: string; name?: string }) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(19071997)`);

      const email = input.email.toLowerCase();
      const passwordHash = await hashPassword(randomUUID());
      const [{ value: userCount }] = await tx.select({ value: count() }).from(users);
      const [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
      const role: UserRole = existing?.role === "admin" ? "admin" : userCount === 0 ? "admin" : "user";
      const [user] = await tx
        .insert(users)
        .values({
          email,
          name: input.name ?? null,
          role,
          passwordHash
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: input.name ?? null,
            passwordHash
          }
        })
        .returning();

      return toUser(user);
    });
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

  async listInviteCodes() {
    const rows = await this.db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
    return rows.map(toInviteCode);
  }

  async createInviteCode(input: CreateInviteInput) {
    if (input.code) {
      const [existing] = await this.db
        .select({ id: inviteCodes.id })
        .from(inviteCodes)
        .where(eq(inviteCodes.code, input.code))
        .limit(1);
      if (existing) {
        throw new AuthRepositoryError(409, "invite_code_exists", "Invite code already exists");
      }
    }

    const [row] = await this.db
      .insert(inviteCodes)
      .values({
        code: input.code ?? randomUUID().replaceAll("-", ""),
        createdBy: input.createdBy,
        maxUses: input.maxUses ?? null,
        expiresAt: input.expiresAt ?? null
      })
      .returning();

    return toInviteCode(row);
  }

  async disableInviteCode(id: string) {
    const [row] = await this.db
      .update(inviteCodes)
      .set({ disabledAt: new Date() })
      .where(eq(inviteCodes.id, id))
      .returning();

    return row ? toInviteCode(row) : null;
  }
}
