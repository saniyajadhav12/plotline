import { NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/session";

export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const data = await backendFetch("/users/me/ratings", { token });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Failed to fetch ratings" }, { status: 500 });
  }
}
