import { readConfig, writeConfig } from "./config.js";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired. Please log in again.");
    this.name = "SessionExpiredError";
  }
}

const AUTH_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh"];

async function tryRefreshToken(config: { apiBaseUrl: string; refreshToken?: string }) {
  if (!config.refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.refreshToken}`
      }
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as { accessToken: string; refreshToken: string };
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = await readConfig();
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (!isFormData && !headers.has("content-type") && init?.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (config.token) {
    headers.set("authorization", `Bearer ${config.token}`);
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers,
    ...init
  });

  if (response.status === 401 && !AUTH_PATHS.some((p) => path.endsWith(p))) {
    const refreshed = await tryRefreshToken(config);
    if (refreshed) {
      await writeConfig({ ...config, token: refreshed.accessToken, refreshToken: refreshed.refreshToken });
      headers.set("authorization", `Bearer ${refreshed.accessToken}`);
      const retryResponse = await fetch(`${config.apiBaseUrl}${path}`, {
        headers,
        ...init
      });
      if (!retryResponse.ok) {
        const body = await retryResponse.text();
        let message = body;
        try {
          const parsed = JSON.parse(body) as { error?: { message?: string } };
          message = parsed.error?.message ?? body;
        } catch {
          message = body;
        }
        throw new Error(`Request failed: ${retryResponse.status} ${message}`);
      }
      return retryResponse.json() as Promise<T>;
    }
    throw new SessionExpiredError();
  }

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
