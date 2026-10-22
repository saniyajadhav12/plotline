// TEMPORARY: checks whether this deployment can send email through Gmail SMTP.
// Only runs on preview deployments and locally, only ever emails the Plotline
// account itself, and never returns the password. Delete before merging.
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    return NextResponse.json(
      { ok: false, error: "SMTP_USER or SMTP_PASSWORD is not set for this deployment" },
      { status: 500 }
    );
  }

  const results = [];
  for (const port of [465, 587]) {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10_000,
    });
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || user,
        to: user,
        subject: `Plotline SMTP test (port ${port})`,
        text: `Sent from Vercel (${process.env.VERCEL_ENV ?? "local"}) via port ${port} at ${new Date().toISOString()}.`,
      });
      results.push({ port, ok: true, accepted: info.accepted });
      break; // one working port is enough
    } catch (error) {
      const e = error as { code?: string; message?: string };
      results.push({ port, ok: false, code: e.code, error: e.message?.slice(0, 200) });
    }
  }

  const ok = results.some((r) => r.ok);
  return NextResponse.json(
    { ok, environment: process.env.VERCEL_ENV ?? "local", results },
    { status: ok ? 200 : 502 }
  );
}
