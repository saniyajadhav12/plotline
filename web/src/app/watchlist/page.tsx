import { requireToken } from "@/lib/require-auth";
import { backendFetch } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { MovieCard } from "@/components/movies/MovieCard";

type WatchlistItem = {
  id: string;
  added_at: string;
  movie: {
    id: string;
    title: string;
    year: number | null;
    poster_url: string | null;
  };
};

export default async function WatchlistPage() {
  const token = await requireToken();

  const items = await backendFetch<WatchlistItem[]>("/users/me/watchlist", { token }).catch(
    () => []
  );

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />

      <main className="max-w-6xl mx-auto px-8 sm:px-16 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink mb-2">
          Your Watchlist
        </h1>
        <p className="text-silver mb-8">
          {items.length} {items.length === 1 ? "movie" : "movies"} saved to watch later.
        </p>

        {items.length === 0 ? (
          <p className="text-silver">
            Nothing here yet. Add movies from their detail page to build your watchlist.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
            {items.map((item) => (
              <MovieCard key={item.id} {...item.movie} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
