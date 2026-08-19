import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const createNoteSchema = z.object({
  date: z.string().regex(DATE_PATTERN).optional(),
  content: z.string().trim().min(1),
  isPublic: z.boolean().optional().default(false),
  tags: z.array(z.string().trim().min(1).max(60)).max(12).optional()
});

export const updateNoteSchema = z.object({
  date: z.string().regex(DATE_PATTERN).optional(),
  content: z.string().trim().min(1).optional(),
  isPublic: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(12).optional()
});

export const listNotesQuerySchema = z.object({
  visibility: z.enum(["published", "archived", "all"]).optional().default("published"),
  date: z.string().regex(DATE_PATTERN).optional(),
  tag: z.string().trim().max(60).optional(),
  isPublic: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
});

export const calendarQuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2100),
  month: z.coerce.number().int().min(1).max(12)
});

export const searchNotesQuerySchema = z.object({
  keyword: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
});

export const archiveNoteSchema = z.object({
  isArchived: z.boolean()
});
