/** Error thrown for non-2xx responses and network failures (status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** True when retrying the same request later may succeed. */
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** User-facing text for a failed request; non-API errors get the fallback. */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  return error instanceof ApiError ? error.message : fallback;
}

function messageFrom(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === "string") return error;
  }
  return fallback;
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-serialisable body. */
  body?: unknown;
  signal?: AbortSignal;
}

/** Typed JSON fetch. Resolves with the parsed body (undefined for 204). */
export async function api<T = unknown>(
  url: string,
  { method = "GET", body, signal }: ApiOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      credentials: "same-origin",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(0, "Network error. Check your connection.");
  }
  const parsed: unknown = await response.json().catch(() => undefined);
  if (!response.ok)
    throw new ApiError(
      response.status,
      messageFrom(parsed, response.statusText || "Request failed."),
      parsed,
    );
  return parsed as T;
}

export const apiGet = <T>(url: string, signal?: AbortSignal) =>
  api<T>(url, { signal });
export const apiPost = <T>(url: string, body?: unknown) =>
  api<T>(url, { method: "POST", body: body ?? {} });
export const apiPut = <T>(url: string, body: unknown) =>
  api<T>(url, { method: "PUT", body });
export const apiPatch = <T>(url: string, body: unknown) =>
  api<T>(url, { method: "PATCH", body });
export const apiDelete = <T = unknown>(url: string) =>
  api<T>(url, { method: "DELETE" });
