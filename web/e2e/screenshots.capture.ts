/**
 * Captures the README screenshots from the LOCAL app with a fake demo account.
 *
 * Prereqs: local DB (Docker), backend on :8000 and `npm run dev` on :3000.
 *
 *   cd web
 *   export PLOTLINE_DEMO_PASSWORD=...           # demo account only, never commit it
 *   export SCREENSHOT_DIR=/some/tmp/folder      # raw PNGs (default: OS temp folder)
 *   npx playwright test --config e2e/screenshots.config.ts --grep setup          # first run only: creates the account
 *   npx playwright test --config e2e/screenshots.config.ts --grep-invert setup   # takes the screenshots
 *
 * Then convert to the committed WebP files (cwebp is free, from Google's libwebp):
 *   cwebp -q 82 -resize 1400 0 "$SCREENSHOT_DIR/<name>.png" -o ../docs/screenshots/<name>.webp
 */
import { test, expect, type Page } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const DEMO_NAME = "Demo User";
const DEMO_EMAIL = process.env.PLOTLINE_DEMO_EMAIL ?? "demo@example.com";
const DEMO_PASSWORD = process.env.PLOTLINE_DEMO_PASSWORD ?? "";
const OUT_DIR = process.env.SCREENSHOT_DIR ?? path.join(os.tmpdir(), "plotline-screenshots");

const GENRES = ["Science Fiction", "Thriller", "Animation", "Drama"];
const FAVORITES = ["Interstellar", "Inception", "Arrival", "Spirited Away", "Parasite", "The Dark Knight"];

test.describe.configure({ mode: "serial" });

test.beforeAll(({ baseURL }) => {
  // Guard against pointing this at the live site by accident.
  const host = new URL(baseURL ?? "").hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`Screenshots must be taken from the local app, not ${baseURL}`);
  }
  if (!DEMO_PASSWORD) throw new Error("Set PLOTLINE_DEMO_PASSWORD (demo account only).");
});

/** Saves next-themes' choice before any page script runs, so there is no flash. */
async function useTheme(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEMO_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

/** Waits until every image visible in the viewport has finished loading. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => {
        const r = img.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
      })
      .every((img) => img.complete && img.naturalWidth > 0)
  );
}

async function shoot(page: Page, name: string, fullPage = false) {
  await settle(page);
  // Hide the Next.js dev-mode badge (only exists under `npm run dev`).
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage });
}

test("setup: create the demo account and save a taste profile", async ({ page }) => {
  await useTheme(page, "dark");
  await page.goto("/signup");
  await page.getByLabel("Name").fill(DEMO_NAME);
  await page.getByLabel("Email").fill(DEMO_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");

  for (const genre of GENRES) {
    await page.getByRole("button", { name: genre, exact: true }).click();
  }

  const search = page.getByPlaceholder("Search movies…");
  for (const title of FAVORITES) {
    await search.fill(title);
    await page.getByRole("button", { name: title, exact: true }).first().click();
  }

  await page.getByRole("button", { name: "Save Preferences" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 150_000 });
});

test("onboarding: taste profile with a search in progress", async ({ page }) => {
  await useTheme(page, "dark");
  await signIn(page);
  // Same page new users land on; it shows the saved genres and favorites. Nothing is saved here.
  await page.goto("/onboarding");
  await expect(page.getByText(`${FAVORITES.length} selected`)).toBeVisible();
  await page.getByPlaceholder("Search movies…").fill("Blade Runner");
  await expect(page.getByRole("button", { name: "Blade Runner 2049", exact: true })).toBeVisible();
  await shoot(page, "onboarding", true);
});

test("home: recommendation rows in dark and light", async ({ page }) => {
  await useTheme(page, "dark");
  await signIn(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Recommended for You" })).toBeVisible();
  await shoot(page, "home-recommendations-dark");

  await useTheme(page, "light");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Recommended for You" })).toBeVisible();
  await shoot(page, "home-recommendations-light");
});

test("movie detail: the top recommendation", async ({ page }) => {
  await useTheme(page, "dark");
  await signIn(page);
  await page.goto("/");
  // The hero banner is the top recommendation; its link opens the detail page.
  await page.locator('a[href^="/movies/"]').first().click();
  await page.waitForURL("**/movies/**");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shoot(page, "movie-detail");
});

test("search: genre filter", async ({ page }) => {
  await useTheme(page, "dark");
  await signIn(page);
  await page.goto("/search");
  await page.getByLabel("Genre").selectOption("Science Fiction");
  await expect(page.getByText(/\d+ results/)).toBeVisible();
  await shoot(page, "search-filters");
});
