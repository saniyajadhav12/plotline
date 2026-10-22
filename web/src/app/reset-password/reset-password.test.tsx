import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResetPasswordPage from "./page";

jest.mock("@/lib/useWarmUpBackend", () => ({ useWarmUpBackend: () => {} }));

let mockQuery = "token=abc123";
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
}));

type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
const respond = (status: number, body: unknown): FakeResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const mockFetch = jest.fn();
let validateResponse: FakeResponse | Error;
let resetResponse: FakeResponse;

beforeEach(() => {
  mockQuery = "token=abc123";
  validateResponse = respond(200, { valid: true });
  resetResponse = respond(200, { message: "ok" });
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/auth/reset-password/validate")) {
      if (validateResponse instanceof Error) throw validateResponse;
      return validateResponse;
    }
    if (url === "/api/auth/reset-password") return resetResponse;
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  global.fetch = mockFetch as unknown as typeof fetch;
});

const resetCalls = () => mockFetch.mock.calls.filter(([url]) => url === "/api/auth/reset-password");

async function fillAndSubmit(password: string, confirm: string) {
  const user = userEvent.setup();
  render(<ResetPasswordPage />);
  await user.type(await screen.findByLabelText("New password"), password);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Reset password" }));
}

describe("Reset password page", () => {
  it("catches mismatched passwords without calling the server", async () => {
    await fillAndSubmit("newpassword1", "different1");

    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    expect(resetCalls()).toHaveLength(0);
  });

  it("catches a too-short password without calling the server", async () => {
    await fillAndSubmit("short", "short");

    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(resetCalls()).toHaveLength(0);
  });

  it("sends the token and new password, then offers to sign in", async () => {
    await fillAndSubmit("brandnew456", "brandnew456");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/reset-password",
      expect.objectContaining({ body: JSON.stringify({ token: "abc123", new_password: "brandnew456" }) })
    );
    expect(await screen.findByRole("heading", { name: "Password reset" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("switches to the expired view if the link stops working before submit", async () => {
    resetResponse = respond(400, { detail: "Invalid or expired reset token" });
    await fillAndSubmit("brandnew456", "brandnew456");

    expect(await screen.findByRole("heading", { name: "This link has expired" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("says up front when the link is used or expired, with no form", async () => {
    validateResponse = respond(200, { valid: false });
    render(<ResetPasswordPage />);

    expect(await screen.findByRole("heading", { name: "This link has expired" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset password" })).not.toBeInTheDocument();
  });

  it("still shows the form when the link can't be checked", async () => {
    validateResponse = new Error("network down");
    render(<ResetPasswordPage />);

    expect(await screen.findByRole("button", { name: "Reset password" })).toBeInTheDocument();
  });

  it("shows no form when the link has no token", async () => {
    mockQuery = "";
    render(<ResetPasswordPage />);

    expect(await screen.findByRole("heading", { name: "Reset link incomplete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset password" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
  });
});
