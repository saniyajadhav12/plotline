import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthShell } from "./AuthShell";

function renderShell() {
  render(
    <AuthShell title="Sign in" subtitle="Welcome back." footer={<span>Footer</span>}>
      <p>Form goes here</p>
    </AuthShell>
  );
}

describe("AuthShell", () => {
  it("shows the logo and the theme toggle in the header", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Plotline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change theme/i })).toBeInTheDocument();
  });

  it("opens the theme menu with Light, Dark and System", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: /change theme/i }));
    for (const label of ["Light", "Dark", "System"]) {
      expect(screen.getByRole("menuitemradio", { name: label })).toBeInTheDocument();
    }
  });

  it("still renders the title, subtitle, content and footer", () => {
    renderShell();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Welcome back.")).toBeInTheDocument();
    expect(screen.getByText("Form goes here")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });
});
