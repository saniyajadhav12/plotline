import Link from "next/link";
import { requireToken, backendFetchOrRedirect } from "@/lib/require-auth";
import { backendFetch } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { MovieCard } from "@/components/movies/MovieCard";
import { PasswordForm } from "@/components/profile/PasswordForm";
import { RegionSelector } from "@/components/profile/RegionSelector";

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

type UserMe = {
  id: string;
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

  const [user, ratings, onboarding] = await Promise.all([
    backendFetchOrRedirect<UserMe>("/auth/me", token),
    backendFetch<RatingItem[]>("/users/me/ratings", { token }).catch(() => []),
    backendFetch<OnboardingData>("/users/me/onboarding", { token }).catch(() => ({
      selected_genres: null,
      selected_movie_ids: null,
    })),
  ]);

  const genres = onboarding.selected_genres || [];
  const favoriteMovies = await Promise.all(
    (onboarding.selected_movie_ids || []).map((id) =>
      backendFetch<Movie>(`/movies/${id}?region=${user.region_preference}`, { token }).catch(() => null)
    )
  ).then((results) => results.filter((m): m is Movie => m !== null));

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />

      <main className="max-w-5xl mx-auto px-8 sm:px-16 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink mb-1">
          Profile
        </h1>
        <p className="text-silver mb-10">{user.email}</p>

        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-ink mb-4">
            Preferences
          </h2>
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
                    className="text-xs text-silver border border-ink/15 px-2.5 py-1"
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
                  <div key={m.id} className="w-[100px]">
                    <MovieCard {...m} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/onboarding"
            className="inline-block text-sm text-ink underline hover:text-marquee transition-colors"
          >
            Edit genres & favorite movies
          </Link>
        </section>

        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-ink mb-4">
            Change Password
          </h2>
          <PasswordForm />
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-ink mb-4">
            Your Ratings
          </h2>
          {ratings.length === 0 ? (
            <p className="text-silver">You haven't rated any movies yet.</p>
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
