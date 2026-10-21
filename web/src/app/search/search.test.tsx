import { render, screen, waitFor } from "@testing-library/react";
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
