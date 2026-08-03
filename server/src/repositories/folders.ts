import type { BlogFolder } from "@blogus/shared";
import { and, asc, eq } from "drizzle-orm";
import { folders } from "../db/schema.js";
import type { PostsDatabase } from "./posts.js";

export interface FolderRepository {
  listFolders(userId: string): Promise<BlogFolder[]>;
  createFolder(userId: string, name: string): Promise<BlogFolder>;
  renameFolder(id: string, userId: string, name: string): Promise<BlogFolder | null>;
  deleteFolder(id: string, userId: string): Promise<boolean>;
}

type FolderRow = typeof folders.$inferSelect;

function toBlogFolder(row: FolderRow): BlogFolder {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class DrizzleFolderRepository implements FolderRepository {
  constructor(private readonly db: PostsDatabase) {}

  async listFolders(userId: string) {
    const rows = await this.db
      .select()
      .from(folders)
      .where(eq(folders.userId, userId))
      .orderBy(asc(folders.name));
    return rows.map(toBlogFolder);
  }

  async createFolder(userId: string, name: string) {
    const [row] = await this.db.insert(folders).values({ userId, name }).returning();
    return toBlogFolder(row);
  }

  async renameFolder(id: string, userId: string, name: string) {
    const [row] = await this.db
      .update(folders)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.userId, userId)))
      .returning();
    return row ? toBlogFolder(row) : null;
  }

  async deleteFolder(id: string, userId: string) {
    const deleted = await this.db
      .delete(folders)
      .where(and(eq(folders.id, id), eq(folders.userId, userId)))
      .returning({ id: folders.id });
    return deleted.length > 0;
  }
}
