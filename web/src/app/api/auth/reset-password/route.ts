import { NextRequest, NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const result = await backendFetch("/auth/reset-password", { method: "POST", body });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Request failed" }, { status: 500 });
  }
}
