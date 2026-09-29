import { NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";

export async function GET() {
  try {
    const genres = await backendFetch<string[]>("/movies/genres");
    return NextResponse.json(genres);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Failed to fetch genres" }, { status: 500 });
  }
}
