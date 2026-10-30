import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

/**
 * Playwright config for the README screenshots only. Not part of Jest or CI.
 * Run by hand against the LOCAL stack (see the header of screenshots.capture.ts).
 * Run output goes to the OS temp folder so nothing lands in the repo.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "screenshots.capture.ts",
  outputDir: path.join(os.tmpdir(), "plotline-playwright"),
  reporter: "list",
  workers: 1,
  timeout: 180_000,
  use: {
    baseURL: process.env.PLOTLINE_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
});
