import { act, render } from "@testing-library/react";
import { useWarmUpBackend } from "./useWarmUpBackend";

function Probe() {
  useWarmUpBackend();
  return null;
}

const mockFetch = jest.fn();

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe("useWarmUpBackend", () => {
  it("pings /api/health once when the page opens", () => {
    mockFetch.mockResolvedValue({ ok: true });
    render(<Probe />);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/health", { cache: "no-store" });
  });

  it("ignores a failed ping instead of breaking the page", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Probe />);

    // Let the rejected promise settle; an unhandled rejection would fail the test.
    await act(async () => {});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
