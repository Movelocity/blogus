import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1).max(240),
  content: z.string().optional().default(""),
  status: z.enum(["draft", "published", "archived"]).optional().default("draft")
});

export const updatePostSchema = z.object({
  title: z.string().min(1).max(240).optional(),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional()
});
