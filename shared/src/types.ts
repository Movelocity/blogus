export type PostStatus = "draft" | "published" | "archived";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface CreatePostInput {
  title: string;
  content?: string;
  status?: PostStatus;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  excerpt?: string;
  status?: PostStatus;
}

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
}
