import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "./page";

jest.mock("@/lib/useWarmUpBackend", () => ({ useWarmUpBackend: () => {} }));

const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe("Forgot password page", () => {
  it("sends the email and shows the same confirmation whether or not the account exists", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "If that email…" }) });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "ada@example.com" }) })
    );
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText(/expires in 1 hour/i)).toBeInTheDocument();
  });

  it("shows the server's error when the request is rejected", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 422, json: async () => ({ detail: "Enter a valid email." }) });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Enter a valid email.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
  });
});
