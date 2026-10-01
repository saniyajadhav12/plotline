import { NextRequest, NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/session";

export async function PUT(request: NextRequest) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const data = await backendFetch("/users/me/password", {
      method: "PUT",
      body,
      token,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Failed to change password" }, { status: 500 });
  }
}
