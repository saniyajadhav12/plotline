import { redirect } from "next/navigation";
import { getToken } from "@/lib/session";
import { backendFetch } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { MovieRow } from "@/components/movies/MovieRow";

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

export default async function HomePage() {
  const token = await getToken();
  if (!token) {
    redirect("/login");
  }

  const [recommendations, trending] = await Promise.all([
    backendFetch<Recommendation[]>("/users/me/recommendations", { token }).catch(() => []),
    backendFetch<MovieListResponse>("/movies?sort=popularity&page_size=20", { token }).catch(
      () => ({ results: [] })
    ),
  ]);

  const recommendedMovies = recommendations.map((r) => r.movie);

  // Group recommendations by their first genre for "Because you liked X" rows
  const byGenre = new Map<string, Movie[]>();
  for (const rec of recommendations) {
    const genre = rec.movie.genres?.[0];
    if (!genre) continue;
    if (!byGenre.has(genre)) byGenre.set(genre, []);
    byGenre.get(genre)!.push(rec.movie);
  }
  const genreRows = Array.from(byGenre.entries()).filter(([, movies]) => movies.length >= 2);

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />

      <main className="max-w-6xl mx-auto px-8 sm:px-16 py-10">
        {recommendedMovies.length === 0 && genreRows.length === 0 ? (
          <div className="mb-12">
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink mb-2">
              Welcome to Plotline
            </h1>
            <p className="text-silver">
              Rate a few movies and we'll start building your recommendations.
            </p>
          </div>
        ) : (
          <>
            <MovieRow
              title="Recommended for You"
              subtitle="Picked based on your taste"
              movies={recommendedMovies}
            />
            {genreRows.map(([genre, movies]) => (
              <MovieRow
                key={genre}
                title={`Because you like ${genre}`}
                movies={movies}
              />
            ))}
          </>
        )}

        <MovieRow title="Trending Now" movies={trending.results} />
      </main>
    </div>
  );
}
