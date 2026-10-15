import { render, screen } from "@testing-library/react";
import { MovieCard } from "./MovieCard";

const baseMovie = {
  id: "movie-123",
  title: "Parasite",
  year: 2019,
  poster_url: "https://image.tmdb.org/t/p/w500/parasite.jpg",
};

describe("MovieCard", () => {
  it("links to the movie's detail page", () => {
    render(<MovieCard {...baseMovie} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/movies/movie-123");
  });

  it("adds the recommendation id to the link, so the detail page can show 'Why this was recommended'", () => {
    render(<MovieCard {...baseMovie} recommendationId="rec-456" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/movies/movie-123?rec=rec-456");
  });

  it("shows the poster image, described by the movie title", () => {
    render(<MovieCard {...baseMovie} />);
    expect(screen.getByRole("img", { name: "Parasite" })).toBeInTheDocument();
  });

  it("shows a title placeholder instead of an image when there is no poster", () => {
    render(<MovieCard {...baseMovie} poster_url={null} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // Once in the placeholder box, once in the caption below it.
    expect(screen.getAllByText("Parasite")).toHaveLength(2);
  });

  it("shows the year when known, and never prints a missing year", () => {
    const { rerender } = render(<MovieCard {...baseMovie} />);
    expect(screen.getByText("2019")).toBeInTheDocument();

    rerender(<MovieCard {...baseMovie} year={null} />);
    expect(screen.queryByText("2019")).not.toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });
});
