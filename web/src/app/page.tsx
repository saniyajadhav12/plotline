import { requireToken } from "@/lib/require-auth";
import { backendFetch } from "@/lib/api";
import {
  buildGenreRows,
  GENRE_POOL_SIZE,
  GENRE_ROW_SIZE,
  MAX_GENRE_ROWS,
  withoutShown,
} from "@/lib/genreRows";
import { TopNav } from "@/components/layout/TopNav";
import { MovieRow } from "@/components/movies/MovieRow";
import { HeroBanner } from "@/components/movies/HeroBanner";

/** Trending is fetched with headroom, since movies already shown above it are skipped. */
const TRENDING_POOL_SIZE = 40;

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

type OnboardingData = {
  selected_genres: string[] | null;
};

export default async function HomePage() {
  const token = await requireToken();

  const [recommendations, trending, onboarding] = await Promise.all([
    backendFetch<Recommendation[]>("/users/me/recommendations", { token }).catch(() => []),
    backendFetch<MovieListResponse>(`/movies?sort=popularity&page_size=${TRENDING_POOL_SIZE}`, {
      token,
    }).catch(() => ({ results: [] })),
    backendFetch<OnboardingData>("/users/me/onboarding", { token }).catch(() => ({
      selected_genres: null,
    })),
  ]);

  const recommendedMovies = recommendations.map((r) => ({ ...r.movie, recommendationId: r.id }));
  const selectedGenres = (onboarding.selected_genres ?? []).slice(0, MAX_GENRE_ROWS);

  // Feature the top recommendation in the hero if available, otherwise the
  // top trending movie, so the page always has a strong visual anchor.
  const heroSource = recommendations[0]
    ? { movie: recommendations[0].movie, recommendationId: recommendations[0].id, eyebrow: "Recommended for you" }
    : trending.results[0]
    ? { movie: trending.results[0], recommendationId: undefined, eyebrow: "Trending now" }
    : null;

  // Second batch, in parallel: hero details + a pool of popular movies per selected genre.
  const [heroDetail, popularByGenre] = await Promise.all([
    heroSource
      ? backendFetch<MovieDetail>(`/movies/${heroSource.movie.id}`, { token }).catch(() => null)
      : Promise.resolve(null),
    Promise.all(
      selectedGenres.map((genre) =>
        backendFetch<MovieListResponse>(
          `/movies?genre=${encodeURIComponent(genre)}&sort=popularity&page_size=${GENRE_POOL_SIZE}`,
          { token }
        )
          .then((res) => res.results)
          .catch(() => [])
      )
    ),
  ]);

  // Nothing repeats on the page: track every movie shown so far, top to bottom.
  const shownIds = new Set<string>(recommendations.map((r) => r.movie.id));
  if (heroSource) shownIds.add(heroSource.movie.id);

  const genreRows = buildGenreRows(selectedGenres, shownIds, popularByGenre);
  const trendingMovies = withoutShown(trending.results, shownIds).slice(0, GENRE_ROW_SIZE);

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
        {genreRows.map(({ genre, movies }) => (
          <MovieRow key={genre} title={`Because you like ${genre}`} movies={movies} />
        ))}

        <MovieRow title="Trending Now" movies={trendingMovies} />
      </main>
    </div>
  );
}
