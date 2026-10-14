import { cookies } from "next/headers";

const TOKEN_COOKIE_NAME = "plotline_token";
const FALLBACK_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, only if the token has no readable expiry
// The cookie outlives the token by this much, so that after expiry the app can still
// see the old token, recognise the session as EXPIRED (not "never logged in"), show
// "Your session expired", and clear it. Without it, the browser would silently delete
// the cookie at the same moment and the user would never be told why.
const EXPIRED_COOKIE_GRACE_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Reads the `exp` claim from a JWT and returns it as epoch milliseconds, or null.
 * This does NOT verify the token (the backend verifies it on every request); it
 * only reads the expiry so the frontend can tell when a session has run out.
 */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True if the token's expiry time has passed. Tokens without a readable expiry are left to the backend. */
export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token);
  return expiry !== null && expiry <= Date.now();
}

export async function getToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE_NAME)?.value;
}

export async function setToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  const expiry = getTokenExpiry(token);
  cookieStore.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Expires a grace period after the token. Expired tokens are detected by
    // requireToken and /api/auth/me, which redirect with a "session expired" message.
    ...(expiry
      ? { expires: new Date(expiry + EXPIRED_COOKIE_GRACE_MS) }
      : { maxAge: FALLBACK_MAX_AGE_SECONDS }),
  });
}

export async function clearToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
}
