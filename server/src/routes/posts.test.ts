import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import type { BlogPost, CreatePostInput, PostStatus, PostVisibility, UpdatePostInput } from "@blogus/shared";
import Fastify from "fastify";
import { apiErrorHandler } from "../http/errors.js";
import { sendApiError } from "../http/errors.js";
import type { PostRepository } from "../repositories/posts.js";
import { slugify } from "../repositories/posts.js";
import { createPostRoutes } from "./posts.js";

class InMemoryPostRepository implements PostRepository {
  private readonly posts = new Map<string, BlogPost>();

  async listPosts(options: { visibility?: PostVisibility } = {}) {
    return Array.from(this.posts.values())
      .filter((post) => (options.visibility ?? "published") === "all" || post.status === "published")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getPostBySlug(slug: string, options: { visibility?: PostVisibility } = {}) {
    const post = Array.from(this.posts.values()).find(
      (item) => item.slug === slug && ((options.visibility ?? "published") === "all" || item.status === "published")
    );
    return post ?? null;
  }

  async createPost(input: CreatePostInput) {
    const now = new Date().toISOString();
    const status = input.status ?? "draft";
    const post: BlogPost = {
      id: randomUUID(),
      title: input.title,
      slug: this.createUniqueSlug(input.title),
      content: input.content ?? "",
      excerpt: input.excerpt,
      coverImageUrl: input.coverImageUrl,
      tags: input.tags ?? [],
      folderId: input.folderId ?? undefined,
      status,
      createdAt: now,
      updatedAt: now,
      publishedAt: status === "published" ? now : undefined
    };

    this.posts.set(post.id, post);
    return post;
  }

  async updatePost(id: string, input: UpdatePostInput) {
    const existing = this.posts.get(id);
    if (!existing) {
      return null;
    }

    const status = input.status ?? existing.status;
    const updated: BlogPost = {
      ...existing,
      ...input,
      folderId: input.folderId === undefined ? existing.folderId : input.folderId ?? undefined,
      status,
      slug:
        input.title && input.title !== existing.title
          ? this.createUniqueSlug(input.title, existing.id)
          : existing.slug,
      updatedAt: new Date().toISOString(),
      publishedAt:
        status === "published"
          ? existing.publishedAt ?? new Date().toISOString()
          : undefined
    };

    this.posts.set(id, updated);
    return updated;
  }

  async deletePost(id: string) {
    return this.posts.delete(id);
  }

  private createUniqueSlug(title: string, excludeId?: string) {
    const base = slugify(title) || "post";
    let suffix = 0;

    while (true) {
      const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
      const taken = Array.from(this.posts.values()).some(
        (post) => post.slug === candidate && post.id !== excludeId
      );

      if (!taken) {
        return candidate;
      }

      suffix += 1;
    }
  }
}

async function buildTestApp(options: { authenticated?: boolean } = { authenticated: true }) {
  const repository = new InMemoryPostRepository();
  const app = Fastify({ logger: false });
  app.setErrorHandler(apiErrorHandler);
  app.decorate("authenticate", async (_request, reply) => {
    if (options.authenticated === false) {
      return sendApiError(reply, 401, "unauthorized", "Unauthorized");
    }
  });
  await app.register(createPostRoutes(() => repository), { prefix: "/api/posts" });

  return { app, repository };
}

test("requires authentication for management list and write operations", async (t) => {
  const { app } = await buildTestApp({ authenticated: false });
  t.after(async () => app.close());

  const publicList = await app.inject({ method: "GET", url: "/api/posts" });
  assert.equal(publicList.statusCode, 200);

  const adminList = await app.inject({ method: "GET", url: "/api/posts?visibility=all" });
  assert.equal(adminList.statusCode, 401);

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: { title: "Blocked" }
  });
  assert.equal(createResponse.statusCode, 401);
});

test("creates drafts, lists only published posts by default, and lists all posts for management", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const draftResponse = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: { title: "Draft title", content: "Draft body" }
  });
  assert.equal(draftResponse.statusCode, 201);

  const publishedResponse = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: { title: "Published title", status: "published" as PostStatus }
  });
  assert.equal(publishedResponse.statusCode, 201);

  const publicList = await app.inject({ method: "GET", url: "/api/posts" });
  assert.equal(publicList.statusCode, 200);
  assert.deepEqual(
    publicList.json<{ posts: BlogPost[] }>().posts.map((post) => post.title),
    ["Published title"]
  );

  const adminList = await app.inject({ method: "GET", url: "/api/posts?visibility=all" });
  assert.equal(adminList.statusCode, 200);
  assert.equal(adminList.json<{ posts: BlogPost[] }>().posts.length, 2);
});

test("reads published posts by slug without exposing drafts publicly", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const draftResponse = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: { title: "Private notes", content: "Hidden" }
  });
  const publishedResponse = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: {
      title: "Public notes",
      content: "# Hello",
      excerpt: "Short intro",
      coverImageUrl: "/uploads/cover.png",
      tags: ["release", "notes"],
      status: "published" as PostStatus
    }
  });

  const draft = draftResponse.json<{ post: BlogPost }>().post;
  const published = publishedResponse.json<{ post: BlogPost }>().post;
  const publicRead = await app.inject({ method: "GET", url: `/api/posts/${published.slug}` });
  assert.equal(publicRead.statusCode, 200);
  assert.deepEqual(publicRead.json<{ post: BlogPost }>().post.tags, ["release", "notes"]);
  assert.equal(publicRead.json<{ post: BlogPost }>().post.coverImageUrl, "/uploads/cover.png");

  const draftRead = await app.inject({ method: "GET", url: `/api/posts/${draft.slug}` });
  assert.equal(draftRead.statusCode, 404);

  const adminDraftRead = await app.inject({ method: "GET", url: `/api/posts/${draft.slug}?visibility=all` });
  assert.equal(adminDraftRead.statusCode, 200);
});

test("generates stable unique slugs for empty, duplicate, and special-character titles", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const special = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: { title: "Hello, 世界!!!" }
  });
  const firstEmpty = await app.inject({ method: "POST", url: "/api/posts", payload: { title: "!!!" } });
  const secondEmpty = await app.inject({ method: "POST", url: "/api/posts", payload: { title: "..." } });
  const duplicate = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: { title: "Hello 世界" }
  });

  assert.equal(special.json<{ post: BlogPost }>().post.slug, "hello-世界");
  assert.equal(firstEmpty.json<{ post: BlogPost }>().post.slug, "post");
  assert.equal(secondEmpty.json<{ post: BlogPost }>().post.slug, "post-2");
  assert.equal(duplicate.json<{ post: BlogPost }>().post.slug, "hello-世界-2");
});

test("updates, publishes, and deletes posts", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: { title: "Original", content: "Old" }
  });
  const created = createResponse.json<{ post: BlogPost }>().post;

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/posts/${created.id}`,
    payload: { title: "Updated", content: "New", status: "published" }
  });
  assert.equal(updateResponse.statusCode, 200);
  const updated = updateResponse.json<{ post: BlogPost }>().post;
  assert.equal(updated.title, "Updated");
  assert.equal(updated.content, "New");
  assert.equal(updated.status, "published");
  assert.ok(updated.publishedAt);

  const unpublishResponse = await app.inject({
    method: "PATCH",
    url: `/api/posts/${created.id}`,
    payload: { status: "draft" }
  });
  assert.equal(unpublishResponse.statusCode, 200);
  const unpublished = unpublishResponse.json<{ post: BlogPost }>().post;
  assert.equal(unpublished.status, "draft");
  assert.equal(unpublished.publishedAt, undefined);

  const deleteResponse = await app.inject({ method: "DELETE", url: `/api/posts/${created.id}` });
  assert.equal(deleteResponse.statusCode, 200);
  assert.deepEqual(deleteResponse.json(), { ok: true });
});

test("assigns and clears the folder of a post", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const folderId = randomUUID();
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: { title: "Grouped note", folderId }
  });
  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.json<{ post: BlogPost }>().post.folderId, folderId);

  const created = createResponse.json<{ post: BlogPost }>().post;
  const clearResponse = await app.inject({
    method: "PATCH",
    url: `/api/posts/${created.id}`,
    payload: { folderId: null }
  });
  assert.equal(clearResponse.json<{ post: BlogPost }>().post.folderId, undefined);

  const adminList = await app.inject({ method: "GET", url: "/api/posts?visibility=all" });
  assert.equal(adminList.json<{ posts: BlogPost[] }>().posts[0]?.folderId, undefined);
});

test("returns clear 400 and 404 errors", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const invalidResponse = await app.inject({
    method: "POST",
    url: "/api/posts",
    payload: { title: "" }
  });
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(invalidResponse.json<{ error: { code: string } }>().error.code, "validation_failed");

  const missingResponse = await app.inject({
    method: "PATCH",
    url: "/api/posts/missing-id",
    payload: { content: "Nope" }
  });
  assert.equal(missingResponse.statusCode, 404);
  assert.deepEqual(missingResponse.json(), {
    error: {
      code: "post_not_found",
      message: "Post not found"
    }
  });
});
