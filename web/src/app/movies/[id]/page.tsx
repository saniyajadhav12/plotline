import Image from "next/image";
import { requireToken, backendFetchOrRedirect } from "@/lib/require-auth";
import { backendFetch } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { StarRating } from "@/components/movie-detail/StarRating";
import { WatchlistButton } from "@/components/movie-detail/WatchlistButton";

type CastCrewMember = {
  person_name: string;
  role: string;
  character_name: string | null;
};

type WatchProvider = {
  provider_name: string;
  provider_type: string;
};

type MovieDetail = {
  id: string;
  title: string;
  year: number | null;
  genres: string[] | null;
  description: string | null;
  poster_url: string | null;
  average_rating: number | null;
  tmdb_rating: number | null;
  tmdb_vote_count: number | null;
  cast: CastCrewMember[];
  director: CastCrewMember[];
  watch_providers: WatchProvider[];
};

type Recommendation = {
  id: string;
  explanation_text: string | null;
  movie: { id: string };
};

type UserMe = {
  region_preference: string;
};

type WatchlistItem = {
  movie: { id: string };
};

export default async function MovieDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rec?: string }>;
}) {
  const token = await requireToken();

  const { id } = await params;
  const { rec } = await searchParams;

  const user = await backendFetch<UserMe>("/auth/me", { token }).catch(() => null);
  const region = user?.region_preference || "US";

  const movie = await backendFetchOrRedirect<MovieDetail>(`/movies/${id}?region=${region}`, token);

  const [myRatings, myWatchlist, recommendations] = await Promise.all([
    backendFetch<{ movie: { id: string }; rating_value: number }[]>("/users/me/ratings", {
      token,
    }).catch(() => []),
    backendFetch<WatchlistItem[]>("/users/me/watchlist", { token }).catch(() => []),
    rec
      ? backendFetch<Recommendation[]>("/users/me/recommendations", { token }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const existingRating = myRatings.find((r) => r.movie.id === id);
  const isInWatchlist = myWatchlist.some((w) => w.movie.id === id);
  const matchingRecommendation = rec
    ? recommendations.find((r) => r.id === rec && r.movie.id === id)
    : undefined;

  const directorNames = movie.director.map((d) => d.person_name).join(", ");

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />

      <main className="max-w-5xl mx-auto px-8 sm:px-16 py-10">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-10">
          <div className="relative aspect-[2/3] bg-film">
            {movie.poster_url ? (
              <Image
                src={movie.poster_url}
                alt={movie.title}
                fill
                sizes="320px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-paper p-4 text-center">
                {movie.title}
              </div>
            )}
          </div>

          <div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl text-ink mb-2">
              {movie.title}
            </h1>
            <p className="text-silver mb-4">
              {movie.year}
              {directorNames && ` · Directed by ${directorNames}`}
            </p>

            {movie.genres && (
              <div className="flex flex-wrap gap-2 mb-5">
                {movie.genres.map((g) => (
                  <span
                    key={g}
                    className="text-xs text-silver border border-ink/15 px-2.5 py-1"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {(movie.average_rating !== null || movie.tmdb_rating !== null) && (
              <div className="flex flex-wrap items-center gap-4 text-sm text-ink mb-5">
                {movie.tmdb_rating !== null && (
                  <span>
                    <span className="text-gold">★</span> {movie.tmdb_rating}/10{" "}
                    <span className="text-silver">
                      TMDb{movie.tmdb_vote_count ? ` (${movie.tmdb_vote_count.toLocaleString()} votes)` : ""}
                    </span>
                  </span>
                )}
                {movie.average_rating !== null && (
                  <span>
                    <span className="text-gold">★</span> {movie.average_rating}/5{" "}
                    <span className="text-silver">Plotline users</span>
                  </span>
                )}
              </div>
            )}

            {movie.description && (
              <p className="text-ink/80 leading-relaxed mb-6 max-w-xl">
                {movie.description}
              </p>
            )}

            {matchingRecommendation?.explanation_text && (
              <div className="bg-film text-paper p-5 mb-6 max-w-xl">
                <p className="text-xs uppercase tracking-wide text-paper/60 mb-2">
                  Why this was recommended
                </p>
                <p className="leading-relaxed">
                  {matchingRecommendation.explanation_text}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 mb-8">
              <StarRating movieId={movie.id} initialRating={existingRating?.rating_value} />
              <WatchlistButton movieId={movie.id} initialInWatchlist={isInWatchlist} />
            </div>

            {movie.cast.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-medium text-ink mb-2">Cast</h2>
                <p className="text-sm text-silver">
                  {movie.cast
                    .slice(0, 6)
                    .map((c) => c.person_name)
                    .join(", ")}
                </p>
              </div>
            )}

            {movie.watch_providers.length > 0 && (() => {
              const grouped = new Map<string, Set<string>>();
              for (const p of movie.watch_providers) {
                const existing = grouped.get(p.provider_name);
                if (existing) {
                  existing.add(p.provider_type);
                } else {
                  grouped.set(p.provider_name, new Set([p.provider_type]));
                }
              }
              const typeLabel = (types: Set<string>) => {
                if (types.has("subscription")) return "Stream";
                if (types.has("rent") && types.has("buy")) return "Rent/Buy";
                if (types.has("rent")) return "Rent";
                if (types.has("buy")) return "Buy";
                return "";
              };

              return (
                <div>
                  <h2 className="text-sm font-medium text-ink mb-2">
                    Watch on ({region})
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(grouped.entries()).map(([name, types]) => (
                      <span
                        key={name}
                        className="text-xs text-ink border border-ink/15 px-2.5 py-1"
                      >
                        {name}
                        <span className="text-silver"> · {typeLabel(types)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}
