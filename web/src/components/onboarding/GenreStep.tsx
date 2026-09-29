"use client";

import { useEffect, useState } from "react";

export function GenreStep({
  selected,
  onChange,
  onNext,
}: {
  selected: string[];
  onChange: (genres: string[]) => void;
  onNext: () => void;
}) {
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/movies/genres")
      .then((res) => res.json())
      .then((data) => {
        setGenres(data);
        setLoading(false);
      });
  }, []);

  function toggleGenre(genre: string) {
    if (selected.includes(genre)) {
      onChange(selected.filter((g) => g !== genre));
    } else {
      onChange([...selected, genre]);
    }
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-ink mb-2">
        What do you love watching?
      </h1>
      <p className="text-silver mb-8">
        Pick a few genres. This shapes your first recommendations.
      </p>

      {loading ? (
        <p className="text-silver">Loading genres…</p>
      ) : (
        <div className="flex flex-wrap gap-2.5 mb-10">
          {genres.map((genre) => {
            const isSelected = selected.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                className={`px-4 py-2 border text-sm transition-colors ${
                  isSelected
                    ? "bg-ink text-paper border-ink"
                    : "border-ink/20 text-ink hover:border-ink/50"
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={selected.length === 0}
        className="bg-ink text-paper px-6 py-2.5 font-medium hover:bg-marquee transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  );
}
