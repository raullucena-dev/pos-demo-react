import type { z } from "zod";

import { ApiError, type FieldIssue } from "./errors";

/** Same-origin prefix: proxied to the API by Vite in dev and by nginx in production. */
export const API_BASE = "/api";

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Subscribes to 401 responses from authenticated requests (session expired or revoked). */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal | undefined;
  /** Login and the initial session probe handle 401 themselves. */
  skipUnauthorizedEvent?: boolean;
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown };
  detail?: unknown;
}

function toApiError(status: number, body: unknown, headers: Headers): ApiError {
  const retryAfter = Number(headers.get("Retry-After"));
  const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
  const parsed = (typeof body === "object" && body !== null ? body : {}) as ErrorBody;
  if (status === 422 && Array.isArray(parsed.detail)) {
    // FastAPI request validation: [{ loc: ["body", "price"], msg: "..." }, ...]
    const issues: FieldIssue[] = parsed.detail.map((item: unknown) => {
      const entry = item as { loc?: unknown[]; msg?: unknown };
      const loc = Array.isArray(entry.loc) ? entry.loc.filter((p) => p !== "body") : [];
      return {
        field: loc.join("."),
        message: typeof entry.msg === "string" ? entry.msg : "inválido",
      };
    });
    return new ApiError(422, "validation_error", "request validation failed", { issues });
  }
  const code = typeof parsed.error?.code === "string" ? parsed.error.code : `http_${status}`;
  const message =
    typeof parsed.error?.message === "string" ? parsed.error.message : `HTTP ${status}`;
  return new ApiError(status, code, message, { retryAfterSeconds });
}

/** Fetches JSON from the API and validates it with `schema`. Cookies are always sent. */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = {
    method: options.method ?? "GET",
    credentials: "include",
    headers,
    signal: options.signal ?? null,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_error", "network request failed");
  }

  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = undefined;
    }
  }

  if (!response.ok) {
    const error = toApiError(response.status, body, response.headers);
    if (response.status === 401 && !options.skipUnauthorizedEvent) {
      for (const listener of unauthorizedListeners) listener();
    }
    throw error;
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(response.status, "invalid_response", result.error.message);
  }
  return result.data;
}
