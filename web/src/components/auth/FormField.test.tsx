import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormField } from "./FormField";

/** FormField is controlled, so hold its value in state the way real forms do. */
function ControlledField(props: { label: string; type: string; error?: string }) {
  const [value, setValue] = useState("");
  return <FormField {...props} value={value} onChange={setValue} />;
}

describe("FormField", () => {
  it("links its label to the input, so the field can be found and typed into by label", async () => {
    const user = userEvent.setup();
    render(<ControlledField label="Email" type="email" />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");

    await user.type(input, "sue@example.com");
    expect(input).toHaveValue("sue@example.com");
  });

  it("toggles password visibility with the Show / Hide button", async () => {
    const user = userEvent.setup();
    render(<ControlledField label="Password" type="password" />);

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("shows an error message and attaches it to the input for screen readers", () => {
    render(<ControlledField label="Email" type="email" error="Enter a valid email" />);

    const input = screen.getByLabelText("Email");
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email");
  });

  it("does not render a Show / Hide button for non-password fields", () => {
    render(<ControlledField label="Email" type="email" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
