import { redirect } from "next/navigation";
import { getToken, clearToken } from "@/lib/session";
import { backendFetch, ApiError } from "@/lib/api";

/**
 * Gets the auth token from the cookie, or redirects to /login if missing.
 * Use at the top of any Server Component page that requires authentication.
 */
export async function requireToken(): Promise<string> {
  const token = await getToken();
  if (!token) {
    redirect("/login");
  }
  return token;
}

/**
 * Wraps backendFetch for a REQUIRED call (one the page can't render without).
 * If the token is invalid or expired (401), clears the stale cookie and
 * redirects to /login instead of letting the error crash the page.
 * For OPTIONAL calls, keep using backendFetch(...).catch(() => fallback) directly.
 */
export async function backendFetchOrRedirect<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  try {
    return await backendFetch<T>(path, { ...options, token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearToken();
      redirect("/login");
    }
    throw error;
  }
}
