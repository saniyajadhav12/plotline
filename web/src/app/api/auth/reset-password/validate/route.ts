import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/api";

/** Whether a reset link's token still works (exists, unused, not expired). */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ valid: false });

  try {
    const result = await backendFetch<{ valid?: boolean }>(
      `/auth/reset-password/validate?token=${encodeURIComponent(token)}`
    );
    return NextResponse.json({ valid: result.valid === true });
  } catch {
    // The page treats this as "couldn't check" and shows the form; submitting still verifies.
    return NextResponse.json({ detail: "Could not check the link" }, { status: 502 });
  }
}
