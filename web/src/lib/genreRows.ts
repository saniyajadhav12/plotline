export type RowMovie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  genres?: string[] | null;
  recommendationId?: string;
};

export type GenreRecommendation = {
  id: string;
  movie: RowMovie;
};

export const MAX_GENRE_ROWS = 4;
export const GENRE_ROW_SIZE = 20;
const MIN_ROW_SIZE = 2;

/**
 * Builds the home page's "Because you like <genre>" rows from the genres the user
 * actually selected (not from whatever genre their recommendations list first).
 *
 * Each row starts with the user's recommendations that include the genre anywhere
 * in their genre list (keeping their recommendationId, so the detail page can show
 * "Why this was recommended"), then fills up with popular movies in that genre.
 * Fillers skip movies already in "Recommended for You", and a filler appears in at
 * most one genre row. Rows with fewer than MIN_ROW_SIZE movies are dropped.
 *
 * popularByGenre[i] holds the popular movies for selectedGenres[i].
 */
export function buildGenreRows(
  selectedGenres: string[],
  recommendations: GenreRecommendation[],
  popularByGenre: RowMovie[][],
  { maxRows = MAX_GENRE_ROWS, rowSize = GENRE_ROW_SIZE } = {}
): { genre: string; movies: RowMovie[] }[] {
  const recommendedIds = new Set(recommendations.map((r) => r.movie.id));
  const usedFillerIds = new Set<string>();
  const rows: { genre: string; movies: RowMovie[] }[] = [];

  selectedGenres.slice(0, maxRows).forEach((genre, i) => {
    const picks = recommendations
      .filter((r) => r.movie.genres?.includes(genre))
      .map((r) => ({ ...r.movie, recommendationId: r.id }));

    const fillers = (popularByGenre[i] ?? []).filter(
      (m) => !recommendedIds.has(m.id) && !usedFillerIds.has(m.id)
    );

    const movies = [...picks, ...fillers].slice(0, rowSize);
    for (const m of movies) {
      if (!recommendedIds.has(m.id)) usedFillerIds.add(m.id);
    }

    if (movies.length >= MIN_ROW_SIZE) rows.push({ genre, movies });
  });

  return rows;
}
