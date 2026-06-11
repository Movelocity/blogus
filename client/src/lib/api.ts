import type { BlogPost, CreatePostInput } from "@blogus/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchApi(path, init);

  if (response.status === 401 && path !== "/auth/refresh") {
    const refreshed = await fetchApi("/auth/refresh", { method: "POST" });
    if (refreshed.ok) {
      const retryResponse = await fetchApi(path, init);
      return parseResponse<T>(retryResponse);
    }
  }

  return parseResponse<T>(response);
}

function fetchApi(path: string, init?: RequestInit) {
  return fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init?.headers
    },
    ...init
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
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
