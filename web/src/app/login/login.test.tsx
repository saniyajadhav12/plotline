import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

// --- next/navigation mock: tests inspect redirects and set URL params ---
const mockPush = jest.fn();
const mockRefresh = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

// --- fetch mock: each test decides what the "server" returns ---
const mockFetch = jest.fn();

/** Minimal stand-in for a fetch Response (jsdom has no fetch/Response). */
function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  global.fetch = mockFetch as unknown as typeof fetch;
});

async function fillAndSubmit(email = "sue@example.com", password = "correct-horse") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("Login page", () => {
  it("does not show the session-expired banner on a normal visit", () => {
    render(<LoginPage />);
    expect(screen.queryByText(/your session expired/i)).not.toBeInTheDocument();
  });

  it("shows the session-expired banner when redirected with ?session_expired=1", () => {
    mockSearchParams = new URLSearchParams("session_expired=1");
    render(<LoginPage />);
    expect(screen.getByText("Your session expired. Please sign in again.")).toBeInTheDocument();
  });

  it("posts the credentials to /api/auth/login and redirects home on success", async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { message: "Logged in" }));
    render(<LoginPage />);

    await fillAndSubmit();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ email: "sue@example.com", password: "correct-horse" });
  });

  it("disables the button and shows 'Please wait…' while the request is in flight", async () => {
    let resolveLogin: (value: unknown) => void = () => {};
    mockFetch.mockReturnValue(new Promise((resolve) => (resolveLogin = resolve)));
    render(<LoginPage />);

    await fillAndSubmit();

    const button = screen.getByRole("button", { name: "Please wait…" });
    expect(button).toBeDisabled();

    resolveLogin(jsonResponse(200, { message: "Logged in" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  it("shows the backend's message on a wrong password, without redirecting", async () => {
    mockFetch.mockResolvedValue(jsonResponse(401, { detail: "Incorrect email or password" }));
    render(<LoginPage />);

    await fillAndSubmit("sue@example.com", "wrong-password");

    expect(await screen.findByText("Incorrect email or password")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("shows FastAPI validation errors in a readable form", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(422, {
        detail: [{ type: "value_error", loc: ["body", "email"], msg: "value is not a valid email address" }],
      })
    );
    render(<LoginPage />);

    await fillAndSubmit();

    expect(await screen.findByText("email: value is not a valid email address")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows a generic message when the network request fails", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginPage />);

    await fillAndSubmit();

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
