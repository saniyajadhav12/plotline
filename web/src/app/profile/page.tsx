import Link from "next/link";
import { requireToken, backendFetchOrRedirect } from "@/lib/require-auth";
import { backendFetch } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { MovieCard } from "@/components/movies/MovieCard";
import { PasswordForm } from "@/components/profile/PasswordForm";
import { RegionSelector } from "@/components/profile/RegionSelector";
import { Avatar } from "@/components/profile/Avatar";

type RatingItem = {
  id: string;
  rating_value: number;
  movie: {
    id: string;
    title: string;
    year: number | null;
    poster_url: string | null;
  };
};

type WatchlistItem = {
  id: string;
  movie: {
    id: string;
  };
};

type UserMe = {
  id: string;
  name: string | null;
  email: string;
  region_preference: string;
};

type OnboardingData = {
  selected_genres: string[] | null;
  selected_movie_ids: string[] | null;
};

type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
};

export default async function ProfilePage() {
  const token = await requireToken();

  const [user, ratings, onboarding, watchlist] = await Promise.all([
    backendFetchOrRedirect<UserMe>("/auth/me", token),
    backendFetch<RatingItem[]>("/users/me/ratings", { token }).catch(() => []),
    backendFetch<OnboardingData>("/users/me/onboarding", { token }).catch(() => ({
      selected_genres: null,
      selected_movie_ids: null,
    })),
    backendFetch<WatchlistItem[]>("/users/me/watchlist", { token }).catch(() => []),
  ]);

  const genres = onboarding.selected_genres || [];
  const favoriteMovies = await Promise.all(
    (onboarding.selected_movie_ids || []).map((id) =>
      backendFetch<Movie>(`/movies/${id}?region=${user.region_preference}`, { token }).catch(() => null)
    )
  ).then((results) => results.filter((m): m is Movie => m !== null));

  const displayName = user.name || user.email.split("@")[0];
  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.rating_value, 0) / ratings.length).toFixed(1)
      : null;

  const stats = [
    { label: "Movies Rated", value: ratings.length },
    { label: "In Watchlist", value: watchlist.length },
    { label: "Favorite Genres", value: genres.length },
    ...(avgRating ? [{ label: "Avg. Rating", value: `${avgRating} ★` }] : []),
  ];

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />

      <main className="max-w-5xl mx-auto px-8 sm:px-16 py-10">
        <div className="flex items-center gap-5 mb-8">
          <Avatar name={displayName} />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink">
              {displayName}
            </h1>
            <p className="text-silver text-sm">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, i) => {
            const accentColors = ["bg-marquee", "bg-film", "bg-gold", "bg-silver"];
            return (
              <div key={stat.label} className="border border-ink/10 bg-paper overflow-hidden">
                <div className={`h-1 ${accentColors[i % accentColors.length]}`} />
                <div className="px-4 py-4">
                  <p className="font-[family-name:var(--font-display)] text-2xl text-ink">
                    {stat.value}
                  </p>
                  <p className="text-xs text-silver uppercase tracking-wide mt-1">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <section className="mb-10 border border-ink/10 border-l-4 border-l-film p-6 sm:p-8 pl-8 sm:pl-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-ink">
              Preferences
            </h2>
            <Link
              href="/onboarding"
              aria-label="Edit genres & favorite movies"
              title="Edit genres & favorite movies"
              className="text-silver hover:text-marquee transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487a2.06 2.06 0 112.914 2.914L7.5 19.675 3 21l1.325-4.5L16.862 4.487z"
                />
              </svg>
            </Link>
          </div>
          <div className="mb-6">
            <p className="text-sm text-ink mb-2">OTT Region</p>
            <RegionSelector initialRegion={user.region_preference} />
          </div>

          <div className="mb-4">
            <p className="text-sm text-ink mb-2">Favorite genres</p>
            {genres.length === 0 ? (
              <p className="text-sm text-silver">None selected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="text-xs text-ink bg-gold/15 border border-gold/30 px-2.5 py-1"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <p className="text-sm text-ink mb-2">Favorite movies</p>
            {favoriteMovies.length === 0 ? (
              <p className="text-sm text-silver">None selected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {favoriteMovies.map((m) => (
                  <MovieCard key={m.id} {...m} />
                ))}
              </div>
            )}
          </div>

        </section>

        <section className="mb-10 border border-ink/10 border-l-4 border-l-marquee p-6 sm:p-8 pl-8 sm:pl-10">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-ink mb-4">
            Change Password
          </h2>
          <PasswordForm />
        </section>

        <section className="border border-ink/10 border-l-4 border-l-gold p-6 sm:p-8 pl-8 sm:pl-10">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-ink mb-4">
            Your Ratings
          </h2>
          {ratings.length === 0 ? (
            <p className="text-silver">You haven&apos;t rated any movies yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
              {ratings.map((r) => (
                <div key={r.id}>
                  <MovieCard {...r.movie} />
                  <p className="text-xs text-gold mt-1">{r.rating_value}/5 ★</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
