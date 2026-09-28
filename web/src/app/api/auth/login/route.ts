import { NextRequest, NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";
import { setToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const data = await backendFetch<{ access_token: string }>("/auth/login", {
      method: "POST",
      body,
    });
    await setToken(data.access_token);
    return NextResponse.json({ message: "Logged in" });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Login failed" }, { status: 500 });
  }
}
