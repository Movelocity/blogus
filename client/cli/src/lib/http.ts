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
    throw new Error(`Request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}
