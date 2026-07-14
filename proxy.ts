import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Edge proxy for the public /api/v1/* surface. (Next 16 renamed the old
 * `middleware` file convention to `proxy`.)
 *
 *  - Enforces GET / OPTIONS only.
 *  - Adds permissive CORS headers (public, read-only data).
 *  - Per-IP rate limit (60 req/min, burst handled by sliding window).
 *  - Encourages downstream caching via Cache-Control.
 */

const RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
};

function clientKey(req: NextRequest): string {
  // Trust the first IP in X-Forwarded-For when present (set by your reverse
  // proxy). Falls back to a static key in environments where the header is
  // unavailable — that still keeps abuse from a single host bounded.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  const xreal = req.headers.get("x-real-ip");
  if (xreal) return xreal.trim();
  return "unknown";
}

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. CORS preflight.
  if (req.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }));
  }

  // 2. Public API surface is read-only.
  if (req.method !== "GET") {
    return withCors(
      NextResponse.json(
        { error: "Method not allowed. Public API accepts only GET." },
        { status: 405 }
      )
    );
  }

  // 3. Rate-limit per client IP.
  const key = `${clientKey(req)}:${pathname.startsWith("/api/v1") ? "v1" : "other"}`;
  const limit = rateLimit(key, {
    limit: RATE_LIMIT_PER_MINUTE,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!limit.ok) {
    const res = NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    res.headers.set("X-RateLimit-Limit", String(limit.limit));
    res.headers.set("X-RateLimit-Remaining", "0");
    res.headers.set("X-RateLimit-Reset", String(Math.floor(limit.resetAt / 1000)));
    return withCors(res);
  }

  // 4. Pass through, decorating the response with CORS, caching and rate
  //    headers. NextResponse.next() bubbles up to the route handler.
  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(limit.limit));
  res.headers.set("X-RateLimit-Remaining", String(limit.remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.floor(limit.resetAt / 1000)));
  res.headers.set("Cache-Control", "public, max-age=60");
  return withCors(res);
}

/** Only intercept the public API; internal /api/* keeps its existing behavior. */
export const config = {
  matcher: ["/api/v1/:path*"],
};
