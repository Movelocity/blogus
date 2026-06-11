import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { hashPassword, hashToken, verifyPassword } from "../auth/password.js";
import { config, parseDurationSeconds } from "../config.js";
import { sendApiError } from "../http/errors.js";
import { accessTokenCookieName, refreshTokenCookieName } from "../plugins/auth.js";
import { DrizzleAuthRepository, toCurrentUser } from "../repositories/auth.js";
import { users } from "../db/schema.js";

interface AuthTokenPayload {
  sub: string;
  sid?: string;
  email: string;
  name?: string;
  tokenUse?: "access" | "refresh";
}

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1)
});

const devLoginSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(120).optional()
});

function refreshExpiryDate() {
  const seconds = parseDurationSeconds(config.jwt.refreshExpiry);
  return new Date(Date.now() + (seconds ?? 60 * 60 * 24 * 30) * 1000);
}

function createAuthTokens(
  app: FastifyInstance,
  user: { id: string; email: string; name?: string },
  sessionId: string
) {
  const accessToken = app.jwt.sign(
    { email: user.email, name: user.name, sid: sessionId, tokenUse: "access" },
    { sub: user.id, expiresIn: config.jwt.expiry }
  );
  const refreshToken = app.jwt.sign(
    { email: user.email, name: user.name, sid: sessionId, tokenUse: "refresh" },
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
  repository: DrizzleAuthRepository,
  user: { id: string; email: string; name?: string | null }
) {
  const currentUser = {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined
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

export const authRoutes: FastifyPluginAsync = async (app) => {
  const repository = new DrizzleAuthRepository(app.db);

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
  }>("/dev-login", async (request, reply) => {
    if (!config.auth.enableDevLogin || config.nodeEnv === "production") {
      return sendApiError(reply, 404, "not_found", "Not found");
    }

    const input = devLoginSchema.parse(request.body);
    const passwordHash = await hashPassword(randomUUID());
    const [user] = await app.db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        name: input.name ?? null,
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
    const result = await createAuthenticatedSession(app, repository, user);

    setAuthCookies(reply, result);

    return result;
  });

  app.get("/whoami", { preHandler: app.authenticate }, async (request) => ({
    user: request.currentUser
  }));

  app.post("/refresh", async (request, reply) => {
    const token = request.cookies[refreshTokenCookieName];
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
};
