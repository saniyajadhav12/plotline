import { NextRequest, NextResponse } from "next/server";
import { backendFetch, ApiError } from "@/lib/api";
import { buildResetLink, sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs"; // nodemailer needs Node, not the edge runtime

const GENERIC_MESSAGE = "If that email is registered, a reset link has been sent.";

/**
 * Asks the backend for a reset token (proving itself with INTERNAL_API_KEY), emails
 * the reset link if one comes back, and always answers the browser with the same
 * generic message: never a token, and no hint whether the account exists or the
 * email was sent. Sending failures are logged on the server instead.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  const internalKey = process.env.INTERNAL_API_KEY;
  try {
    const result = await backendFetch<{ message?: string; reset_token?: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
      headers: internalKey ? { "X-Internal-Key": internalKey } : {},
    });

    if (result.reset_token) {
      try {
        await sendPasswordResetEmail(email, buildResetLink(result.reset_token));
      } catch (error) {
        console.error("[forgot-password] could not send the reset email:", error instanceof Error ? error.message : error);
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    if (error instanceof ApiError) {
      // e.g. 422 for a malformed email address; safe to show, reveals nothing about accounts.
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Request failed" }, { status: 500 });
  }
}
