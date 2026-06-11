import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { config } from "../config.js";
import { sendApiError } from "../http/errors.js";
import { DrizzleAuthRepository, toCurrentUser } from "../repositories/auth.js";

export const accessTokenCookieName = "blogus_access_token";
export const refreshTokenCookieName = "blogus_refresh_token";

export const authPlugin = fp(async (app) => {
  await app.register(cookie);
  await app.register(jwt, {
    cookie: {
      cookieName: accessTokenCookieName,
      signed: false
    },
    secret: config.jwt.secret
  });

  app.decorate("authenticate", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{
        sub: string;
        sid?: string;
        email: string;
        name?: string;
        tokenUse?: string;
      }>();
      if (payload.tokenUse && payload.tokenUse !== "access") {
        return sendApiError(reply, 401, "invalid_token_type", "Invalid token type");
      }
      if (!payload.sid) {
        return sendApiError(reply, 401, "missing_session", "Missing session");
      }

      const repository = new DrizzleAuthRepository(app.db);
      const session = await repository.findActiveSession(payload.sid);
      if (!session || session.userId !== payload.sub) {
        return sendApiError(reply, 401, "invalid_session", "Invalid session");
      }

      const user = await repository.findUserById(payload.sub);
      if (!user) {
        return sendApiError(reply, 401, "invalid_user", "Invalid user");
      }

      request.currentUser = toCurrentUser(user);
      request.authSessionId = session.id;
    } catch {
      return sendApiError(reply, 401, "unauthorized", "Unauthorized");
    }
  });
});
