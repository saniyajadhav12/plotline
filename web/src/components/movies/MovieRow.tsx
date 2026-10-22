"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MovieCard } from "./MovieCard";

type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  recommendationId?: string;
};

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

// Each edge fades from the page background into the posters, with the arrow on
// top. A fade (and its arrow) only appears when that side can actually scroll.
const FADE =
  "pointer-events-none absolute inset-y-0 z-10 hidden sm:block w-16 lg:w-24 transition-opacity duration-200";
const ARROW =
  "pointer-events-auto absolute top-[38%] -translate-y-1/2 flex items-center justify-center " +
  "h-10 w-10 rounded-full bg-paper/90 text-ink shadow-md border border-silver/30 " +
  "transition hover:bg-ink hover:text-paper";

export function MovieRow({
  title,
  subtitle,
  movies,
}: {
  title: string;
  subtitle?: string;
  movies: Movie[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      observer.disconnect();
    };
  }, [updateArrows, movies.length]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (movies.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink mb-1">{title}</h2>
      {subtitle && <p className="text-silver text-sm mb-4">{subtitle}</p>}

      <div className="relative bleed-x">
        <div
          className={`${FADE} left-0 bg-gradient-to-r from-paper via-paper/80 to-transparent ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        >
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              aria-label={`Scroll ${title} left`}
              className={`${ARROW} left-3`}
            >
              <Chevron direction="left" />
            </button>
          )}
        </div>

        <div
          ref={scrollerRef}
          className="flex gap-5 overflow-x-auto pb-2 gutter-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {movies.map((movie) => (
            <MovieCard key={movie.id} {...movie} />
          ))}
        </div>

        <div
          className={`${FADE} right-0 bg-gradient-to-l from-paper via-paper/80 to-transparent ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        >
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              aria-label={`Scroll ${title} right`}
              className={`${ARROW} right-3`}
            >
              <Chevron direction="right" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
