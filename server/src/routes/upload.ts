import type { FastifyPluginAsync } from "fastify";
import { sendApiError } from "../http/errors.js";

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return sendApiError(reply, 400, "missing_file", "Missing multipart file field");
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
