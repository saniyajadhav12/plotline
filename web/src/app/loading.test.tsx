import { act, render, screen } from "@testing-library/react";
import { SLOW_REQUEST_MS } from "@/components/auth/SubmitButton";
import Loading from "./loading";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("Page loading screen", () => {
  it("shows only a spinner at first, without the waking-up message", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Waking up the server…")).not.toBeInTheDocument();
  });

  it("explains the free-tier wake-up once loading becomes slow", () => {
    render(<Loading />);
    act(() => jest.advanceTimersByTime(SLOW_REQUEST_MS));

    expect(screen.getByText("Waking up the server…")).toBeInTheDocument();
    expect(screen.getByText(/free hosting that sleeps/i)).toBeInTheDocument();
  });
});
