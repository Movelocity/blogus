import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1).max(240),
  content: z.string().optional().default(""),
  excerpt: z.string().max(1000).optional(),
  coverImageUrl: z.string().max(2048).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  status: z.enum(["draft", "published", "archived"]).optional().default("draft")
});

export const updatePostSchema = z.object({
  title: z.string().min(1).max(240).optional(),
  content: z.string().optional(),
  excerpt: z.string().max(1000).optional(),
  coverImageUrl: z.string().max(2048).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  status: z.enum(["draft", "published", "archived"]).optional()
});

export const listPostsQuerySchema = z.object({
  visibility: z.enum(["published", "archived", "draft", "all"]).optional().default("published")
});
