import type { FastifyPluginAsync } from "fastify";

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "Missing multipart file field" };
    }

    const stored = await app.storage.putFile({
      filename: file.filename,
      contentType: file.mimetype,
      stream: file.file
    });

    return {
      file: stored
    };
  });
};
