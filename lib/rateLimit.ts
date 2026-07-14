/**
 * In-memory per-key rate limiter.
 *
 * Single-process by design — perfect for the single Docker container this
 * dashboard runs in. If you ever scale to multiple replicas, replace the
 * `Map` with Redis (the interface stays the same).
 *
 * Strategy: sliding window of request timestamps per key. We sweep stale
 * entries opportunistically on each call, so memory stays bounded even
 * without a background timer.
 */

export interface RateLimitOptions {
  /** Number of requests allowed per `windowMs`. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the oldest hit drops out of the window. */
  resetAt: number;
  /** Seconds the caller should wait before retrying when `!ok`. */
  retryAfterSec: number;
}

const buckets = new Map<string, number[]>();

/** Drop timestamps older than the window so the Map cannot grow unbounded. */
function prune(now: number, windowMs: number, hits: number[]): number[] {
  const cutoff = now - windowMs;
  let i = 0;
  while (i < hits.length && hits[i] <= cutoff) i++;
  return i === 0 ? hits : hits.slice(i);
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const fresh = prune(now, windowMs, buckets.get(key) ?? []);

  if (fresh.length >= limit) {
    const oldest = fresh[0];
    const resetAt = oldest + windowMs;
    buckets.set(key, fresh);
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt,
      retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  fresh.push(now);
  buckets.set(key, fresh);

  return {
    ok: true,
    limit,
    remaining: limit - fresh.length,
    resetAt: now + windowMs,
    retryAfterSec: 0,
  };
}

/** Test helper — clears all buckets. Not exported in API responses. */
export function _resetRateLimit() {
  buckets.clear();
}
