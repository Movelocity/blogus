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
