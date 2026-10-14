import { requireToken } from "@/lib/require-auth";
import { backendFetch } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { MovieRow } from "@/components/movies/MovieRow";
import { HeroBanner } from "@/components/movies/HeroBanner";

type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  genres?: string[] | null;
};

type Recommendation = {
  id: string;
  method: string;
  explanation_text: string | null;
  movie: Movie;
};

type MovieListResponse = {
  results: Movie[];
};

type MovieDetail = Movie & {
  description: string | null;
};

export default async function HomePage() {
  const token = await requireToken();

  const [recommendations, trending] = await Promise.all([
    backendFetch<Recommendation[]>("/users/me/recommendations", { token }).catch(() => []),
    backendFetch<MovieListResponse>("/movies?sort=popularity&page_size=20", { token }).catch(
      () => ({ results: [] })
    ),
  ]);

  const recommendedMovies = recommendations.map((r) => ({ ...r.movie, recommendationId: r.id }));

  // Group recommendations by their first genre for "Because you liked X" rows
  const byGenre = new Map<string, Movie[]>();
  for (const rec of recommendations) {
    const genre = rec.movie.genres?.[0];
    if (!genre) continue;
    if (!byGenre.has(genre)) byGenre.set(genre, []);
    byGenre.get(genre)!.push(rec.movie);
  }
  const genreRows = Array.from(byGenre.entries()).filter(([, movies]) => movies.length >= 2);

  // Feature the top recommendation in the hero if available, otherwise the
  // top trending movie, so the page always has a strong visual anchor.
  const heroSource = recommendations[0]
    ? { movie: recommendations[0].movie, recommendationId: recommendations[0].id, eyebrow: "Recommended for you" }
    : trending.results[0]
    ? { movie: trending.results[0], recommendationId: undefined, eyebrow: "Trending now" }
    : null;

  const heroDetail = heroSource
    ? await backendFetch<MovieDetail>(`/movies/${heroSource.movie.id}`, { token }).catch(() => null)
    : null;

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />

      {heroSource && heroDetail && (
        <HeroBanner
          id={heroDetail.id}
          title={heroDetail.title}
          year={heroDetail.year}
          poster_url={heroDetail.poster_url}
          description={heroDetail.description}
          genres={heroDetail.genres}
          eyebrow={heroSource.eyebrow}
          recommendationId={heroSource.recommendationId}
        />
      )}

      <main className="max-w-6xl mx-auto px-8 sm:px-16 pb-10">
        {!heroSource && (
          <div className="mb-12 pt-10">
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink mb-2">
              Welcome to Plotline
            </h1>
            <p className="text-silver">
              Rate a few movies and we&apos;ll start building your recommendations.
            </p>
          </div>
        )}

        {recommendedMovies.length > 1 && (
          <MovieRow
            title="Recommended for You"
            subtitle="Picked based on your taste"
            movies={recommendedMovies.slice(1)}
          />
        )}
        {genreRows.map(([genre, movies]) => (
          <MovieRow
            key={genre}
            title={`Because you like ${genre}`}
            movies={movies}
          />
        ))}

        <MovieRow title="Trending Now" movies={trending.results} />
      </main>
    </div>
  );
}
