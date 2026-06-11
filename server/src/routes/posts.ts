import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { sendApiError } from "../http/errors.js";
import { DrizzlePostRepository, type PostRepository, type PostVisibility } from "../repositories/posts.js";
import { createPostSchema, listPostsQuerySchema, updatePostSchema } from "../schema/posts.js";

type PostRepositoryFactory = (app: FastifyInstance) => PostRepository;

export function createPostRoutes(
  createRepository: PostRepositoryFactory = (app) => new DrizzlePostRepository(app.db)
): FastifyPluginAsync {
  return async (app) => {
    const repository = createRepository(app);

    app.get<{
      Querystring: unknown;
    }>("/", async (request, reply) => {
      const query = listPostsQuerySchema.parse(request.query);
      if (query.visibility === "all") {
        await app.authenticate(request, reply);
        if (reply.sent) {
          return reply;
        }
      }

      return {
        posts: await repository.listPosts({ visibility: query.visibility as PostVisibility })
      };
    });

    app.get<{
      Params: { slug: string };
      Querystring: unknown;
    }>("/:slug", async (request, reply) => {
      const query = listPostsQuerySchema.parse(request.query);
      if (query.visibility === "all") {
        await app.authenticate(request, reply);
        if (reply.sent) {
          return reply;
        }
      }

      const post = await repository.getPostBySlug(request.params.slug, {
        visibility: query.visibility as PostVisibility
      });
      if (!post) {
        return sendApiError(reply, 404, "post_not_found", "Post not found");
      }

      return { post };
    });

    app.post<{
      Body: unknown;
    }>("/", { preHandler: app.authenticate }, async (request, reply) => {
      const input = createPostSchema.parse(request.body);
      const post = await repository.createPost(input);

      reply.code(201);
      return { post };
    });

    app.patch<{
      Body: unknown;
      Params: { id: string };
    }>("/:id", { preHandler: app.authenticate }, async (request, reply) => {
      const input = updatePostSchema.parse(request.body);
      const post = await repository.updatePost(request.params.id, input);

      if (!post) {
        return sendApiError(reply, 404, "post_not_found", "Post not found");
      }

      return { post };
    });

    app.delete<{
      Params: { id: string };
    }>("/:id", { preHandler: app.authenticate }, async (request, reply) => {
      const deleted = await repository.deletePost(request.params.id);

      if (!deleted) {
        return sendApiError(reply, 404, "post_not_found", "Post not found");
      }

      return { ok: true };
    });
  };
}

export const postRoutes = createPostRoutes();
