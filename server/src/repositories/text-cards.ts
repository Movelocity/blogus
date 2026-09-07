import type {
  CreateTextCardPaneInput,
  ImportTextCardPaneInput,
  TextCardPane,
  TextCardWorkspace,
  TextCardWorkspaceWithCount,
  UpdateTextCardPaneInput
} from "@blogus/shared";
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.js";
import { textCardPanes, textCardWorkspaces } from "../db/schema.js";

export type TextCardsDatabase = PostgresJsDatabase<typeof schema>;

const DEFAULT_PANE_WIDTH = 560;
const DEFAULT_PANE_HEIGHT = 280;

export interface TextCardRepository {
  listWorkspaces(userId: string): Promise<TextCardWorkspaceWithCount[]>;
  findOwnedWorkspace(id: string, userId: string): Promise<TextCardWorkspace | null>;
  createWorkspace(userId: string): Promise<TextCardWorkspace>;
  updateWorkspace(id: string, userId: string, name: string): Promise<TextCardWorkspace | null>;
  deleteWorkspace(id: string, userId: string): Promise<"deleted" | "not_found" | "last_workspace">;
  listPanes(workspaceId: string, userId: string): Promise<TextCardPane[] | null>;
  createPane(workspaceId: string, userId: string, input?: CreateTextCardPaneInput): Promise<TextCardPane | null>;
  updatePane(id: string, userId: string, input: UpdateTextCardPaneInput): Promise<TextCardPane | null>;
  deletePane(id: string, userId: string): Promise<boolean>;
  importPanes(
    workspaceId: string,
    userId: string,
    panes: ImportTextCardPaneInput[]
  ): Promise<TextCardPane[] | null>;
}

type WorkspaceRow = typeof textCardWorkspaces.$inferSelect;
type PaneRow = typeof textCardPanes.$inferSelect;

function toTextCardWorkspace(row: WorkspaceRow): TextCardWorkspace {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toTextCardPane(row: PaneRow): TextCardPane {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    content: row.content,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zIndex: row.zIndex,
    hlMode: row.hlMode as TextCardPane["hlMode"],
    minimized: row.minimized,
    wordWrap: row.wordWrap,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function isFiniteInt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

/** 兼容 v1 import 缺省字段、highlightOn 与非法坐标 */
export function normalizePane(input: ImportTextCardPaneInput) {
  let hlMode = input.hlMode ?? "";
  if (input.highlightOn && !input.hlMode) {
    hlMode = "json";
  }

  const x = isFiniteInt(input.x) ? input.x : 0;
  const y = isFiniteInt(input.y) ? input.y : 0;
  const width = isFiniteInt(input.width) && input.width >= 80 && input.width <= 10_000 ? input.width : DEFAULT_PANE_WIDTH;
  const height =
    isFiniteInt(input.height) && input.height >= 80 && input.height <= 10_000 ? input.height : DEFAULT_PANE_HEIGHT;
  const zIndex = isFiniteInt(input.zIndex) && input.zIndex >= 1 ? input.zIndex : 1;

  return {
    title: input.title ?? "",
    content: input.content ?? "",
    x,
    y,
    width,
    height,
    zIndex,
    hlMode: String(hlMode).slice(0, 32),
    minimized: input.minimized ?? false,
    wordWrap: input.wordWrap ?? true
  };
}

export class DrizzleTextCardRepository implements TextCardRepository {
  constructor(private readonly db: TextCardsDatabase) {}

  async listWorkspaces(userId: string) {
    const rows = await this.db
      .select({
        id: textCardWorkspaces.id,
        name: textCardWorkspaces.name,
        createdAt: textCardWorkspaces.createdAt,
        updatedAt: textCardWorkspaces.updatedAt,
        paneCount: count(textCardPanes.id)
      })
      .from(textCardWorkspaces)
      .leftJoin(textCardPanes, eq(textCardPanes.workspaceId, textCardWorkspaces.id))
      .where(eq(textCardWorkspaces.userId, userId))
      .groupBy(textCardWorkspaces.id)
      .orderBy(asc(textCardWorkspaces.createdAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      paneCount: Number(row.paneCount)
    }));
  }

  async findOwnedWorkspace(id: string, userId: string) {
    const row = await this.findOwnedWorkspaceRow(id, userId);
    return row ? toTextCardWorkspace(row) : null;
  }

  async createWorkspace(userId: string) {
    const existing = await this.db
      .select({ name: textCardWorkspaces.name })
      .from(textCardWorkspaces)
      .where(eq(textCardWorkspaces.userId, userId));

    const usedNumbers = existing
      .map((row) => {
        const match = row.name.match(/^工作区 (\d+)$/);
        return match ? Number.parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const next = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;

    const [row] = await this.db
      .insert(textCardWorkspaces)
      .values({ userId, name: `工作区 ${next}` })
      .returning();
    return toTextCardWorkspace(row);
  }

  async updateWorkspace(id: string, userId: string, name: string) {
    const [row] = await this.db
      .update(textCardWorkspaces)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(textCardWorkspaces.id, id), eq(textCardWorkspaces.userId, userId)))
      .returning();
    return row ? toTextCardWorkspace(row) : null;
  }

  async deleteWorkspace(id: string, userId: string) {
    const owned = await this.findOwnedWorkspaceRow(id, userId);
    if (!owned) {
      return "not_found";
    }

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(textCardWorkspaces)
      .where(eq(textCardWorkspaces.userId, userId));

    if (Number(total) <= 1) {
      return "last_workspace";
    }

    await this.db.delete(textCardWorkspaces).where(eq(textCardWorkspaces.id, id));
    return "deleted";
  }

  async listPanes(workspaceId: string, userId: string) {
    const workspace = await this.findOwnedWorkspaceRow(workspaceId, userId);
    if (!workspace) {
      return null;
    }

    const rows = await this.db
      .select()
      .from(textCardPanes)
      .where(eq(textCardPanes.workspaceId, workspaceId))
      .orderBy(asc(textCardPanes.zIndex), asc(textCardPanes.createdAt));

    return rows.map(toTextCardPane);
  }

  async createPane(workspaceId: string, userId: string, input?: CreateTextCardPaneInput) {
    const workspace = await this.findOwnedWorkspaceRow(workspaceId, userId);
    if (!workspace) {
      return null;
    }

    const [{ maxZ }] = await this.db
      .select({ maxZ: sql<number>`coalesce(max(${textCardPanes.zIndex}), 0)` })
      .from(textCardPanes)
      .where(eq(textCardPanes.workspaceId, workspaceId));

    const [row] = await this.db
      .insert(textCardPanes)
      .values({
        workspaceId,
        zIndex: Number(maxZ) + 1,
        ...(input?.x !== undefined ? { x: input.x } : {}),
        ...(input?.y !== undefined ? { y: input.y } : {})
      })
      .returning();

    await this.db
      .update(textCardWorkspaces)
      .set({ updatedAt: new Date() })
      .where(eq(textCardWorkspaces.id, workspaceId));

    return toTextCardPane(row);
  }

  async updatePane(id: string, userId: string, input: UpdateTextCardPaneInput) {
    const owned = await this.findOwnedPaneRow(id, userId);
    if (!owned) {
      return null;
    }

    const patch: Partial<typeof textCardPanes.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.content !== undefined) patch.content = input.content;
    if (input.x !== undefined) patch.x = input.x;
    if (input.y !== undefined) patch.y = input.y;
    if (input.width !== undefined) patch.width = input.width;
    if (input.height !== undefined) patch.height = input.height;
    if (input.zIndex !== undefined) patch.zIndex = input.zIndex;
    if (input.hlMode !== undefined) patch.hlMode = input.hlMode;
    if (input.minimized !== undefined) patch.minimized = input.minimized;
    if (input.wordWrap !== undefined) patch.wordWrap = input.wordWrap;

    const [row] = await this.db.update(textCardPanes).set(patch).where(eq(textCardPanes.id, id)).returning();

    await this.db
      .update(textCardWorkspaces)
      .set({ updatedAt: new Date() })
      .where(eq(textCardWorkspaces.id, owned.pane.workspaceId));

    return row ? toTextCardPane(row) : null;
  }

  async deletePane(id: string, userId: string) {
    const owned = await this.findOwnedPaneRow(id, userId);
    if (!owned) {
      return false;
    }

    const deleted = await this.db.delete(textCardPanes).where(eq(textCardPanes.id, id)).returning({ id: textCardPanes.id });

    if (deleted.length > 0) {
      await this.db
        .update(textCardWorkspaces)
        .set({ updatedAt: new Date() })
        .where(eq(textCardWorkspaces.id, owned.pane.workspaceId));
    }

    return deleted.length > 0;
  }

  async importPanes(workspaceId: string, userId: string, panes: ImportTextCardPaneInput[]) {
    const workspace = await this.findOwnedWorkspaceRow(workspaceId, userId);
    if (!workspace) {
      return null;
    }

    const normalized = panes.map(normalizePane);

    return this.db.transaction(async (tx) => {
      await tx.delete(textCardPanes).where(eq(textCardPanes.workspaceId, workspaceId));

      if (normalized.length === 0) {
        await tx
          .update(textCardWorkspaces)
          .set({ updatedAt: new Date() })
          .where(eq(textCardWorkspaces.id, workspaceId));
        return [];
      }

      const rows = await tx
        .insert(textCardPanes)
        .values(normalized.map((pane) => ({ workspaceId, ...pane })))
        .returning();

      await tx
        .update(textCardWorkspaces)
        .set({ updatedAt: new Date() })
        .where(eq(textCardWorkspaces.id, workspaceId));

      return rows.map(toTextCardPane);
    });
  }

  private async findOwnedWorkspaceRow(id: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(textCardWorkspaces)
      .where(and(eq(textCardWorkspaces.id, id), eq(textCardWorkspaces.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  private async findOwnedPaneRow(id: string, userId: string) {
    const [row] = await this.db
      .select({ pane: textCardPanes })
      .from(textCardPanes)
      .innerJoin(textCardWorkspaces, eq(textCardPanes.workspaceId, textCardWorkspaces.id))
      .where(and(eq(textCardPanes.id, id), eq(textCardWorkspaces.userId, userId)))
      .limit(1);
    return row ?? null;
  }
}
