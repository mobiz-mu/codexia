import "server-only";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

// In-memory sliding window, keyed by IP + action. This is a best-effort,
// single-instance guard against form spam/abuse — it does not persist across
// serverless cold starts or coordinate across multiple instances. If this
// project moves to a multi-instance deployment, replace with a shared store
// (Upstash Redis / Vercel KV).
const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 5000;

function pruneIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

/**
 * Returns { ok: true } if the action is allowed, or { ok: false } if the
 * caller has exceeded `limit` calls within `windowMs` for this action+ip.
 */
export async function checkRateLimit(
  action: string,
  options: { limit: number; windowMs: number }
): Promise<{ ok: boolean }> {
  const ip = await getClientIp();
  const key = `${action}:${ip}`;
  const now = Date.now();

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    pruneIfNeeded();
    return { ok: true };
  }

  if (existing.count >= options.limit) {
    return { ok: false };
  }

  existing.count += 1;
  return { ok: true };
}
