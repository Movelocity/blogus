import type {
  ApiErrorResponse,
  BlogFolder,
  BlogPost,
  CreatePostInput,
  CurrentUser,
  PostVisibility,
  UpdatePostInput
} from "@blogus/shared";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const r = await fetchApi("/auth/refresh", { method: "POST" });
      return r.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function isAuthEntryPath(path: string): boolean {
  return path === "/auth/login" || path === "/auth/register" || path === "/auth/refresh" || path === "/auth/status";
}

function emitSessionExpired() {
  window.dispatchEvent(new CustomEvent("blogus:session-expired"));
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchApi(path, init);

  if (response.status === 401 && !isAuthEntryPath(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryResponse = await fetchApi(path, init);
      return parseResponse<T>(retryResponse);
    }
    emitSessionExpired();
    throw new SessionExpiredError();
  }

  return parseResponse<T>(response);
}

function fetchApi(path: string, init?: RequestInit) {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = isFormData
    ? init?.headers
    : init?.body !== undefined && init?.body !== null
      ? {
          "content-type": "application/json",
          ...init?.headers
        }
      : init?.headers;

  return fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers
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

export function listPosts(options: { visibility?: PostVisibility } = {}) {
  const params = new URLSearchParams();
  if (options.visibility) {
    params.set("visibility", options.visibility);
  }

  return request<{ posts: BlogPost[] }>(`/posts${params.size ? `?${params.toString()}` : ""}`);
}

export function getPostBySlug(slug: string, options: { visibility?: PostVisibility } = {}) {
  const params = new URLSearchParams();
  if (options.visibility) {
    params.set("visibility", options.visibility);
  }

  return request<{ post: BlogPost }>(`/posts/${encodeURIComponent(slug)}${params.size ? `?${params.toString()}` : ""}`);
}

export interface CalendarPostSummary {
  id: string;
  title: string;
  slug: string;
  publishedAt: string;
}

export function getCalendarPosts(year: number, month: number) {
  return request<{ index: Record<string, CalendarPostSummary[]> }>(
    `/posts/calendar?year=${year}&month=${month}`
  );
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

export function listFolders() {
  return request<{ folders: BlogFolder[] }>("/folders");
}

export function createFolder(name: string) {
  return request<{ folder: BlogFolder }>("/folders", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export function renameFolder(id: string, name: string) {
  return request<{ folder: BlogFolder }>(`/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name })
  });
}

export function deleteFolder(id: string) {
  return request<{ ok: true }>(`/folders/${id}`, {
    method: "DELETE"
  });
}

export async function uploadFile(file: File) {
  const buildBody = () => {
    const body = new FormData();
    body.append("file", file);
    return body;
  };
  const response = await fetchApi("/upload", {
    method: "POST",
    body: buildBody(),
    headers: {}
  });

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryResponse = await fetchApi("/upload", {
        method: "POST",
        body: buildBody(),
        headers: {}
      });
      return parseResponse<{ file: { bucket: string; key: string; url: string } }>(retryResponse);
    }
    emitSessionExpired();
    throw new SessionExpiredError();
  }

  return parseResponse<{ file: { bucket: string; key: string; url: string } }>(response);
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

export function getSystemStatus() {
  return fetchApi("/auth/status").then((r) => r.json() as Promise<{ initialized: boolean }>);
}

export function register(input: { email: string; password: string; name?: string }) {
  return request<{ user: CurrentUser; accessToken: string; refreshToken: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
