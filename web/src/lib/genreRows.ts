export type RowMovie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  genres?: string[] | null;
};

export const MAX_GENRE_ROWS = 4;
export const GENRE_ROW_SIZE = 20;
/** Popular movies fetched per genre. Larger than a row, because overlapping genres
 *  (e.g. Action / Adventure / Fantasy) share many movies and each one is used once. */
export const GENRE_POOL_SIZE = 100;
const MIN_ROW_SIZE = 2;

/**
 * Builds the home page's "Because you like <genre>" rows from the genres the user
 * selected. Nothing repeats anywhere on the page: a row only uses movies that are
 * not already shown (the hero and "Recommended for You"), and every movie it uses
 * is added to `shownIds`, so later rows (and "Trending Now") skip it too.
 *
 * popularByGenre[i] holds the popular movies for selectedGenres[i], most popular first.
 * `shownIds` is updated in place.
 */
export function buildGenreRows(
  selectedGenres: string[],
  shownIds: Set<string>,
  popularByGenre: RowMovie[][],
  { maxRows = MAX_GENRE_ROWS, rowSize = GENRE_ROW_SIZE } = {}
): { genre: string; movies: RowMovie[] }[] {
  const rows: { genre: string; movies: RowMovie[] }[] = [];

  selectedGenres.slice(0, maxRows).forEach((genre, i) => {
    const movies = withoutShown(popularByGenre[i] ?? [], shownIds).slice(0, rowSize);
    if (movies.length < MIN_ROW_SIZE) return;
    for (const m of movies) shownIds.add(m.id);
    rows.push({ genre, movies });
  });

  return rows;
}

/** Movies not already shown on the page, in their original order. */
export function withoutShown<T extends { id: string }>(movies: T[], shownIds: Set<string>): T[] {
  return movies.filter((m) => !shownIds.has(m.id));
}
