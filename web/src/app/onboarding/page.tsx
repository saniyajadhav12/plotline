import { requireToken } from "@/lib/require-auth";
import { backendFetch } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

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

export default async function OnboardingPage() {
  const token = await requireToken();

  const existing = await backendFetch<OnboardingData>("/users/me/onboarding", { token }).catch(
    () => ({ selected_genres: null, selected_movie_ids: null })
  );

  const initialMovies = await Promise.all(
    (existing.selected_movie_ids || []).map((id) =>
      backendFetch<Movie>(`/movies/${id}?region=US`, { token }).catch(() => null)
    )
  );

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <div className="px-8 py-12 sm:px-16">
        <div className="max-w-3xl mx-auto">
          <OnboardingForm
            initialGenres={existing.selected_genres || []}
            initialMovies={initialMovies.filter((m): m is Movie => m !== null)}
            isFirstTime={existing.selected_genres === null && existing.selected_movie_ids === null}
          />
        </div>
      </div>
    </div>
  );
}
