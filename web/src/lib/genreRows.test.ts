import {
  buildGenreRows,
  GENRE_ROW_SIZE,
  MAX_GENRE_ROWS,
  withoutShown,
  type RowMovie,
} from "./genreRows";

function movie(id: string, genres: string[] = []): RowMovie {
  return { id, title: id, year: 2020, poster_url: null, genres };
}

function ids(movies: RowMovie[]) {
  return movies.map((m) => m.id);
}

describe("buildGenreRows", () => {
  it("makes one row per selected genre, in the user's order, and no others", () => {
    const rows = buildGenreRows(
      ["Action", "Drama"],
      new Set(),
      [[movie("a1"), movie("a2")], [movie("d1"), movie("d2")]]
    );
    expect(rows.map((r) => r.genre)).toEqual(["Action", "Drama"]);
  });

  it("never uses movies already shown on the page", () => {
    const shown = new Set(["recommended-1", "recommended-2"]);
    const rows = buildGenreRows(
      ["Action"],
      shown,
      [[movie("recommended-1"), movie("a1"), movie("recommended-2"), movie("a2")]]
    );
    expect(ids(rows[0].movies)).toEqual(["a1", "a2"]);
  });

  it("never repeats a movie across genre rows, and records what it used", () => {
    const shown = new Set<string>();
    const rows = buildGenreRows(
      ["Action", "Adventure"],
      shown,
      [
        [movie("lotr"), movie("hobbit"), movie("kong")],
        [movie("lotr"), movie("hobbit"), movie("pirates"), movie("librarian")],
      ]
    );
    expect(ids(rows[0].movies)).toEqual(["lotr", "hobbit", "kong"]);
    expect(ids(rows[1].movies)).toEqual(["pirates", "librarian"]);
    expect([...shown].sort()).toEqual(["hobbit", "kong", "librarian", "lotr", "pirates"]);
  });

  it("keeps every row full when the selected genres overlap heavily", () => {
    // Action, Adventure and Fantasy share the same 60 popular movies.
    const shared = Array.from({ length: 60 }, (_, n) => movie(`m${n}`));
    const rows = buildGenreRows(["Action", "Adventure", "Fantasy"], new Set(), [shared, shared, shared]);

    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.movies.length === GENRE_ROW_SIZE)).toBe(true);
    const all = rows.flatMap((r) => ids(r.movies));
    expect(new Set(all).size).toBe(all.length); // no repeats at all
  });

  it("drops rows with fewer than 2 new movies", () => {
    const rows = buildGenreRows(
      ["Western", "Drama"],
      new Set(),
      [[movie("w1")], [movie("d1"), movie("d2")]]
    );
    expect(rows.map((r) => r.genre)).toEqual(["Drama"]);
  });

  it("caps the number of rows and the movies per row", () => {
    const genres = ["A", "B", "C", "D", "E", "F"];
    const pools = genres.map((g) => Array.from({ length: GENRE_ROW_SIZE + 5 }, (_, n) => movie(`${g}${n}`)));
    const rows = buildGenreRows(genres, new Set(), pools);

    expect(rows).toHaveLength(MAX_GENRE_ROWS);
    expect(rows.every((r) => r.movies.length === GENRE_ROW_SIZE)).toBe(true);
  });
});

describe("withoutShown", () => {
  it("removes movies already shown and keeps the rest in order", () => {
    const trending = [movie("t1"), movie("shown"), movie("t2"), movie("t3")];
    expect(ids(withoutShown(trending, new Set(["shown", "t3"])))).toEqual(["t1", "t2"]);
  });
});
