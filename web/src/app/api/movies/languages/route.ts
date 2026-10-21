import { NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";

type LanguageCount = { code: string; count: number };

export async function GET() {
  try {
    const languages = await backendFetch<LanguageCount[]>("/movies/languages");
    return NextResponse.json(languages);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Failed to fetch languages" }, { status: 500 });
  }
}
