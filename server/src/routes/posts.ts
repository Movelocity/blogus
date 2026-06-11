import { randomUUID } from "node:crypto";
import type { BlogPost } from "@blogus/shared";
import type { FastifyPluginAsync } from "fastify";
import { createPostSchema, updatePostSchema } from "../schema/posts.js";

const posts = new Map<string, BlogPost>();

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export const postRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({
    posts: Array.from(posts.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }));

  app.post<{
    Body: unknown;
  }>("/", async (request, reply) => {
    const input = createPostSchema.parse(request.body);
    const now = new Date().toISOString();
    const id = randomUUID();
    const post: BlogPost = {
      id,
      title: input.title,
      slug: `${slugify(input.title) || "post"}-${id.slice(0, 8)}`,
      content: input.content,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      publishedAt: input.status === "published" ? now : undefined
    };

    posts.set(id, post);
    reply.code(201);
    return { post };
  });

  app.patch<{
    Body: unknown;
    Params: { id: string };
  }>("/:id", async (request, reply) => {
    const existing = posts.get(request.params.id);
    if (!existing) {
      reply.code(404);
      return { error: "Post not found" };
    }

    const input = updatePostSchema.parse(request.body);
    const updated: BlogPost = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
      publishedAt:
        input.status === "published" && !existing.publishedAt
          ? new Date().toISOString()
          : existing.publishedAt
    };
    posts.set(existing.id, updated);
    return { post: updated };
  });

  app.delete<{
    Params: { id: string };
  }>("/:id", async (request, reply) => {
    if (!posts.delete(request.params.id)) {
      reply.code(404);
      return { error: "Post not found" };
    }
    return { ok: true };
  });
};
