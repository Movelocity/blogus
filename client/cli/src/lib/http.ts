import { readConfig } from "./config.js";

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = await readConfig();
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (!isFormData && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (config.token) {
    headers.set("authorization", `Bearer ${config.token}`);
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers,
    ...init
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body;

    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      message = parsed.error?.message ?? body;
    } catch {
      message = body;
    }

    throw new Error(`Request failed: ${response.status} ${message}`);
  }

  return response.json() as Promise<T>;
}
