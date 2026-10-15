import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingForm } from "./OnboardingForm";

// --- next/navigation mock ---
const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, replace: jest.fn() }),
}));

// --- fetch mock: one fake "server" for the three endpoints the form uses ---
const mockFetch = jest.fn();

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const GENRES = ["Action", "Comedy", "Drama"];

type Movie = { id: string; title: string; year: number | null; poster_url: string | null };
const PARASITE: Movie = {
  id: "movie-parasite",
  title: "Parasite",
  year: 2019,
  poster_url: "https://image.tmdb.org/t/p/w500/parasite.jpg",
};
const ARRIVAL: Movie = { id: "movie-arrival", title: "Arrival", year: 2016, poster_url: null };

function mockApi({
  save = jsonResponse(200, { selected_genres: [], selected_movie_ids: [] }),
  searchResults = [ARRIVAL],
}: { save?: ReturnType<typeof jsonResponse> | Error; searchResults?: Movie[] } = {}) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url === "/api/movies/genres") return jsonResponse(200, GENRES);
    if (url.startsWith("/api/movies?")) return jsonResponse(200, { results: searchResults });
    if (url === "/api/onboarding") {
      if (save instanceof Error) throw save;
      return save;
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
}

/** Renders the form and waits until the genre list has loaded. */
async function renderForm(
  props: Partial<{ initialGenres: string[]; initialMovies: Movie[]; isFirstTime: boolean }> = {}
) {
  render(<OnboardingForm initialGenres={[]} initialMovies={[]} isFirstTime={true} {...props} />);
  await screen.findByRole("button", { name: GENRES[0] });
}

function savedPayload() {
  const call = mockFetch.mock.calls.find(([url]) => url === "/api/onboarding");
  if (!call) throw new Error("The form never called /api/onboarding");
  const [, options] = call;
  return { method: options.method, body: JSON.parse(options.body) };
}

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
  mockApi();
});

describe("OnboardingForm", () => {
  it("loads genres from the API and shows them as toggle buttons", async () => {
    await renderForm();

    expect(mockFetch).toHaveBeenCalledWith("/api/movies/genres");
    for (const genre of GENRES) {
      expect(screen.getByRole("button", { name: genre })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("starts with saved genres selected and toggles a genre on and off", async () => {
    const user = userEvent.setup();
    await renderForm({ initialGenres: ["Drama"] });

    expect(screen.getByRole("button", { name: "Drama" })).toHaveAttribute("aria-pressed", "true");

    const comedy = screen.getByRole("button", { name: "Comedy" });
    await user.click(comedy);
    expect(comedy).toHaveAttribute("aria-pressed", "true");
    await user.click(comedy);
    expect(comedy).toHaveAttribute("aria-pressed", "false");
  });

  it("searches movies as the user types and lets them pick one", async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.type(screen.getByPlaceholderText("Search movies…"), "arrival");

    const result = await screen.findByRole("button", { name: "Arrival" });
    expect(mockFetch).toHaveBeenCalledWith("/api/movies?q=arrival&page_size=12&sort=popularity");
    expect(result).toHaveAttribute("aria-pressed", "false");

    await user.click(result);
    expect(result).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Arrival" })).toBeInTheDocument();
  });

  it("first-time save: sends the selections, shows the loading overlay, and goes home", async () => {
    const user = userEvent.setup();
    await renderForm({ initialGenres: ["Drama"], initialMovies: [PARASITE], isFirstTime: true });

    await user.click(screen.getByRole("button", { name: "Comedy" }));
    await user.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(mockRefresh).toHaveBeenCalled();
    expect(savedPayload()).toEqual({
      method: "POST",
      body: { selected_genres: ["Drama", "Comedy"], selected_movie_ids: ["movie-parasite"] },
    });
    // The overlay stays up through the redirect, until the next page replaces this one.
    expect(screen.getByRole("status")).toHaveTextContent("Building your recommendations…");
  });

  it("editing from the profile: shows 'Updating…' and returns to /profile", async () => {
    const user = userEvent.setup();
    await renderForm({ initialGenres: ["Action"], isFirstTime: false });

    await user.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/profile"));
    expect(screen.getByRole("status")).toHaveTextContent("Updating your recommendations…");
  });

  it("server error: shows the message, removes the overlay, and re-enables saving", async () => {
    const user = userEvent.setup();
    mockApi({ save: jsonResponse(500, { detail: "Database unavailable" }) });
    await renderForm({ initialGenres: ["Action"] });

    await user.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Preferences" })).toBeEnabled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("network failure: shows a generic message and removes the overlay", async () => {
    const user = userEvent.setup();
    mockApi({ save: new TypeError("Failed to fetch") });
    await renderForm({ initialGenres: ["Action"] });

    await user.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
