import { NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/session";

export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await backendFetch("/auth/me", { token });
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Failed to fetch user" }, { status: 500 });
  }
}
