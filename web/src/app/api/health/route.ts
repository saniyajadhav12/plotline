import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/api";

// Never cache: the point is to reach the backend (and wake it if it's asleep).
export const dynamic = "force-dynamic";

/**
 * Pings the backend's /health endpoint, which doesn't touch the database.
 * Called by useWarmUpBackend on the login/signup pages so a sleeping free-tier
 * backend starts waking up while the visitor is still typing.
 */
export async function GET() {
  try {
    await backendFetch("/health");
    return NextResponse.json({ backend: "up" });
  } catch {
    return NextResponse.json({ backend: "unreachable" }, { status: 502 });
  }
}
