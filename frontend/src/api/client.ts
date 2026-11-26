import { mockResponse } from "./mock";

export const mockMode = import.meta.env.VITE_USE_MOCK === "true";

/** Absolute URL of an API path, respecting the app base path (e.g. "/rr/"). */
export function apiUrl(path: string): string {
  return `${import.meta.env.BASE_URL}api${path}`;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (mockMode) return Promise.resolve(mockResponse<T>(path, init));

  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), { ...init, headers });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail || detail;
    } catch {
      // Gateway errors may not contain a JSON body.
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}
