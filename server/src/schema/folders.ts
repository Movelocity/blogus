import { z } from "zod";

export const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(120)
});
