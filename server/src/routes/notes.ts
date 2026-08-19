import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import type { NoteVisibility } from "@blogus/shared";
import { sendApiError } from "../http/errors.js";
import { DrizzleAuthRepository } from "../repositories/auth.js";
import { DrizzleNoteRepository, type NoteRepository } from "../repositories/notes.js";
import {
  archiveNoteSchema,
  calendarQuerySchema,
  createNoteSchema,
  listNotesQuerySchema,
  searchNotesQuerySchema,
  updateNoteSchema
} from "../schema/notes.js";

type NoteRepositoryFactory = (app: FastifyInstance) => NoteRepository;

/**
 * 可选鉴权：日历、搜索等轻量接口在「登录了」时返回更完整结果，
 * 匿名访问仍可用（返回公开数据）。复用 auth 的会话校验逻辑，不抛错。
 */
async function resolveOptionalUser(app: FastifyInstance, request: FastifyRequest): Promise<string | null> {
  try {
    const payload = await request.jwtVerify<{ sub: string; sid?: string }>();
    if (!payload.sid) {
      return null;
    }
    const session = await new DrizzleAuthRepository(app.db).findActiveSession(payload.sid);
    if (!session || session.userId !== payload.sub) {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

export function createNoteRoutes(
  createRepository: NoteRepositoryFactory = (app) => new DrizzleNoteRepository(app.db)
): FastifyPluginAsync {
  return async (app) => {
    const repository = createRepository(app);

    app.get<{ Querystring: unknown }>("/", async (request, reply) => {
      const query = listNotesQuerySchema.parse(request.query);
      if (query.visibility !== "published") {
        await app.authenticate(request, reply);
        if (reply.sent) {
          return reply;
        }
      }

      const userId = request.currentUser?.id ?? null;
      return repository.listNotes({
        visibility: query.visibility as NoteVisibility,
        date: query.date,
        tag: query.tag,
        isPublic: query.isPublic === undefined ? undefined : query.isPublic === "true",
        page: query.page,
        pageSize: query.pageSize,
        userId
      });
    });

    app.get<{ Querystring: unknown }>("/calendar", async (request) => {
      const query = calendarQuerySchema.parse(request.query);
      const userId = await resolveOptionalUser(app, request);
      const index = await repository.listCalendarStats(userId, query.year, query.month);
      return { index };
    });

    app.get<{ Querystring: unknown }>("/search", async (request) => {
      const query = searchNotesQuerySchema.parse(request.query);
      const userId = await resolveOptionalUser(app, request);
      return repository.searchNotes({
        keyword: query.keyword,
        page: query.page,
        pageSize: query.pageSize,
        userId
      });
    });

    app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
      const userId = await resolveOptionalUser(app, request);
      const note = await repository.getNoteById(request.params.id, userId);
      if (!note) {
        return sendApiError(reply, 404, "note_not_found", "Note not found");
      }
      return { note };
    });

    app.post<{ Body: unknown }>("/", { preHandler: app.authenticate }, async (request, reply) => {
      const input = createNoteSchema.parse(request.body);
      const note = await repository.createNote(request.currentUser!.id, input);
      reply.code(201);
      return { note };
    });

    app.patch<{ Body: unknown; Params: { id: string } }>(
      "/:id",
      { preHandler: app.authenticate },
      async (request, reply) => {
        const input = updateNoteSchema.parse(request.body);
        const note = await repository.updateNote(request.params.id, request.currentUser!.id, input);
        if (!note) {
          return sendApiError(reply, 404, "note_not_found", "Note not found");
        }
        return { note };
      }
    );

    app.put<{ Body: unknown; Params: { id: string } }>(
      "/:id/archive",
      { preHandler: app.authenticate },
      async (request, reply) => {
        const input = archiveNoteSchema.parse(request.body);
        const note = await repository.setArchived(request.params.id, request.currentUser!.id, input.isArchived);
        if (!note) {
          return sendApiError(reply, 404, "note_not_found", "Note not found");
        }
        return { note };
      }
    );

    app.delete<{ Params: { id: string } }>(
      "/:id",
      { preHandler: app.authenticate },
      async (request, reply) => {
        const deleted = await repository.deleteNote(request.params.id, request.currentUser!.id);
        if (!deleted) {
          return sendApiError(reply, 404, "note_not_found", "Note not found");
        }
        return { ok: true };
      }
    );
  };
}

export const noteRoutes = createNoteRoutes();
