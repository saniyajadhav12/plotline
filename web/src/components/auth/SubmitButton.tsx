"use client";

import { useEffect, useState } from "react";

/** After this long, a pending request is probably waiting on a sleeping free-tier backend. */
export const SLOW_REQUEST_MS = 4000;

/**
 * Mounted only while the button is loading, so every attempt starts fresh at
 * "Please wait…" and its timer is cleaned up automatically when loading ends.
 */
function LoadingLabel() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_REQUEST_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span aria-live="polite">
      {isSlow ? "Waking up the server — this can take up to a minute…" : "Please wait…"}
    </span>
  );
}

export function SubmitButton({
  children,
  loading,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-ink text-paper py-2.5 font-medium hover:bg-marquee transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? <LoadingLabel /> : children}
    </button>
  );
}
