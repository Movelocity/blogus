import type {
  ApiErrorResponse,
  BlogPost,
  CreatePostInput,
  CurrentUser,
  UpdatePostInput
} from "@blogus/shared";

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
    const message = await response
      .json()
      .then((body: ApiErrorResponse) => body.error.message)
      .catch(() => `Request failed: ${response.status}`);
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function listPosts(options: { visibility?: "published" | "all" } = {}) {
  const params = new URLSearchParams();
  if (options.visibility) {
    params.set("visibility", options.visibility);
  }

  return request<{ posts: BlogPost[] }>(`/posts${params.size ? `?${params.toString()}` : ""}`);
}

export function createPost(input: CreatePostInput) {
  return request<{ post: BlogPost }>("/posts", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updatePost(id: string, input: UpdatePostInput) {
  return request<{ post: BlogPost }>(`/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deletePost(id: string) {
  return request<{ ok: true }>(`/posts/${id}`, {
    method: "DELETE"
  });
}

export function login(input: { email: string; password: string }) {
  return request<{ user: CurrentUser; accessToken: string; refreshToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function logout() {
  return request<{ ok: true }>("/auth/logout", {
    method: "POST"
  });
}

export function whoami() {
  return request<{ user: CurrentUser }>("/auth/whoami");
}
