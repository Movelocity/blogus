import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from "fastify";
import { config, parseDurationSeconds } from "../config.js";
import { accessTokenCookieName, refreshTokenCookieName } from "../plugins/auth.js";

interface AuthTokenPayload {
  sub: string;
  email: string;
  name?: string;
  tokenUse?: "access" | "refresh";
}

function createAuthTokens(app: FastifyInstance, user: { id: string; email: string; name?: string }) {
  const accessToken = app.jwt.sign(
    { email: user.email, name: user.name, tokenUse: "access" },
    { sub: user.id, expiresIn: config.jwt.expiry }
  );
  const refreshToken = app.jwt.sign(
    { email: user.email, name: user.name, tokenUse: "refresh" },
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

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: { email: string; name?: string };
  }>("/dev-login", async (request, reply) => {
    const user = {
      id: "dev-user",
      email: request.body.email,
      name: request.body.name
    };
    const tokens = createAuthTokens(app, user);

    setAuthCookies(reply, tokens);

    return { user, ...tokens };
  });

  app.get("/whoami", { preHandler: app.authenticate }, async (request) => ({
    user: request.currentUser
  }));

  app.post("/refresh", async (request, reply) => {
    const token = request.cookies[refreshTokenCookieName];
    if (!token) {
      reply.code(401);
      return { error: "Missing refresh token" };
    }

    try {
      const payload = app.jwt.verify<AuthTokenPayload>(token);
      if (payload.tokenUse !== "refresh") {
        reply.code(401);
        return { error: "Invalid token type" };
      }

      const user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name
      };
      const tokens = createAuthTokens(app, user);
      setAuthCookies(reply, tokens);

      return { user, ...tokens };
    } catch {
      reply.code(401);
      return { error: "Invalid refresh token" };
    }
  });

  app.get<{
    Querystring: { port?: string; token?: string };
  }>("/device", async (request) => ({
    message: "Device authorization placeholder",
    callbackPort: request.query.port,
    requestToken: request.query.token
  }));

  app.post("/logout", async (_request, reply) => {
    reply.clearCookie(accessTokenCookieName, { path: "/" });
    reply.clearCookie(refreshTokenCookieName, { path: "/api/auth" });
    reply.clearCookie("blogus_token", { path: "/" });
    return { ok: true };
  });
};
