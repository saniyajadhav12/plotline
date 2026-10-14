import { NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";
import { clearToken, getToken, getTokenExpiry, isTokenExpired } from "@/lib/session";

/**
 * Returns the current user, or a 401 whose `reason` tells the client which case
 * it is, so it can respond correctly:
 *   - "no_session":      never logged in (or signed out) -> plain /login
 *   - "session_expired": had a session that ran out      -> /login?session_expired=1
 * In the expired case the stale cookie is deleted here (route handlers may write
 * cookies; Server Components can't).
 */
export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated", reason: "no_session" }, { status: 401 });
  }

  if (isTokenExpired(token)) {
    await clearToken();
    return NextResponse.json({ detail: "Session expired", reason: "session_expired" }, { status: 401 });
  }

  try {
    const user = await backendFetch<Record<string, unknown>>("/auth/me", { token });
    // session_expires_at (epoch ms) lets the client redirect automatically the
    // moment the session ends. The cookie is httpOnly, so it can't read it itself.
    return NextResponse.json({ ...user, session_expires_at: getTokenExpiry(token) });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // The backend rejected a token that looked valid locally (e.g. signed with
      // an old secret). Treat it the same as an expired session.
      await clearToken();
      return NextResponse.json({ detail: "Session expired", reason: "session_expired" }, { status: 401 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Failed to fetch user" }, { status: 500 });
  }
}
