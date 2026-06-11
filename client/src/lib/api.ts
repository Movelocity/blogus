import type { BlogPost, CreatePostInput } from "@blogus/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function listPosts() {
  return request<{ posts: BlogPost[] }>("/posts");
}

export function createPost(input: CreatePostInput) {
  return request<{ post: BlogPost }>("/posts", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
