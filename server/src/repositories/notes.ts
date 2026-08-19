import { randomUUID } from "node:crypto";
import type {
  BlogNote,
  CreateNoteInput,
  NoteListResult,
  NoteVisibility,
  UpdateNoteInput
} from "@blogus/shared";
import { and, arrayContains, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.js";
import { notes } from "../db/schema.js";

export type NotesDatabase = PostgresJsDatabase<typeof schema>;

export interface NoteListOptions {
  visibility?: NoteVisibility;
  date?: string;
  tag?: string;
  isPublic?: boolean;
  page: number;
  pageSize: number;
  /** 当前登录用户 id；null 表示匿名，只能看公开笔记 */
  userId: string | null;
}

export interface NoteSearchOptions {
  keyword: string;
  page: number;
  pageSize: number;
  userId: string | null;
}

export interface NoteRepository {
  listNotes(options: NoteListOptions): Promise<NoteListResult>;
  getNoteById(id: string, userId: string | null): Promise<BlogNote | null>;
  createNote(userId: string, input: CreateNoteInput): Promise<BlogNote>;
  updateNote(id: string, userId: string, input: UpdateNoteInput): Promise<BlogNote | null>;
  deleteNote(id: string, userId: string): Promise<boolean>;
  setArchived(id: string, userId: string, isArchived: boolean): Promise<BlogNote | null>;
  listCalendarStats(userId: string | null, year: number, month: number): Promise<Record<string, number>>;
  searchNotes(options: NoteSearchOptions): Promise<NoteListResult>;
}

type NoteRow = typeof notes.$inferSelect;

function toBlogNote(row: NoteRow): BlogNote {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    content: row.content,
    isPublic: row.isPublic,
    isArchived: row.isArchived,
    tags: row.tags ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

/** 可见性条件：published=公开且未归档；all/archived=本人（需登录） */
function visibilityConditions(userId: string | null, visibility: NoteVisibility) {
  if (visibility === "archived") {
    return and(eq(notes.userId, userId!), eq(notes.isArchived, true));
  }
  if (visibility === "all") {
    return eq(notes.userId, userId!);
  }
  return and(eq(notes.isPublic, true), eq(notes.isArchived, false));
}

export class DrizzleNoteRepository implements NoteRepository {
  constructor(private readonly db: NotesDatabase) {}

  async listNotes(options: NoteListOptions) {
    const { date, tag, isPublic, page, pageSize } = options;
    const visibility = options.visibility ?? "published";
    const conditions: ReturnType<typeof and>[] = [visibilityConditions(options.userId, visibility)];

    if (date) {
      conditions.push(eq(notes.date, date));
    }
    if (tag) {
      conditions.push(arrayContains(notes.tags, [tag]));
    }
    if (isPublic !== undefined && options.userId !== null) {
      conditions.push(eq(notes.isPublic, isPublic));
    }

    const where = and(...conditions);
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
      .where(where);

    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select()
      .from(notes)
      .where(where)
      .orderBy(desc(notes.date), desc(notes.createdAt))
      .limit(pageSize)
      .offset(offset);

    return { notes: rows.map(toBlogNote), total: count };
  }

  async getNoteById(id: string, userId: string | null) {
    const [row] = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);
    if (!row) {
      return null;
    }

    const visible = row.isPublic || (userId !== null && row.userId === userId);
    return visible ? toBlogNote(row) : null;
  }

  async createNote(userId: string, input: CreateNoteInput) {
    const now = new Date();
    const [row] = await this.db
      .insert(notes)
      .values({
        id: randomUUID(),
        userId,
        date: input.date ?? toDateKey(now),
        content: input.content,
        isPublic: input.isPublic ?? false,
        isArchived: false,
        tags: input.tags ?? [],
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return toBlogNote(row);
  }

  async updateNote(id: string, userId: string, input: UpdateNoteInput) {
    const existing = await this.findOwned(id, userId);
    if (!existing) {
      return null;
    }

    const [row] = await this.db
      .update(notes)
      .set({
        ...(input.date === undefined ? {} : { date: input.date }),
        ...(input.content === undefined ? {} : { content: input.content }),
        ...(input.isPublic === undefined ? {} : { isPublic: input.isPublic }),
        ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
        ...(input.tags === undefined ? {} : { tags: input.tags }),
        updatedAt: new Date()
      })
      .where(eq(notes.id, id))
      .returning();

    return row ? toBlogNote(row) : null;
  }

  async deleteNote(id: string, userId: string) {
    const existing = await this.findOwned(id, userId);
    if (!existing) {
      return false;
    }

    const deleted = await this.db.delete(notes).where(eq(notes.id, id)).returning({ id: notes.id });
    return deleted.length > 0;
  }

  async setArchived(id: string, userId: string, isArchived: boolean) {
    const existing = await this.findOwned(id, userId);
    if (!existing) {
      return null;
    }

    const [row] = await this.db
      .update(notes)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();

    return row ? toBlogNote(row) : null;
  }

  async listCalendarStats(userId: string | null, year: number, month: number) {
    const start = toDateKey(new Date(year, month - 1, 1));
    const end = month === 12 ? `${year + 1}-01-01` : toDateKey(new Date(year, month, 1));

    const conditions = [
      sql`${notes.date} >= ${start} AND ${notes.date} < ${end}`,
      eq(notes.isArchived, false)
    ];
    if (userId !== null) {
      conditions.push(or(eq(notes.isPublic, true), eq(notes.userId, userId))!);
    } else {
      conditions.push(eq(notes.isPublic, true));
    }

    const rows = await this.db
      .select({ date: notes.date, count: sql<number>`count(*)::int` })
      .from(notes)
      .where(and(...conditions))
      .groupBy(notes.date);

    const index: Record<string, number> = {};
    for (const row of rows) {
      index[row.date] = row.count;
    }
    return index;
  }

  async searchNotes(options: NoteSearchOptions) {
    const { keyword, page, pageSize, userId } = options;
    const pattern = `%${keyword}%`;
    const textMatch = or(ilike(notes.content, pattern), sql`${notes.tags}::text ILIKE ${pattern}`);

    const conditions: ReturnType<typeof and>[] = [];
    if (userId !== null) {
      // 已登录：本人全部（含私有/归档）+ 他人公开未归档
      conditions.push(or(eq(notes.isPublic, true), eq(notes.userId, userId))!);
    } else {
      // 匿名：仅公开未归档
      conditions.push(eq(notes.isPublic, true), eq(notes.isArchived, false));
    }
    conditions.push(textMatch!);

    const where = and(...conditions);
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
      .where(where);

    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select()
      .from(notes)
      .where(where)
      .orderBy(desc(notes.date), desc(notes.createdAt))
      .limit(pageSize)
      .offset(offset);

    return { notes: rows.map(toBlogNote), total: count };
  }

  private async findOwned(id: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);
    return row ?? null;
  }
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
