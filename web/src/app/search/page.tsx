"use client";

import { useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { MovieCard } from "@/components/movies/MovieCard";
import { languageName } from "@/lib/languages";
import { fetchListWithRetry } from "@/lib/fetchWithRetry";

type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
};

type Mode = "title" | "theme";

/**
 * A native <select> with our own chevron. The browser's default arrow sits flush
 * against the edge and varies between browsers; this keeps both filters identical.
 * Still a real <select>, so keyboard, screen readers and the OS menu all work as usual.
 */
function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full sm:w-48 appearance-none cursor-pointer border border-ink/20 bg-paper pl-3 pr-10 py-2.5 text-ink focus:outline-none focus:border-marquee transition-colors"
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-silver"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

export default function SearchPage() {
  // "By plot or subject" (semantic search) is temporarily hidden from the
  // UI while result quality is being tuned further. The tab bar and the
  // theme-search branch below are left in place, untouched, so it can be
  // re-enabled later by restoring the tab bar and removing this override.
  const [mode] = useState<Mode>("title");

  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [language, setLanguage] = useState("");
  const [languages, setLanguages] = useState<{ code: string; count: number }[]>([]);
  const [results, setResults] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const [themeQuery, setThemeQuery] = useState("");
  const [themeResults, setThemeResults] = useState<Movie[]>([]);
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeSearched, setThemeSearched] = useState(false);
  const themeRequestIdRef = useRef(0);

  // Named languages only, alphabetical (codes the browser can't name are skipped).
  const languageOptions = languages
    .map((l) => ({ code: l.code, name: languageName(l.code) }))
    .filter((l): l is { code: string; name: string } => l.name !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Retried, because these load once on page open, which may be while the
  // free-tier backend is still waking up. Stops if the page is left.
  useEffect(() => {
    const controller = new AbortController();
    fetchListWithRetry<string>("/api/movies/genres", { signal: controller.signal }).then((list) => {
      if (!controller.signal.aborted) setGenres(list);
    });
    fetchListWithRetry<{ code: string; count: number }>("/api/movies/languages", {
      signal: controller.signal,
    }).then((list) => {
      if (!controller.signal.aborted) setLanguages(list);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (mode !== "title") return;

    const timeout = setTimeout(() => {
      const thisRequestId = ++requestIdRef.current;

      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (genre) params.set("genre", genre);
      if (language) params.set("language", language);
      params.set("sort", query.trim() ? "newest" : "popularity");
      params.set("page_size", "24");

      setLoading(true);
      fetch(`/api/movies?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (thisRequestId !== requestIdRef.current) return;
          setResults(data.results);
          setTotal(data.total);
          setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, genre, language, mode]);

  function runThemeSearch() {
    const trimmed = themeQuery.trim();
    if (!trimmed) {
      setThemeResults([]);
      setThemeSearched(false);
      return;
    }

    const thisRequestId = ++themeRequestIdRef.current;
    setThemeLoading(true);
    setThemeSearched(true);
    fetch(`/api/movies/semantic-search?q=${encodeURIComponent(trimmed)}&limit=18`)
      .then((res) => res.json())
      .then((data) => {
        if (thisRequestId !== themeRequestIdRef.current) return;
        setThemeResults(Array.isArray(data) ? data : []);
        setThemeLoading(false);
      });
  }

  function handleThemeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      runThemeSearch();
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />

      <main className="max-w-6xl mx-auto px-8 sm:px-16 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink mb-6">
          Search
        </h1>

        {mode === "title" ? (
          <>
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

              <FilterSelect label="Genre" value={genre} onChange={setGenre}>
                <option value="">All genres</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect label="Language" value={language} onChange={setLanguage}>
                <option value="">All languages</option>
                {languageOptions.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </FilterSelect>
            </div>

            {!loading && (query || genre || language) && (
              <p className="text-silver text-sm mb-6">{total} results</p>
            )}

            {loading ? (
              <p className="text-silver">Loading…</p>
            ) : results.length === 0 ? (
              <p className="text-silver">
                {query || genre || language
                  ? "No movies found."
                  : "Start typing to search, or pick a genre or language."}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
                {results.map((movie) => (
                  <MovieCard key={movie.id} {...movie} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-3 max-w-xl">
              <input
                type="text"
                value={themeQuery}
                onChange={(e) => setThemeQuery(e.target.value)}
                onKeyDown={handleThemeKeyDown}
                placeholder="e.g. space exploration and astronauts, heist gone wrong, war-time survival…"
                className="flex-1 border border-ink/20 bg-paper px-3 py-2.5 text-ink placeholder:text-silver focus:outline-none focus:border-marquee transition-colors"
              />
              <button
                onClick={runThemeSearch}
                disabled={themeLoading || !themeQuery.trim()}
                className="bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:bg-marquee transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {themeLoading ? "Searching…" : "Search"}
              </button>
            </div>
            <p className="text-silver text-sm mb-8">
              Finds movies by plot, setting, or subject matter — not exact wording.
              Works best for concrete themes (e.g. a time period, profession, or
              event) rather than mood or tone. Press Enter or click Search to run it.
            </p>

            {themeLoading ? (
              <p className="text-silver">Searching…</p>
            ) : themeResults.length === 0 ? (
              <p className="text-silver">
                {themeSearched ? "No matches found." : "Describe a plot, setting, or subject, then search."}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
                {themeResults.map((movie) => (
                  <MovieCard key={movie.id} {...movie} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
