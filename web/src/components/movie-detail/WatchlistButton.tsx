"use client";

import { useState } from "react";

export function WatchlistButton({
  movieId,
  initialInWatchlist,
}: {
  movieId: string;
  initialInWatchlist: boolean;
}) {
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      if (inWatchlist) {
        await fetch(`/api/movies/${movieId}/watchlist`, { method: "DELETE" });
        setInWatchlist(false);
      } else {
        await fetch(`/api/movies/${movieId}/watchlist`, { method: "POST" });
        setInWatchlist(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`px-5 py-2.5 text-sm font-medium border transition-colors disabled:opacity-50 ${
        inWatchlist
          ? "bg-ink text-paper border-ink"
          : "border-ink/20 text-ink hover:border-ink/50"
      }`}
    >
      {inWatchlist ? "✓ On your watchlist" : "+ Add to Watchlist"}
    </button>
  );
}
