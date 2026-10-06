"use client";

import { useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { MovieCard } from "@/components/movies/MovieCard";

type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [results, setResults] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    fetch("/api/movies/genres")
      .then((res) => res.json())
      .then(setGenres);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const thisRequestId = ++requestIdRef.current;

      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (genre) params.set("genre", genre);
      params.set("sort", query.trim() ? "newest" : "popularity");
      params.set("page_size", "24");

      setLoading(true);
      fetch(`/api/movies?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          // Ignore stale responses from an earlier, since-superseded request
          if (thisRequestId !== requestIdRef.current) return;
          setResults(data.results);
          setTotal(data.total);
          setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, genre]);

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />

      <main className="max-w-6xl mx-auto px-8 sm:px-16 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink mb-6">
          Search
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
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
              placeholder="Search by title…"
              className="w-full border border-ink/20 bg-paper pl-10 pr-3 py-2.5 text-ink placeholder:text-silver focus:outline-none focus:border-marquee transition-colors"
            />
          </div>

          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="border border-ink/20 bg-paper px-3 py-2.5 text-ink focus:outline-none focus:border-marquee transition-colors"
          >
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {!loading && (query || genre) && (
          <p className="text-silver text-sm mb-6">{total} results</p>
        )}

        {loading ? (
          <p className="text-silver">Loading…</p>
        ) : results.length === 0 ? (
          <p className="text-silver">
            {query || genre ? "No movies found." : "Start typing to search, or pick a genre."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
            {results.map((movie) => (
              <MovieCard key={movie.id} {...movie} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
