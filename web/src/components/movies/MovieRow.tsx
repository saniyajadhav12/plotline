import { MovieCard } from "./MovieCard";

type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  recommendationId?: string;
};

export function MovieRow({
  title,
  subtitle,
  movies,
}: {
  title: string;
  subtitle?: string;
  movies: Movie[];
}) {
  if (movies.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink mb-1">
        {title}
      </h2>
      {subtitle && <p className="text-silver text-sm mb-4">{subtitle}</p>}
      <div className="flex gap-5 overflow-x-auto pb-2 -mx-8 px-8 sm:-mx-16 sm:px-16">
        {movies.map((movie) => (
          <MovieCard key={movie.id} {...movie} />
        ))}
      </div>
    </section>
  );
}
