const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Server-side fetch helper for calling the FastAPI backend.
 * Use this from Next.js API routes (route handlers) and Server Components.
 * Pass the JWT explicitly since this runs server-side and has no browser cookie jar.
 */
export async function backendFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
  } = {}
): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "Something went wrong";
    try {
      const errorData = await response.json();
      detail = errorData.detail || detail;
    } catch {
      // response body wasn't JSON; keep default detail
    }
    throw new ApiError(response.status, detail);
  }

  // Some endpoints (like DELETE) may return no content
  const text = await response.text();
  return text ? JSON.parse(text) : (undefined as T);
}
