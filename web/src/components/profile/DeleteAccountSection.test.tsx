import { fireEvent, render, screen } from "@testing-library/react";
import { DeleteAccountSection } from "./DeleteAccountSection";

const mockReplace = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

function mockFetchResponse(ok: boolean, status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
}

function typePassword(value: string) {
  fireEvent.change(screen.getByLabelText("Password"), { target: { value } });
}

function confirmDelete() {
  fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchResponse(true, 200, { message: "Account deleted" });
});

describe("DeleteAccountSection", () => {
  it("only shows the confirmation dialog after the button is clicked", () => {
    render(<DeleteAccountSection />);
    expect(screen.queryByRole("dialog")).toBeNull();
    openDialog();
    expect(screen.getByRole("dialog", { name: "Delete your account?" })).toBeTruthy();
  });

  it("requires the password before sending anything", async () => {
    render(<DeleteAccountSection />);
    openDialog();
    confirmDelete();
    expect(await screen.findByText("Enter your password to confirm.")).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("deletes the account and goes to the login page", async () => {
    render(<DeleteAccountSection />);
    openDialog();
    typePassword("correctpass123");
    confirmDelete();
    expect(await screen.findByText("Deleting…")).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith("/api/users/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correctpass123" }),
    });
    await screen.findByText("Deleting…");
    expect(mockReplace).toHaveBeenCalledWith("/login?account_deleted=1");
  });

  it("shows the backend's message for a wrong password and keeps the dialog open", async () => {
    mockFetchResponse(false, 400, { detail: "Password is incorrect" });
    render(<DeleteAccountSection />);
    openDialog();
    typePassword("wrongpass123");
    confirmDelete();
    expect(await screen.findByText("Password is incorrect")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("Cancel closes the dialog and forgets the typed password", () => {
    render(<DeleteAccountSection />);
    openDialog();
    typePassword("correctpass123");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    openDialog();
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  });
});
