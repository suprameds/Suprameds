import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * In-memory sliding-window rate limiter for sensitive endpoints.
 *
 * Tracks request timestamps per key (IP by default) and rejects requests
 * that exceed the configured threshold within the sliding window.
 *
 * NOT suitable for multi-instance deployments — swap to Redis-based
 * counting when horizontal scaling is required.
 */

interface RateLimiterOptions {
  /** Window duration in milliseconds */
  windowMs: number
  /** Maximum allowed requests within the window */
  maxRequests: number
  /** Derive the bucket key from the request (defaults to IP address) */
  keyGenerator?: (req: MedusaRequest) => string
}

interface BucketEntry {
  timestamps: number[]
}

const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Extract the client IP from the request, respecting `X-Forwarded-For`
 * behind reverse proxies.
 */
function defaultKeyGenerator(req: MedusaRequest): string {
  const forwarded = req.headers["x-forwarded-for"]
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim()
  if (Array.isArray(forwarded)) return forwarded[0]
  return req.ip ?? "unknown"
}

/**
 * Factory: returns Express-compatible middleware that enforces a
 * sliding-window rate limit per key.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator } = options

  const buckets = new Map<string, BucketEntry>()

  // Periodic garbage collection — remove entries whose newest timestamp
  // is older than the window so the map doesn't grow unbounded.
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of buckets) {
      if (entry.timestamps.length === 0 || entry.timestamps.at(-1)! < now - windowMs) {
        buckets.delete(key)
      }
    }
  }, DEFAULT_CLEANUP_INTERVAL_MS)

  // Allow the Node process to exit without waiting for the timer
  if (cleanupInterval.unref) cleanupInterval.unref()

  return function rateLimiterMiddleware(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction,
  ) {
    const key = keyGenerator(req)
    const now = Date.now()
    const windowStart = now - windowMs

    let entry = buckets.get(key)
    if (!entry) {
      entry = { timestamps: [] }
      buckets.set(key, entry)
    }

    // Slide the window — drop timestamps older than windowStart
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart)

    if (entry.timestamps.length >= maxRequests) {
      const oldestInWindow = entry.timestamps[0]
      const retryAfterMs = oldestInWindow + windowMs - now
      const retryAfterSec = Math.ceil(retryAfterMs / 1000)

      res.setHeader("Retry-After", String(retryAfterSec))
      res.status(429).json({
        message: "Too many requests. Please try again later.",
        retryAfter: retryAfterSec,
      })
      return
    }

    entry.timestamps.push(now)
    next()
  }
}
