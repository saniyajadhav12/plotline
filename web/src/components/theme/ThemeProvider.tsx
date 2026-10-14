"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * App-wide theme state. Light / Dark / System, defaulting to System (follows the
 * device setting and updates live if it changes). Puts class="dark" on <html>,
 * which swaps the color tokens defined in globals.css. The choice is saved per
 * device in localStorage, and next-themes applies it before first paint, so
 * there is no flash of the wrong theme on load.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
