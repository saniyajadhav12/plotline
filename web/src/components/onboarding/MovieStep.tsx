"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
};

export function MovieStep({
  selected,
  onChange,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  selected: string[];
  onChange: (movieIds: string[]) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<Map<string, Movie>>(new Map());

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/movies?q=${encodeURIComponent(query)}&page_size=12&sort=popularity`)
        .then((res) => res.json())
        .then((data) => setResults(data.results));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function toggleMovie(movie: Movie) {
    const next = new Map(selectedMovies);
    if (next.has(movie.id)) {
      next.delete(movie.id);
    } else {
      next.set(movie.id, movie);
    }
    setSelectedMovies(next);
    onChange(Array.from(next.keys()));
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-ink mb-2">
        Name a few favorites
      </h1>
      <p className="text-silver mb-6">
        Search for movies you already love. Pick as many as you like.
      </p>

      <div className="relative w-full max-w-md mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-silver"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies…"
          className="w-full border border-ink/20 bg-paper pl-10 pr-3 py-2.5 text-ink placeholder:text-silver focus:outline-none focus:border-marquee transition-colors"
        />
      </div>

      {selectedMovies.size > 0 && (
        <div className="mb-6">
          <p className="text-sm text-silver mb-2">
            {selectedMovies.size} selected
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedMovies.values()).map((movie) => (
              <span
                key={movie.id}
                className="text-sm bg-ink text-paper px-3 py-1 flex items-center gap-2"
              >
                {movie.title}
                <button
                  type="button"
                  onClick={() => toggleMovie(movie)}
                  className="text-paper/70 hover:text-paper"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <p className="text-silver mb-10">No movies found. Try another title.</p>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mb-10">
        {results.map((movie) => {
          const isSelected = selectedMovies.has(movie.id);
          return (
            <button
              key={movie.id}
              type="button"
              onClick={() => toggleMovie(movie)}
              className={`relative aspect-[2/3] overflow-hidden border-2 transition-colors ${
                isSelected ? "border-marquee" : "border-transparent"
              }`}
            >
              {movie.poster_url ? (
                <Image
                  src={movie.poster_url}
                  alt={movie.title}
                  fill
                  sizes="150px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-film flex items-center justify-center text-paper text-xs p-2 text-center">
                  {movie.title}
                </div>
              )}
              {isSelected && (
                <div className="absolute inset-0 bg-marquee/20 flex items-center justify-center">
                  <span className="text-paper text-2xl">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-marquee text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="border border-ink/20 text-ink px-6 py-2.5 font-medium hover:border-ink/50 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="bg-ink text-paper px-6 py-2.5 font-medium hover:bg-marquee transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving…" : "Finish"}
        </button>
      </div>
    </div>
  );
}
