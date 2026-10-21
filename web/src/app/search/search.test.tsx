import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchPage from "./page";

// The nav fetches the session and uses routing; it isn't what's under test here.
jest.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));

const mockFetch = jest.fn();

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const KOREAN_MOVIE = { id: "parasite", title: "Parasite", year: 2019, poster_url: null };
const ENGLISH_MOVIE = { id: "matrix", title: "The Matrix", year: 1999, poster_url: null };

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockImplementation(async (url: string) => {
    if (url === "/api/movies/genres") return jsonResponse(["Drama", "Thriller"]);
    if (url === "/api/movies/languages") {
      // API order is by count; the page shows names alphabetically and skips "zz".
      return jsonResponse([
        { code: "en", count: 9069 },
        { code: "fr", count: 350 },
        { code: "ko", count: 46 },
        { code: "zz", count: 9 },
      ]);
    }
    if (url.startsWith("/api/movies?")) {
      const isKorean = new URLSearchParams(url.split("?")[1]).get("language") === "ko";
      const results = isKorean ? [KOREAN_MOVIE] : [ENGLISH_MOVIE, KOREAN_MOVIE];
      return jsonResponse({ results, total: results.length });
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
});

describe("Search page language filter", () => {
  it("lists languages by name, alphabetically, after 'All languages', skipping unknown codes", async () => {
    render(<SearchPage />);

    const select = screen.getByLabelText("Language");
    await screen.findByRole("option", { name: "Korean" });

    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["All languages", "English", "French", "Korean"]);
  });

  it("filters results by the chosen language", async () => {
    const user = userEvent.setup();
    render(<SearchPage />);
    await screen.findByRole("option", { name: "Korean" });

    await user.selectOptions(screen.getByLabelText("Language"), "ko");

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("language=ko"))
    );
    expect(await screen.findByText("1 results")).toBeInTheDocument();
    // Each movie card is one link (a card without a poster shows its title twice).
    const resultLinks = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(resultLinks).toEqual(["/movies/parasite"]);
  });
});


describe("Search page filter lists", () => {
  it("survives the lists failing at first, then fills them in without a reload", async () => {
    jest.useFakeTimers();
    try {
      let listCalls = 0;
      mockFetch.mockImplementation(async (url: string) => {
        if (url === "/api/movies/genres" || url === "/api/movies/languages") {
          listCalls += 1;
          // The first attempt for each list fails, like a backend still waking up.
          if (listCalls <= 2) {
            return { ok: false, status: 504, json: async () => ({ detail: "Gateway timeout" }) };
          }
          return jsonResponse(url.endsWith("genres") ? ["Drama"] : [{ code: "ko", count: 46 }]);
        }
        if (url.startsWith("/api/movies?")) return jsonResponse({ results: [], total: 0 });
        throw new Error(`Unexpected fetch in test: ${url}`);
      });

      render(<SearchPage />);
      await act(async () => {
        await Promise.resolve();
      });

      // First attempts failed: no crash, just the "All" options.
      expect(screen.getByRole("option", { name: "All genres" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Korean" })).not.toBeInTheDocument();

      // The first retry (after 3 s) succeeds.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(await screen.findByRole("option", { name: "Korean" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Drama" })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
