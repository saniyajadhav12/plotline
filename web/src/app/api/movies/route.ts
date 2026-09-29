import { NextRequest, NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.toString();

  try {
    const data = await backendFetch(`/movies${query ? `?${query}` : ""}`);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Failed to fetch movies" }, { status: 500 });
  }
}
