import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { hashToken, verifyPassword } from "../auth/password.js";
import { config, parseDurationSeconds } from "../config.js";
import { sendApiError } from "../http/errors.js";
import { accessTokenCookieName, refreshTokenCookieName } from "../plugins/auth.js";
import {
  AuthRepositoryError,
  DrizzleAuthRepository,
  toCurrentUser,
  type AuthRepository
} from "../repositories/auth.js";

interface AuthTokenPayload {
  sub: string;
  sid?: string;
  email: string;
  name?: string;
  role?: "admin" | "user";
  tokenUse?: "access" | "refresh";
}

type AuthRepositoryFactory = (app: FastifyInstance) => AuthRepository;

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1)
});

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(256),
  name: z.string().trim().max(120).optional(),
  inviteCode: z.string().trim().min(1).max(120).optional()
});

const devLoginSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(120).optional()
});

const createInviteSchema = z.object({
  code: z.string().trim().min(1).max(120).optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional()
});

const inviteParamsSchema = z.object({
  id: z.string().uuid()
});

function refreshExpiryDate() {
  const seconds = parseDurationSeconds(config.jwt.refreshExpiry);
  return new Date(Date.now() + (seconds ?? 60 * 60 * 24 * 30) * 1000);
}

function createAuthTokens(
  app: FastifyInstance,
  user: { id: string; email: string; name?: string; role: "admin" | "user" },
  sessionId: string
) {
  const accessToken = app.jwt.sign(
    { email: user.email, name: user.name, role: user.role, sid: sessionId, tokenUse: "access" },
    { sub: user.id, expiresIn: config.jwt.expiry }
  );
  const refreshToken = app.jwt.sign(
    { email: user.email, name: user.name, role: user.role, sid: sessionId, tokenUse: "refresh" },
    { sub: user.id, expiresIn: config.jwt.refreshExpiry }
  );

  return { accessToken, refreshToken };
}

function setAuthCookies(reply: FastifyReply, tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  reply.setCookie(accessTokenCookieName, tokens.accessToken, {
    httpOnly: true,
    maxAge: parseDurationSeconds(config.jwt.expiry),
    path: "/",
    sameSite: "lax"
  });
  reply.setCookie(refreshTokenCookieName, tokens.refreshToken, {
    httpOnly: true,
    maxAge: parseDurationSeconds(config.jwt.refreshExpiry),
    path: "/api/auth",
    sameSite: "lax"
  });
}

async function createAuthenticatedSession(
  app: FastifyInstance,
  repository: AuthRepository,
  user: { id: string; email: string; name?: string | null; role: "admin" | "user" }
) {
  const currentUser = {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role
  };
  const session = await repository.createSession({
    userId: user.id,
    refreshTokenHash: `pending:${randomUUID()}`,
    expiresAt: refreshExpiryDate()
  });
  const tokens = createAuthTokens(app, currentUser, session.id);
  await repository.rotateSession(session.id, {
    refreshTokenHash: hashToken(tokens.refreshToken),
    expiresAt: refreshExpiryDate()
  });

  return { user: currentUser, ...tokens };
}

function sendRepositoryError(reply: FastifyReply, cause: unknown) {
  if (cause instanceof AuthRepositoryError) {
    return sendApiError(reply, cause.statusCode, cause.code, cause.message);
  }

  throw cause;
}

async function requireAdmin(app: FastifyInstance, request: Parameters<FastifyInstance["authenticate"]>[0], reply: FastifyReply) {
  await app.authenticate(request, reply);
  if (reply.sent) {
    return;
  }
  if (request.currentUser?.role !== "admin") {
    return sendApiError(reply, 403, "admin_required", "Admin permission is required");
  }
}

export function createAuthRoutes(
  createRepository: AuthRepositoryFactory = (app) => new DrizzleAuthRepository(app.db)
): FastifyPluginAsync {
  return async (app) => {
    const repository = createRepository(app);

  app.get("/status", async () => {
    const userCount = await repository.countUsers();
    return { initialized: userCount > 0 };
  });

  app.post<{
    Body: unknown;
  }>("/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await repository.findUserByEmail(input.email);
    const validPassword = user ? await verifyPassword(input.password, user.passwordHash) : false;

    if (!user || !validPassword) {
      return sendApiError(reply, 401, "invalid_credentials", "Invalid email or password");
    }

    const result = await createAuthenticatedSession(app, repository, user);
    setAuthCookies(reply, result);

    return result;
  });

  app.post<{
    Body: unknown;
  }>("/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);

    try {
      const user = await repository.registerUser(input);
      const result = await createAuthenticatedSession(app, repository, user);
      setAuthCookies(reply, result);

      reply.code(201);
      return result;
    } catch (cause) {
      return sendRepositoryError(reply, cause);
    }
  });

  app.post<{
    Body: unknown;
  }>("/dev-login", async (request, reply) => {
    if (!config.auth.enableDevLogin || config.nodeEnv === "production") {
      return sendApiError(reply, 404, "not_found", "Not found");
    }

    const input = devLoginSchema.parse(request.body);
    const user = await repository.upsertDevUser(input);
    const result = await createAuthenticatedSession(app, repository, user);

    setAuthCookies(reply, result);

    return result;
  });

  app.get("/whoami", { preHandler: app.authenticate }, async (request) => ({
    user: request.currentUser
  }));

  app.post("/refresh", async (request, reply) => {
    const cookieToken = request.cookies[refreshTokenCookieName];
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const token = cookieToken ?? bearerToken;
    if (!token) {
      return sendApiError(reply, 401, "missing_refresh_token", "Missing refresh token");
    }

    try {
      const payload = app.jwt.verify<AuthTokenPayload>(token);
      if (payload.tokenUse !== "refresh") {
        return sendApiError(reply, 401, "invalid_token_type", "Invalid token type");
      }
      if (!payload.sid) {
        return sendApiError(reply, 401, "missing_session", "Missing session");
      }

      const session = await repository.findActiveSession(payload.sid);
      if (!session || session.userId !== payload.sub || session.refreshTokenHash !== hashToken(token)) {
        return sendApiError(reply, 401, "invalid_refresh_token", "Invalid refresh token");
      }

      const userRow = await repository.findUserById(payload.sub);
      if (!userRow) {
        return sendApiError(reply, 401, "invalid_user", "Invalid user");
      }

      const user = toCurrentUser(userRow);
      const tokens = createAuthTokens(app, user, session.id);
      await repository.rotateSession(session.id, {
        refreshTokenHash: hashToken(tokens.refreshToken),
        expiresAt: refreshExpiryDate()
      });
      setAuthCookies(reply, tokens);

      return { user, ...tokens };
    } catch {
      return sendApiError(reply, 401, "invalid_refresh_token", "Invalid refresh token");
    }
  });

  app.post("/logout", { preHandler: app.authenticate }, async (request, reply) => {
    if (request.authSessionId) {
      await repository.revokeSession(request.authSessionId);
    }
    reply.clearCookie(accessTokenCookieName, { path: "/" });
    reply.clearCookie(refreshTokenCookieName, { path: "/api/auth" });
    reply.clearCookie("blogus_token", { path: "/" });
    return { ok: true };
  });

  app.get("/invites", async (request, reply) => {
    await requireAdmin(app, request, reply);
    if (reply.sent) {
      return reply;
    }

    return { invites: await repository.listInviteCodes() };
  });

  app.post<{
    Body: unknown;
  }>("/invites", async (request, reply) => {
    await requireAdmin(app, request, reply);
    if (reply.sent) {
      return reply;
    }

    const input = createInviteSchema.parse(request.body);
    try {
      const invite = await repository.createInviteCode({
        code: input.code,
        createdBy: request.currentUser!.id,
        maxUses: input.maxUses,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined
      });

      reply.code(201);
      return { invite };
    } catch (cause) {
      return sendRepositoryError(reply, cause);
    }
  });

  app.post<{
    Params: unknown;
  }>("/invites/:id/disable", async (request, reply) => {
    await requireAdmin(app, request, reply);
    if (reply.sent) {
      return reply;
    }

    const params = inviteParamsSchema.parse(request.params);
    const invite = await repository.disableInviteCode(params.id);
    if (!invite) {
      return sendApiError(reply, 404, "invite_code_not_found", "Invite code not found");
    }

    return { invite };
  });
  };
}

export const authRoutes = createAuthRoutes();
