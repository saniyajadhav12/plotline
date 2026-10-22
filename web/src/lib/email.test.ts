/** @jest-environment node */
import { appUrl, buildResetLink, composeResetEmail, sendPasswordResetEmail } from "./email";

describe("appUrl", () => {
  it("picks the right address for each environment", () => {
    expect(appUrl({ APP_URL: "https://plotline.example" })).toBe("https://plotline.example");
    expect(
      appUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "plotline-nine.vercel.app" })
    ).toBe("https://plotline-nine.vercel.app");
    expect(appUrl({ VERCEL_ENV: "preview", VERCEL_URL: "plotline-git-x.vercel.app" })).toBe(
      "https://plotline-git-x.vercel.app"
    );
    expect(appUrl({})).toBe("http://localhost:3000");
  });

  it("drops a trailing slash from APP_URL", () => {
    expect(appUrl({ APP_URL: "https://plotline.example/" })).toBe("https://plotline.example");
  });
});

describe("buildResetLink", () => {
  it("points at /reset-password with the token safely encoded", () => {
    const link = buildResetLink("a+b/c=d", "https://plotline.example");
    const url = new URL(link);

    expect(url.origin).toBe("https://plotline.example");
    expect(url.pathname).toBe("/reset-password");
    expect(url.searchParams.get("token")).toBe("a+b/c=d");
  });
});

describe("composeResetEmail", () => {
  it("includes the link in both versions and the expiry note", () => {
    const link = "https://plotline.example/reset-password?token=abc";
    const { subject, text, html } = composeResetEmail(link);

    expect(subject).toMatch(/reset your plotline password/i);
    expect(text).toContain(link);
    expect(html).toContain(link);
    expect(text).toMatch(/expires in 1 hour/i);
  });

  it("escapes the link inside the HTML", () => {
    const { html } = composeResetEmail('https://x.example/?t="><script>alert(1)</script>');

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("sendPasswordResetEmail", () => {
  it("refuses to send when Gmail isn't configured", async () => {
    const saved = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD };
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    try {
      await expect(sendPasswordResetEmail("someone@example.com", "https://x.example")).rejects.toThrow(
        /not configured/i
      );
    } finally {
      if (saved.user !== undefined) process.env.SMTP_USER = saved.user;
      if (saved.pass !== undefined) process.env.SMTP_PASSWORD = saved.pass;
    }
  });
});
