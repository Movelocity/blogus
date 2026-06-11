import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import type { CurrentUser, InviteCode } from "@blogus/shared";
import Fastify from "fastify";
import { hashPassword } from "../auth/password.js";
import { config } from "../config.js";
import { apiErrorHandler, sendApiError } from "../http/errors.js";
import type {
  AuthRepository,
  AuthSession,
  CreateInviteInput,
  RegisterUserInput,
  UserRecord,
  UserRole
} from "../repositories/auth.js";
import { AuthRepositoryError, toCurrentUser } from "../repositories/auth.js";
import { createAuthRoutes } from "./auth.js";

class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, AuthSession>();
  private readonly invites = new Map<string, InviteCode>();

  private findInviteByCode(code: string) {
    return Array.from(this.invites.values()).find((invite) => invite.code === code);
  }

  async findUserByEmail(email: string) {
    return Array.from(this.users.values()).find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async registerUser(input: RegisterUserInput) {
    const email = input.email.toLowerCase();
    if (await this.findUserByEmail(email)) {
      throw new AuthRepositoryError(409, "email_exists", "Email is already registered");
    }

    const isFirstUser = this.users.size === 0;
    if (!isFirstUser) {
      const invite = input.inviteCode ? this.findInviteByCode(input.inviteCode) : undefined;
      if (!invite) {
        throw new AuthRepositoryError(400, "invalid_invite_code", "Invalid invite code");
      }
      if (invite.disabledAt) {
        throw new AuthRepositoryError(400, "disabled_invite_code", "Invite code is disabled");
      }
      this.invites.set(invite.id, { ...invite, usedCount: invite.usedCount + 1 });
    }

    const user: UserRecord = {
      id: randomUUID(),
      email,
      name: input.name ?? null,
      role: isFirstUser ? "admin" : "user",
      passwordHash: await hashPassword(input.password)
    };
    this.users.set(user.id, user);
    return user;
  }

  async upsertDevUser(input: { email: string; name?: string }) {
    const existing = await this.findUserByEmail(input.email);
    const role: UserRole = existing?.role ?? (this.users.size === 0 ? "admin" : "user");
    const user: UserRecord = {
      id: existing?.id ?? randomUUID(),
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      role,
      passwordHash: await hashPassword(randomUUID())
    };
    this.users.set(user.id, user);
    return user;
  }

  async createSession(input: { userId: string; refreshTokenHash: string; expiresAt: Date }) {
    const session: AuthSession = {
      id: randomUUID(),
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findActiveSession(id: string) {
    const session = this.sessions.get(id);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }
    return session;
  }

  async rotateSession(id: string, input: { refreshTokenHash: string; expiresAt: Date }) {
    const session = await this.findActiveSession(id);
    if (!session) {
      return null;
    }
    const updated = { ...session, refreshTokenHash: input.refreshTokenHash, expiresAt: input.expiresAt };
    this.sessions.set(id, updated);
    return updated;
  }

  async revokeSession(id: string) {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }
    this.sessions.set(id, { ...session, revokedAt: new Date() });
    return true;
  }

  async listInviteCodes() {
    return Array.from(this.invites.values());
  }

  async createInviteCode(input: CreateInviteInput) {
    const code = input.code ?? randomUUID().replaceAll("-", "");
    if (this.findInviteByCode(code)) {
      throw new AuthRepositoryError(409, "invite_code_exists", "Invite code already exists");
    }
    const invite: InviteCode = {
      id: randomUUID(),
      code,
      createdBy: input.createdBy,
      usedCount: 0,
      maxUses: input.maxUses,
      expiresAt: input.expiresAt?.toISOString(),
      createdAt: new Date().toISOString()
    };
    this.invites.set(invite.id, invite);
    return invite;
  }

  async disableInviteCode(id: string) {
    const invite = this.invites.get(id);
    if (!invite) {
      return null;
    }
    const disabled = { ...invite, disabledAt: new Date().toISOString() };
    this.invites.set(disabled.id, disabled);
    return disabled;
  }
}

async function buildTestApp() {
  const repository = new InMemoryAuthRepository();
  const app = Fastify({ logger: false });
  app.setErrorHandler(apiErrorHandler);
  await app.register(cookie);
  await app.register(jwt, {
    cookie: {
      cookieName: "blogus_access_token",
      signed: false
    },
    secret: config.jwt.secret
  });
  app.decorate("authenticate", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string; sid?: string; tokenUse?: string }>();
      if (payload.tokenUse && payload.tokenUse !== "access") {
        return sendApiError(reply, 401, "invalid_token_type", "Invalid token type");
      }
      if (!payload.sid) {
        return sendApiError(reply, 401, "missing_session", "Missing session");
      }
      const session = await repository.findActiveSession(payload.sid);
      const user = await repository.findUserById(payload.sub);
      if (!session || !user) {
        return sendApiError(reply, 401, "unauthorized", "Unauthorized");
      }
      request.currentUser = toCurrentUser(user);
      request.authSessionId = session.id;
    } catch {
      return sendApiError(reply, 401, "unauthorized", "Unauthorized");
    }
  });
  await app.register(createAuthRoutes(() => repository), { prefix: "/api/auth" });

  return { app, repository };
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

test("first registered user becomes admin and can create reusable invites", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const first = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "admin@example.com", password: "password-1" }
  });
  assert.equal(first.statusCode, 201);
  const admin = first.json<{ user: CurrentUser; accessToken: string }>();
  assert.equal(admin.user.role, "admin");

  const inviteResponse = await app.inject({
    method: "POST",
    url: "/api/auth/invites",
    headers: authHeader(admin.accessToken),
    payload: { code: "team-code" }
  });
  assert.equal(inviteResponse.statusCode, 201);

  const second = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "writer@example.com", password: "password-2", inviteCode: "team-code" }
  });
  assert.equal(second.statusCode, 201);
  assert.equal(second.json<{ user: CurrentUser }>().user.role, "user");

  const invites = await app.inject({
    method: "GET",
    url: "/api/auth/invites",
    headers: authHeader(admin.accessToken)
  });
  assert.equal(invites.statusCode, 200);
  assert.equal(invites.json<{ invites: InviteCode[] }>().invites[0].usedCount, 1);
});

test("subsequent registration requires an active invite", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "admin@example.com", password: "password-1" }
  });

  const missingInvite = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "writer@example.com", password: "password-2" }
  });
  assert.equal(missingInvite.statusCode, 400);
});

test("non-admin users cannot manage invite codes", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const adminResponse = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "admin@example.com", password: "password-1" }
  });
  const admin = adminResponse.json<{ accessToken: string }>();
  await app.inject({
    method: "POST",
    url: "/api/auth/invites",
    headers: authHeader(admin.accessToken),
    payload: { code: "team-code" }
  });
  const userResponse = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "writer@example.com", password: "password-2", inviteCode: "team-code" }
  });
  const user = userResponse.json<{ accessToken: string }>();

  const denied = await app.inject({
    method: "POST",
    url: "/api/auth/invites",
    headers: authHeader(user.accessToken),
    payload: { code: "another-code" }
  });
  assert.equal(denied.statusCode, 403);
});
