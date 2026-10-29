import { render, screen } from "@testing-library/react";
import { TopNav } from "./TopNav";

const mockRouter = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };

jest.mock("next/navigation", () => ({
  usePathname: () => "/onboarding",
  useRouter: () => mockRouter,
}));

jest.mock("@/components/theme/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Toggle theme</button>,
}));

const pageLinks = ["Home", "Search", "Watchlist", "Profile"];

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ name: "Sam" }),
  }) as unknown as typeof fetch;
});

describe("TopNav", () => {
  it("shows every page link by default", async () => {
    render(<TopNav />);
    await screen.findByText("Hi, Sam");
    for (const label of pageLinks) {
      expect(screen.getByRole("link", { name: label })).toBeTruthy();
    }
  });

  it("hides the page links when minimal, but keeps the logo and Sign out", async () => {
    render(<TopNav minimal />);
    await screen.findByText("Hi, Sam");
    for (const label of pageLinks) {
      expect(screen.queryByRole("link", { name: label })).toBeNull();
    }
    expect(screen.getByRole("link", { name: "Plotline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("still checks the session when minimal", async () => {
    render(<TopNav minimal />);
    await screen.findByText("Hi, Sam");
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/me", { cache: "no-store" });
  });
});
