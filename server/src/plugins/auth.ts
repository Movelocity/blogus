import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import fp from "fastify-plugin";

export const authPlugin = fp(async (app) => {
  await app.register(cookie);
  await app.register(jwt, {
    cookie: {
      cookieName: "blogus_token",
      signed: false
    },
    secret: process.env.JWT_SECRET ?? "blogus-development-secret"
  });

  app.decorate("authenticate", async (request, reply) => {
    try {
      const payload = await request.jwtVerify<{
        sub: string;
        email: string;
        name?: string;
      }>();
      request.currentUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name
      };
    } catch {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });
});
