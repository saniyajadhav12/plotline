import { buildGenreRows, GENRE_ROW_SIZE, MAX_GENRE_ROWS, type RowMovie } from "./genreRows";

function movie(id: string, genres: string[]): RowMovie {
  return { id, title: id, year: 2020, poster_url: null, genres };
}

function rec(recId: string, m: RowMovie) {
  return { id: recId, movie: m };
}

const interstellar = movie("interstellar", ["Adventure", "Drama", "Science Fiction"]);
const departed = movie("departed", ["Crime", "Drama", "Thriller"]);
const prestige = movie("prestige", ["Drama", "Mystery", "Thriller"]);

describe("buildGenreRows", () => {
  it("makes one row per selected genre, in the user's order, and no others", () => {
    const rows = buildGenreRows(
      ["Action", "Drama"],
      [rec("r1", interstellar), rec("r2", departed)],
      [[movie("a1", ["Action"]), movie("a2", ["Action"])], [movie("d1", ["Drama"])]]
    );
    expect(rows.map((r) => r.genre)).toEqual(["Action", "Drama"]);
  });

  it("counts a recommendation for a genre anywhere in its genre list, not just first", () => {
    const rows = buildGenreRows(["Drama"], [rec("r1", interstellar), rec("r2", departed)], [[]]);
    // Interstellar lists Adventure first, but it is also a Drama.
    expect(rows[0].movies.map((m) => m.id)).toEqual(["interstellar", "departed"]);
  });

  it("puts recommendations first with their recommendation id, then popular fillers without one", () => {
    const rows = buildGenreRows(
      ["Thriller"],
      [rec("r9", prestige)],
      [[movie("t1", ["Thriller"]), movie("t2", ["Thriller"])]]
    );
    const [first, ...rest] = rows[0].movies;
    expect(first).toMatchObject({ id: "prestige", recommendationId: "r9" });
    expect(rest.map((m) => m.id)).toEqual(["t1", "t2"]);
    expect(rest.every((m) => m.recommendationId === undefined)).toBe(true);
  });

  it("skips fillers already recommended, and never repeats a filler across rows", () => {
    const actionThriller = movie("at", ["Action", "Thriller"]);
    const rows = buildGenreRows(
      ["Action", "Thriller"],
      [rec("r1", departed)],
      [
        [actionThriller, movie("a1", ["Action"])],
        [departed, actionThriller, movie("t1", ["Thriller"])],
      ]
    );
    expect(rows[0].movies.map((m) => m.id)).toEqual(["at", "a1"]);
    // departed: recommended (listed first as a pick, not repeated as a filler); "at": already used in Action
    expect(rows[1].movies.map((m) => m.id)).toEqual(["departed", "t1"]);
  });

  it("drops rows with fewer than 2 movies", () => {
    const rows = buildGenreRows(["Western", "Drama"], [], [[movie("w1", ["Western"])], [movie("d1", ["Drama"]), movie("d2", ["Drama"])]]);
    expect(rows.map((r) => r.genre)).toEqual(["Drama"]);
  });

  it("caps the number of rows and the movies per row", () => {
    const genres = ["A", "B", "C", "D", "E", "F"];
    const popular = genres.map((g) =>
      Array.from({ length: GENRE_ROW_SIZE + 5 }, (_, n) => movie(`${g}${n}`, [g]))
    );
    const rows = buildGenreRows(genres, [], popular);
    expect(rows).toHaveLength(MAX_GENRE_ROWS);
    expect(rows.every((r) => r.movies.length === GENRE_ROW_SIZE)).toBe(true);
  });
});
