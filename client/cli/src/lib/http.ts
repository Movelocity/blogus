import { readConfig } from "./config.js";

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = await readConfig();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}
