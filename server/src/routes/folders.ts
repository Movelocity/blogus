import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { sendApiError } from "../http/errors.js";
import { DrizzleFolderRepository, type FolderRepository } from "../repositories/folders.js";
import { createFolderSchema, updateFolderSchema } from "../schema/folders.js";

type FolderRepositoryFactory = (app: FastifyInstance) => FolderRepository;

export function createFolderRoutes(
  createRepository: FolderRepositoryFactory = (app) => new DrizzleFolderRepository(app.db)
): FastifyPluginAsync {
  return async (app) => {
    const repository = createRepository(app);

    app.get("/", { preHandler: app.authenticate }, async (request) => ({
      folders: await repository.listFolders(request.currentUser!.id)
    }));

    app.post<{ Body: unknown }>("/", { preHandler: app.authenticate }, async (request, reply) => {
      const input = createFolderSchema.parse(request.body);
      const folder = await repository.createFolder(request.currentUser!.id, input.name);

      reply.code(201);
      return { folder };
    });

    app.patch<{ Body: unknown; Params: { id: string } }>(
      "/:id",
      { preHandler: app.authenticate },
      async (request, reply) => {
        const input = updateFolderSchema.parse(request.body);
        const folder = await repository.renameFolder(request.params.id, request.currentUser!.id, input.name);

        if (!folder) {
          return sendApiError(reply, 404, "folder_not_found", "Folder not found");
        }

        return { folder };
      }
    );

    app.delete<{ Params: { id: string } }>("/:id", { preHandler: app.authenticate }, async (request, reply) => {
      const deleted = await repository.deleteFolder(request.params.id, request.currentUser!.id);

      if (!deleted) {
        return sendApiError(reply, 404, "folder_not_found", "Folder not found");
      }

      return { ok: true };
    });
  };
}

export const folderRoutes = createFolderRoutes();
