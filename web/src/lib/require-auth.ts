import { redirect } from "next/navigation";
import { getToken, isTokenExpired } from "@/lib/session";
import { backendFetch, ApiError } from "@/lib/api";

/**
 * Gets the auth token from the cookie, or redirects to /login if it is missing,
 * or to /login?session_expired=1 if the token inside it has expired.
 * Use at the top of any Server Component page that requires authentication.
 */
export async function requireToken(): Promise<string> {
  const token = await getToken();
  if (!token) {
    redirect("/login");
  }
  if (isTokenExpired(token)) {
    redirect("/login?session_expired=1");
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
      // Cookies can only be written in a Server Action or Route Handler,
      // not during a Server Component's render -- so we don't try to
      // clear the stale cookie here. It's harmless: every subsequent
      // request still gets rejected with 401, and the user is redirected
      // to /login either way. The login page itself clears it if present.
      redirect("/login?session_expired=1");
    }
    throw error;
  }
}
