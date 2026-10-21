/** Waits before each retry; ~45 s in total, enough for a free-tier backend to wake up. */
export const RETRY_DELAYS_MS = [3000, 6000, 12000, 24000];

/** Resolves after `ms`, or immediately if `signal` is aborted. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

/**
 * Fetches a JSON list (e.g. genres or languages), retrying on failure. A response
 * only counts as success if it is OK *and* a list, so an error body like
 * {"detail": ...} is never handed to a component expecting an array. Returns []
 * after all attempts fail, or as soon as `signal` is aborted (the page was left).
 */
export async function fetchListWithRetry<T>(
  url: string,
  { delays = RETRY_DELAYS_MS, signal }: { delays?: number[]; signal?: AbortSignal } = {}
): Promise<T[]> {
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (signal?.aborted) return [];
    try {
      const res = await fetch(url, { signal, cache: "no-store" });
      if (res.ok) {
        const data: unknown = await res.json();
        if (Array.isArray(data)) return data as T[];
      }
    } catch {
      // Network error, or the request was aborted: retry (or stop, below).
    }
    if (signal?.aborted) return [];
    if (attempt < delays.length) await wait(delays[attempt], signal);
  }
  return [];
}
