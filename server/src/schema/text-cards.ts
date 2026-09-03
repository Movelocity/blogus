import { z } from "zod";

const COORD_MIN = -100_000;
const COORD_MAX = 100_000;
const SIZE_MIN = 80;
const SIZE_MAX = 10_000;
const HL_MODE_MAX = 32;

const coordSchema = z.number().int().min(COORD_MIN).max(COORD_MAX);
const sizeSchema = z.number().int().min(SIZE_MIN).max(SIZE_MAX);
const hlModeSchema = z.string().max(HL_MODE_MAX);

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export const updatePaneSchema = z
  .object({
    title: z.string().max(500).optional(),
    content: z.string().optional(),
    x: coordSchema.optional(),
    y: coordSchema.optional(),
    width: sizeSchema.optional(),
    height: sizeSchema.optional(),
    zIndex: z.number().int().min(1).max(10_000).optional(),
    hlMode: hlModeSchema.optional(),
    minimized: z.boolean().optional(),
    wordWrap: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const importPaneItemSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  zIndex: z.number().int().optional(),
  hlMode: hlModeSchema.optional(),
  highlightOn: z.boolean().optional(),
  minimized: z.boolean().optional(),
  wordWrap: z.boolean().optional()
});

export const importPanesSchema = z.object({
  panes: z.array(importPaneItemSchema).max(500)
});
