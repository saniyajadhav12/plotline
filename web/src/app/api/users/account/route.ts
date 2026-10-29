import { NextRequest, NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";
import { clearToken, getToken } from "@/lib/session";

/** Deletes the signed-in user's account (password required), then ends the session. */
export async function DELETE(request: NextRequest) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    await backendFetch("/users/me", { method: "DELETE", body, token });
    await clearToken();
    return NextResponse.json({ message: "Account deleted" });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Failed to delete account" }, { status: 500 });
  }
}
