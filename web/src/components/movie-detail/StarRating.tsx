"use client";

import { useState } from "react";

export function StarRating({
  movieId,
  initialRating,
}: {
  movieId: string;
  initialRating?: number;
}) {
  const [rating, setRating] = useState(initialRating || 0);
  const [hovered, setHovered] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleRate(value: number) {
    setRating(value);
    setSaving(true);
    try {
      await fetch(`/api/movies/${movieId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating_value: value }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={saving}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => handleRate(star)}
            className="text-2xl leading-none disabled:cursor-wait"
          >
            <span
              className={
                star <= (hovered || rating) ? "text-gold" : "text-ink/15"
              }
            >
              ★
            </span>
          </button>
        ))}
      </div>
      {rating > 0 && (
        <span className="text-sm text-silver">Your rating: {rating}/5</span>
      )}
    </div>
  );
}
