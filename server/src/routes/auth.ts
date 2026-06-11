import type { FastifyPluginAsync } from "fastify";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: { email: string; name?: string };
  }>("/dev-login", async (request, reply) => {
    const user = {
      id: "dev-user",
      email: request.body.email,
      name: request.body.name
    };
    const token = app.jwt.sign({ email: user.email, name: user.name }, { subject: user.id });

    reply.setCookie("blogus_token", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax"
    });

    return { user, token };
  });

  app.get("/whoami", { preHandler: app.authenticate }, async (request) => ({
    user: request.currentUser
  }));

  app.get<{
    Querystring: { port?: string; token?: string };
  }>("/device", async (request) => ({
    message: "Device authorization placeholder",
    callbackPort: request.query.port,
    requestToken: request.query.token
  }));

  app.post("/logout", async (_request, reply) => {
    reply.clearCookie("blogus_token", { path: "/" });
    return { ok: true };
  });
};
