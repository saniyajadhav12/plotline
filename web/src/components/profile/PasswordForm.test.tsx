import { fireEvent, render, screen } from "@testing-library/react";
import { PasswordForm } from "./PasswordForm";

function mockFetchResponse(ok: boolean, status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
}

beforeEach(() => {
  mockFetchResponse(true, 200, { message: "ok" });
});

describe("PasswordForm", () => {
  it("asks for the current password before sending anything", async () => {
    render(<PasswordForm />);
    fill("", "newpassword456", "newpassword456");
    submit();
    expect(await screen.findByText("Enter your current password.")).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a new password shorter than 8 characters", async () => {
    render(<PasswordForm />);
    fill("oldpassword123", "short", "short");
    submit();
    expect(await screen.findByText("Use at least 8 characters.")).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a confirmation that doesn't match", async () => {
    render(<PasswordForm />);
    fill("oldpassword123", "newpassword456", "newpassword789");
    submit();
    expect(await screen.findByText("Passwords don't match.")).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a new password that equals the current one", async () => {
    render(<PasswordForm />);
    fill("samepassword1", "samepassword1", "samepassword1");
    submit();
    expect(
      await screen.findByText("New password must be different from your current password.")
    ).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends the change, confirms success and clears the fields", async () => {
    render(<PasswordForm />);
    fill("oldpassword123", "newpassword456", "newpassword456");
    submit();
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("Password updated.")).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith("/api/users/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: "oldpassword123", new_password: "newpassword456" }),
    });
    for (const label of ["Current password", "New password", "Confirm new password"]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    }
  });

  it("shows the backend's message when the current password is wrong", async () => {
    mockFetchResponse(false, 400, { detail: "Current password is incorrect" });
    render(<PasswordForm />);
    fill("wrongpassword", "newpassword456", "newpassword456");
    submit();
    expect(await screen.findByText("Current password is incorrect")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("turns a 422 validation list into a readable message", async () => {
    mockFetchResponse(false, 422, {
      detail: [{ type: "string_too_short", loc: ["body", "new_password"], msg: "String should have at least 8 characters" }],
    });
    render(<PasswordForm />);
    fill("oldpassword123", "newpassword456", "newpassword456");
    submit();
    expect(
      await screen.findByText("new_password: String should have at least 8 characters")
    ).toBeTruthy();
  });

  it("shows a friendly message on a network failure", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    render(<PasswordForm />);
    fill("oldpassword123", "newpassword456", "newpassword456");
    submit();
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
  });
});

describe("PasswordForm after a successful change", () => {
  it("hides every password again", async () => {
    render(<PasswordForm />);
    fill("oldpassword123", "newpassword456", "newpassword456");
    for (const button of screen.getAllByRole("button", { name: "Show password" })) {
      fireEvent.click(button);
    }
    expect((screen.getByLabelText("New password") as HTMLInputElement).type).toBe("text");

    submit();
    await screen.findByRole("status");
    for (const label of ["Current password", "New password", "Confirm new password"]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).type).toBe("password");
    }
  });
});
