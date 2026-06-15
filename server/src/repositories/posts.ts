import { randomUUID } from "node:crypto";
import type { BlogPost, CreatePostInput, PostStatus, PostVisibility, UpdatePostInput } from "@blogus/shared";
import { and, desc, eq, ne } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.js";
import { posts } from "../db/schema.js";

export type PostsDatabase = PostgresJsDatabase<typeof schema>;

export interface PostRepository {
  listPosts(options?: { visibility?: PostVisibility }): Promise<BlogPost[]>;
  getPostBySlug(slug: string, options?: { visibility?: PostVisibility }): Promise<BlogPost | null>;
  createPost(input: CreatePostInput): Promise<BlogPost>;
  updatePost(id: string, input: UpdatePostInput): Promise<BlogPost | null>;
  deletePost(id: string): Promise<boolean>;
}

type PostRow = typeof posts.$inferSelect;

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function toBlogPost(row: PostRow): BlogPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    excerpt: row.excerpt ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    tags: row.tags ?? [],
    status: row.status as PostStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString()
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export class DrizzlePostRepository implements PostRepository {
  constructor(private readonly db: PostsDatabase) {}

  async listPosts(options: { visibility?: PostVisibility } = {}) {
    const visibility = options.visibility ?? "published";
    const query = this.db.select().from(posts);

    const rows = await (() => {
      switch (visibility) {
        case "published":
          return query.where(eq(posts.status, "published")).orderBy(desc(posts.createdAt));
        case "draft":
          return query.where(eq(posts.status, "draft")).orderBy(desc(posts.createdAt));
        case "archived":
          return query.where(eq(posts.status, "archived")).orderBy(desc(posts.createdAt));
        case "all":
        default:
          return query.orderBy(desc(posts.createdAt));
      }
    })();

    return rows.map(toBlogPost);
  }

  async getPostBySlug(slug: string, options: { visibility?: PostVisibility } = {}) {
    const visibility = options.visibility ?? "published";
    const filters =
      visibility === "published"
        ? and(eq(posts.slug, slug), eq(posts.status, "published"))
        : eq(posts.slug, slug);
    const [row] = await this.db.select().from(posts).where(filters).limit(1);

    return row ? toBlogPost(row) : null;
  }

  async createPost(input: CreatePostInput) {
    const now = new Date();
    const status = input.status ?? "draft";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = randomUUID();
      const slug = await this.createUniqueSlug(input.title);

      try {
        const [row] = await this.db
          .insert(posts)
          .values({
            id,
            title: input.title,
            slug,
            content: input.content ?? "",
            excerpt: input.excerpt?.trim() || null,
            coverImageUrl: input.coverImageUrl?.trim() || null,
            tags: input.tags ?? [],
            status,
            createdAt: now,
            updatedAt: now,
            publishedAt: status === "published" ? now : null
          })
          .returning();

        return toBlogPost(row);
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }

    throw new Error("Unable to generate a unique slug");
  }

  async updatePost(id: string, input: UpdatePostInput) {
    const existing = await this.findPost(id);
    if (!existing) {
      return null;
    }

    const now = new Date();
    const nextStatus = input.status ?? existing.status;
    const slug =
      input.title && input.title !== existing.title
        ? await this.createUniqueSlug(input.title, id)
        : existing.slug;
    const publishedAt =
      nextStatus === "published"
        ? existing.publishedAt
          ? new Date(existing.publishedAt)
          : now
        : existing.publishedAt
          ? new Date(existing.publishedAt)
          : null;

    const [row] = await this.db
      .update(posts)
      .set({
        ...(input.title === undefined ? {} : { title: input.title, slug }),
        ...(input.content === undefined ? {} : { content: input.content }),
        ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt.trim() || null }),
        ...(input.coverImageUrl === undefined
          ? {}
          : { coverImageUrl: input.coverImageUrl.trim() || null }),
        ...(input.tags === undefined ? {} : { tags: input.tags }),
        ...(input.status === undefined ? {} : { status: input.status }),
        updatedAt: now,
        publishedAt
      })
      .where(eq(posts.id, id))
      .returning();

    return row ? toBlogPost(row) : null;
  }

  async deletePost(id: string) {
    const deletedRows = await this.db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
    return deletedRows.length > 0;
  }

  private async findPost(id: string) {
    const [row] = await this.db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return row ? toBlogPost(row) : null;
  }

  private async createUniqueSlug(title: string, excludeId?: string) {
    const baseSlug = slugify(title) || "post";

    for (let suffix = 0; suffix < 100; suffix += 1) {
      const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
      const filters = excludeId
        ? and(eq(posts.slug, candidate), ne(posts.id, excludeId))
        : eq(posts.slug, candidate);
      const existing = await this.db.select({ id: posts.id }).from(posts).where(filters).limit(1);

      if (existing.length === 0) {
        return candidate;
      }
    }

    return `${baseSlug}-${randomUUID().slice(0, 8)}`;
  }
}
