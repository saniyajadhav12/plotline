import { NextRequest, NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const limit = searchParams.get("limit") || "12";

  try {
    const results = await backendFetch(
      `/movies/semantic-search?q=${encodeURIComponent(q)}&limit=${limit}`
    );
    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Search failed" }, { status: 500 });
  }
}
