"use client";

import { useEffect, useState } from "react";
import { SLOW_REQUEST_MS } from "@/components/auth/SubmitButton";

/**
 * Shown instantly while a page waits on the backend. Normal loads finish well
 * before SLOW_REQUEST_MS and only ever see the spinner; past that, the backend
 * is most likely waking up from free-tier sleep, so say so.
 */
export default function Loading() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_REQUEST_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-paper flex flex-col items-center justify-center gap-5 px-8 text-center"
    >
      <div className="h-10 w-10 rounded-full border-4 border-ink/15 border-t-marquee animate-spin" />
      {isSlow ? (
        <>
          <p className="font-[family-name:var(--font-display)] text-2xl text-ink">Waking up the server…</p>
          <p className="text-sm text-silver max-w-sm">
            Plotline runs on free hosting that sleeps when it hasn&apos;t been used for a while. The first
            load can take up to a minute — after that it&apos;s fast.
          </p>
        </>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );
}
