// Server-side only: sends transactional email through Gmail SMTP (port 465).
import nodemailer from "nodemailer";

/**
 * The site's public address, for links in emails. Never derived from the incoming
 * request (its Host header could be forged to make us email a link to another site).
 * Order: APP_URL if set; on the live site, Vercel's production address; on a
 * preview, that preview's address; locally, http://localhost:3000.
 */
export function appUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "");
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** e.g. https://plotline-nine.vercel.app/reset-password?token=abc */
export function buildResetLink(token: string, base: string = appUrl()): string {
  const url = new URL("/reset-password", base);
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function composeResetEmail(link: string): { subject: string; text: string; html: string } {
  const subject = "Reset your Plotline password";
  const text = [
    "Someone (hopefully you) asked to reset your Plotline password.",
    "",
    "Choose a new password here:",
    link,
    "",
    "This link expires in 1 hour and can only be used once.",
    "If you didn't ask for this, you can ignore this email; your password won't change.",
  ].join("\n");
  const safeLink = escapeHtml(link);
  const html = `<div style="font-family: Arial, sans-serif; max-width: 480px; color: #151316;">
  <h2 style="margin-bottom: 8px;">Reset your Plotline password</h2>
  <p>Someone (hopefully you) asked to reset your Plotline password.</p>
  <p><a href="${safeLink}" style="display: inline-block; background: #C4472B; color: #F7F4EE; padding: 10px 18px; text-decoration: none;">Choose a new password</a></p>
  <p style="color: #8C8780; font-size: 13px;">Or paste this link into your browser:<br>${safeLink}</p>
  <p style="color: #8C8780; font-size: 13px;">This link expires in 1 hour and can only be used once. If you didn't ask for this, you can ignore this email; your password won't change.</p>
</div>`;
  return { subject, text, html };
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) throw new Error("Email is not configured (SMTP_USER / SMTP_PASSWORD missing)");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10_000,
  });
  const { subject, text, html } = composeResetEmail(link);
  await transporter.sendMail({ from: process.env.EMAIL_FROM || user, to, subject, text, html });
}
