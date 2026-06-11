import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { config } from "../config.js";
import { sendApiError } from "../http/errors.js";

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
        email: string;
        name?: string;
        tokenUse?: string;
      }>();
      if (payload.tokenUse && payload.tokenUse !== "access") {
        sendApiError(reply, 401, "invalid_token_type", "Invalid token type");
        return;
      }

      request.currentUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name
      };
    } catch {
      sendApiError(reply, 401, "unauthorized", "Unauthorized");
    }
  });
});
