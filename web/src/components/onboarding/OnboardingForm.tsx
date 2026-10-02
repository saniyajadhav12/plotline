"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
};

export function OnboardingForm({
  initialGenres,
  initialMovies,
  isFirstTime,
}: {
  initialGenres: string[];
  initialMovies: Movie[];
  isFirstTime: boolean;
}) {
  const router = useRouter();

  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialGenres);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<Map<string, Movie>>(
    new Map(initialMovies.map((m) => [m.id, m]))
  );

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/movies/genres")
      .then((res) => res.json())
      .then(setAllGenres);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      const timeout = setTimeout(() => setSearchResults([]), 0);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(() => {
      fetch(`/api/movies?q=${encodeURIComponent(query)}&page_size=12&sort=popularity`)
        .then((res) => res.json())
        .then((data) => setSearchResults(data.results));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  }

  function toggleMovie(movie: Movie) {
    setSelectedMovies((prev) => {
      const next = new Map(prev);
      if (next.has(movie.id)) {
        next.delete(movie.id);
      } else {
        next.set(movie.id, movie);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_genres: selectedGenres,
          selected_movie_ids: Array.from(selectedMovies.keys()),
        }),
      });

      if (response.ok === false) {
        const data = await response.json();
        setError(data.detail || "Failed to save your preferences. Please try again.");
        return;
      }

      if (isFirstTime) {
        router.push("/");
        router.refresh();
      } else {
        router.push("/profile");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-ink mb-2">
        Your taste profile
      </h1>
      <p className="text-silver mb-10">
        Update your genres and favorite movies any time. Each saves independently.
      </p>

      <section className="mb-12">
        <h2 className="text-lg font-medium text-ink mb-1">Genres</h2>
        <p className="text-sm text-silver mb-4">Pick as many as you like.</p>
        <div className="flex flex-wrap gap-2.5">
          {allGenres.map((genre) => {
            const isSelected = selectedGenres.includes(genre);
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
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-medium text-ink mb-1">Favorite movies</h2>
        <p className="text-sm text-silver mb-4">
          Search and select movies you already love.
        </p>

        <div className="relative max-w-md mb-6">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-silver"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
            />
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
            <p className="text-sm text-silver mb-2">{selectedMovies.size} selected</p>
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

        {query.trim() && searchResults.length === 0 && (
          <p className="text-silver mb-6">No movies found. Try another title.</p>
        )}

        {searchResults.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {searchResults.map((movie) => {
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
        )}
      </section>

      {error && <p className="text-marquee text-sm mb-4">{error}</p>}
      {message && <p className="text-sm mb-4" style={{ color: "#2B3A42" }}>{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-ink text-paper px-6 py-2.5 font-medium hover:bg-marquee transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Preferences"}
      </button>
    </div>
  );
}
