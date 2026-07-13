import "server-only";

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Passed as the `global.fetch` option to every Supabase client in this app.
 * Without this, a stalled connection to Supabase (e.g. during static
 * generation, or a cold Postgres connection) can hang a request — or an
 * entire `next build` — indefinitely. Aborting after a fixed timeout turns
 * that into a normal, catchable error instead.
 */
export function fetchWithTimeout(timeoutMs = DEFAULT_TIMEOUT_MS): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Supabase request timed out after ${timeoutMs}ms`)), timeoutMs);

    return fetch(input, { ...init, signal: init?.signal ?? controller.signal }).finally(() => clearTimeout(timer));
  };
}
