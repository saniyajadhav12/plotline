import { NextRequest, NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const user = await backendFetch("/auth/signup", { method: "POST", body });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Signup failed" }, { status: 500 });
  }
}
