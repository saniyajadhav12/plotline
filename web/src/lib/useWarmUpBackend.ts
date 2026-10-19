"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget request that wakes the backend if it's asleep (free-tier
 * hosting spins it down after ~15 minutes idle and takes ~1 minute to wake).
 * Used on pages that render without the backend (login, signup), so the wake-up
 * happens while the visitor reads the page and types. Failures are ignored.
 */
export function useWarmUpBackend() {
  useEffect(() => {
    fetch("/api/health", { cache: "no-store" }).catch(() => {});
  }, []);
}
