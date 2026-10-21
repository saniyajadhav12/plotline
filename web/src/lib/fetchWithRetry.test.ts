import { fetchListWithRetry, RETRY_DELAYS_MS } from "./fetchWithRetry";

const mockFetch = jest.fn();

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const failed = (status = 504) => ({ ok: false, status, json: async () => ({ detail: "Gateway timeout" }) });

// Tiny delays keep these tests instant; the real delays are checked separately.
const FAST = { delays: [1, 1] };

describe("fetchListWithRetry", () => {
  it("returns the list from the first successful response", async () => {
    mockFetch.mockResolvedValueOnce(ok(["Drama", "Thriller"]));

    await expect(fetchListWithRetry("/api/movies/genres", FAST)).resolves.toEqual(["Drama", "Thriller"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries after a network error", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(ok(["Drama"]));

    await expect(fetchListWithRetry("/api/movies/genres", FAST)).resolves.toEqual(["Drama"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("treats error responses and non-list bodies as failures", async () => {
    mockFetch
      .mockResolvedValueOnce(failed(500))
      .mockResolvedValueOnce(ok({ detail: "Something went wrong" })) // OK status, but not a list
      .mockResolvedValueOnce(ok(["Drama"]));

    await expect(fetchListWithRetry("/api/movies/genres", FAST)).resolves.toEqual(["Drama"]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("gives up with an empty list after every attempt fails", async () => {
    mockFetch.mockResolvedValue(failed());

    await expect(fetchListWithRetry("/api/movies/genres", FAST)).resolves.toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(3); // first try + 2 retries
  });

  it("stops retrying as soon as it is aborted", async () => {
    mockFetch.mockResolvedValue(failed());
    const controller = new AbortController();

    const result = fetchListWithRetry("/api/movies/genres", { delays: [60_000], signal: controller.signal });
    controller.abort();

    await expect(result).resolves.toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("waits about 45 seconds in total by default, enough for a cold start", () => {
    expect(RETRY_DELAYS_MS.reduce((total, ms) => total + ms, 0)).toBe(45_000);
  });
});
