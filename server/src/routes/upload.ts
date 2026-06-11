import type { FastifyPluginAsync } from "fastify";

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", { preHandler: app.authenticate }, async () => ({
    url: null,
    message: "Upload route placeholder. Multipart storage will be added in the upload phase."
  }));
};
