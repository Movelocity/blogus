export type PostStatus = "draft" | "published" | "archived";
export type PostVisibility = "published" | "archived" | "draft" | "all";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  coverImageUrl?: string;
  tags: string[];
  folderId?: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface BlogFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type NoteVisibility = "published" | "archived" | "all";

export interface BlogNote {
  id: string;
  userId: string;
  /** 笔记日期，YYYY-MM-DD */
  date: string;
  content: string;
  isPublic: boolean;
  isArchived: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  /** 可选，缺省用当天日期 */
  date?: string;
  content: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface UpdateNoteInput {
  date?: string;
  content?: string;
  isPublic?: boolean;
  isArchived?: boolean;
  tags?: string[];
}

export interface NoteListResult {
  notes: BlogNote[];
  total: number;
}

export interface NoteCalendarIndex {
  /** date (YYYY-MM-DD) -> 当天可见笔记数 */
  index: Record<string, number>;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface CreatePostInput {
  title: string;
  content?: string;
  excerpt?: string;
  coverImageUrl?: string;
  tags?: string[];
  folderId?: string | null;
  status?: PostStatus;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  excerpt?: string;
  coverImageUrl?: string;
  tags?: string[];
  folderId?: string | null;
  status?: PostStatus;
}

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  role: "admin" | "user";
}

export interface InviteCode {
  id: string;
  code: string;
  createdBy?: string;
  usedCount: number;
  maxUses?: number;
  expiresAt?: string;
  disabledAt?: string;
  createdAt: string;
}
