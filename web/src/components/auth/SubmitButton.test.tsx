import { act, render, screen } from "@testing-library/react";
import { SLOW_REQUEST_MS, SubmitButton } from "./SubmitButton";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const WAKING = /waking up the server/i;

describe("SubmitButton", () => {
  it("shows its label and is enabled when idle", () => {
    render(<SubmitButton>Sign in</SubmitButton>);
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button).toBeEnabled();
  });

  it("shows 'Please wait…' until the slow threshold, then explains the server is waking up", () => {
    render(<SubmitButton loading>Sign in</SubmitButton>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Please wait…");

    act(() => jest.advanceTimersByTime(SLOW_REQUEST_MS - 1));
    expect(button).toHaveTextContent("Please wait…");

    act(() => jest.advanceTimersByTime(1));
    expect(button).toHaveTextContent(WAKING);
  });

  it("starts every new attempt fresh at 'Please wait…'", () => {
    const { rerender } = render(<SubmitButton loading>Sign in</SubmitButton>);
    act(() => jest.advanceTimersByTime(SLOW_REQUEST_MS));
    expect(screen.getByRole("button")).toHaveTextContent(WAKING);

    rerender(<SubmitButton loading={false}>Sign in</SubmitButton>);
    expect(screen.getByRole("button")).toHaveTextContent("Sign in");

    rerender(<SubmitButton loading>Sign in</SubmitButton>);
    expect(screen.getByRole("button")).toHaveTextContent("Please wait…");
  });

  it("never shows the waking message for a request that finishes quickly", () => {
    const { rerender } = render(<SubmitButton loading>Sign in</SubmitButton>);
    act(() => jest.advanceTimersByTime(1000));
    rerender(<SubmitButton loading={false}>Sign in</SubmitButton>);

    act(() => jest.advanceTimersByTime(SLOW_REQUEST_MS * 2));
    expect(screen.getByRole("button")).toHaveTextContent("Sign in");
    expect(screen.queryByText(WAKING)).not.toBeInTheDocument();
  });
});
