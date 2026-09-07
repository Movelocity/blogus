import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { UpdateTextCardPaneInput } from "@blogus/shared";
import { sendApiError } from "../http/errors.js";
import { DrizzleTextCardRepository, type TextCardRepository } from "../repositories/text-cards.js";
import { importPanesSchema, createPaneSchema, updatePaneSchema, updateWorkspaceSchema } from "../schema/text-cards.js";

type TextCardRepositoryFactory = (app: FastifyInstance) => TextCardRepository;

export function createTextCardRoutes(
  createRepository: TextCardRepositoryFactory = (app) => new DrizzleTextCardRepository(app.db)
): FastifyPluginAsync {
  return async (app) => {
    const repository = createRepository(app);
    const auth = { preHandler: app.authenticate };

    app.get("/workspaces", auth, async (request) => ({
      workspaces: await repository.listWorkspaces(request.currentUser!.id)
    }));

    app.post("/workspaces", auth, async (request, reply) => {
      const workspace = await repository.createWorkspace(request.currentUser!.id);
      reply.code(201);
      return { workspace };
    });

    app.patch<{ Body: unknown; Params: { id: string } }>("/workspaces/:id", auth, async (request, reply) => {
      const input = updateWorkspaceSchema.parse(request.body);
      const workspace = await repository.updateWorkspace(request.params.id, request.currentUser!.id, input.name);

      if (!workspace) {
        return sendApiError(reply, 404, "workspace_not_found", "Workspace not found");
      }

      return { workspace };
    });

    app.delete<{ Params: { id: string } }>("/workspaces/:id", auth, async (request, reply) => {
      const result = await repository.deleteWorkspace(request.params.id, request.currentUser!.id);

      if (result === "not_found") {
        return sendApiError(reply, 404, "workspace_not_found", "Workspace not found");
      }
      if (result === "last_workspace") {
        return sendApiError(reply, 400, "last_workspace", "Cannot delete the last workspace");
      }

      return { ok: true };
    });

    app.get<{ Params: { id: string } }>("/workspaces/:id/panes", auth, async (request, reply) => {
      const panes = await repository.listPanes(request.params.id, request.currentUser!.id);

      if (panes === null) {
        return sendApiError(reply, 404, "workspace_not_found", "Workspace not found");
      }

      return { panes };
    });

    app.post<{ Body: unknown; Params: { id: string } }>("/workspaces/:id/panes", auth, async (request, reply) => {
      const input = createPaneSchema.parse(request.body ?? {});
      const pane = await repository.createPane(request.params.id, request.currentUser!.id, input);

      if (!pane) {
        return sendApiError(reply, 404, "workspace_not_found", "Workspace not found");
      }

      reply.code(201);
      return { pane };
    });

    app.post<{ Body: unknown; Params: { id: string } }>("/workspaces/:id/import", auth, async (request, reply) => {
      const input = importPanesSchema.parse(request.body);
      const panes = await repository.importPanes(request.params.id, request.currentUser!.id, input.panes);

      if (panes === null) {
        return sendApiError(reply, 404, "workspace_not_found", "Workspace not found");
      }

      return { panes };
    });

    app.patch<{ Body: unknown; Params: { id: string } }>("/panes/:id", auth, async (request, reply) => {
      const raw = updatePaneSchema.parse(request.body);
      const input: UpdateTextCardPaneInput = {
        ...raw,
        hlMode: raw.hlMode as UpdateTextCardPaneInput["hlMode"] | undefined
      };
      const pane = await repository.updatePane(request.params.id, request.currentUser!.id, input);

      if (!pane) {
        return sendApiError(reply, 404, "pane_not_found", "Pane not found");
      }

      return { pane };
    });

    app.delete<{ Params: { id: string } }>("/panes/:id", auth, async (request, reply) => {
      const deleted = await repository.deletePane(request.params.id, request.currentUser!.id);

      if (!deleted) {
        return sendApiError(reply, 404, "pane_not_found", "Pane not found");
      }

      return { ok: true };
    });
  };
}

export const textCardRoutes = createTextCardRoutes();
