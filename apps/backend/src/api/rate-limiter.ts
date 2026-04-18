import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Sliding-window rate limiter with Redis (prod) + in-memory (dev) backends.
 *
 * Auto-detects the backend:
 *   - If REDIS_URL is set → uses ioredis sorted-set sliding window (shared
 *     across all backend instances — safe for horizontal scaling).
 *   - Otherwise → falls back to the original in-memory implementation
 *     (single-instance dev use only).
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

// ── Redis client (lazy-initialized, module-level singleton) ──────────────────

let redisClient: any = null
let redisAvailable = false

async function getRedisClient(): Promise<any | null> {
  if (redisClient) return redisClient

  const url = process.env.REDIS_URL
  if (!url) return null

  try {
    // ioredis is a Medusa transitive dependency — available at runtime.
    // @ts-ignore — no direct type declarations; resolved via Medusa's ioredis
    const ioredis = await import("ioredis")
    const Redis: any = (ioredis as any).default ?? ioredis

    redisClient = new Redis(url, {
      // Don't let the rate-limiter connection block process exit
      lazyConnect: false,
      enableOfflineQueue: false,
      // Suppress noisy connection-retry logs in dev
      reconnectOnError: () => false,
      retryStrategy: () => null,
    })

    redisClient.on("error", () => {
      redisAvailable = false
    })

    redisClient.on("ready", () => {
      redisAvailable = true
    })

    // Wait for the initial connection (or catch immediately on failure)
    await redisClient.ping()
    redisAvailable = true

    return redisClient
  } catch (err) {
    console.warn(`[rate-limiter] Redis unavailable, falling back to in-memory: ${(err as Error).message}`)
    redisClient = null
    return null
  }
}

// Kick off the Redis connection at module load — non-blocking.
// Errors are already logged inside getRedisClient; in-memory fallback takes over.
getRedisClient().catch(() => {})

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns Express-compatible async middleware that enforces a sliding-window
 * rate limit per key.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator } = options

  // ── In-memory fallback store ─────────────────────────────────────────────
  const buckets = new Map<string, BucketEntry>()

  // Periodic GC — prevents unbounded map growth in long-running processes
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

  // ── Middleware ────────────────────────────────────────────────────────────
  return async function rateLimiterMiddleware(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction,
  ) {
    const clientKey = keyGenerator(req)
    const redisKey = `rl:${req.path}:${clientKey}`
    const now = Date.now()
    const windowStart = now - windowMs

    // ── Redis path ──────────────────────────────────────────────────────────
    if (redisAvailable && redisClient) {
      try {
        // Remove timestamps that have expired out of the window
        await redisClient.zremrangebyscore(redisKey, 0, windowStart)

        const count: number = await redisClient.zcard(redisKey)

        if (count >= maxRequests) {
          // Determine how long until the oldest request ages out
          const oldest = await redisClient.zrange(redisKey, 0, 0, "WITHSCORES")
          const oldestScore = oldest.length >= 2 ? Number(oldest[1]) : now - windowMs
          const retryAfterSec = Math.ceil((oldestScore + windowMs - now) / 1000)

          res.setHeader("Retry-After", String(retryAfterSec))
          res.status(429).json({
            message: "Too many requests. Please try again later.",
            retryAfter: retryAfterSec,
          })
          return
        }

        // Add this request as a scored member (score = timestamp, value unique)
        await redisClient.zadd(redisKey, now, `${now}:${Math.random()}`)
        // Key auto-expires after the window so Redis memory stays bounded
        await redisClient.expire(redisKey, Math.ceil(windowMs / 1000))

        return next()
      } catch {
        // Redis error — fall through to in-memory path silently
      }
    }

    // ── In-memory fallback path ─────────────────────────────────────────────
    let entry = buckets.get(clientKey)
    if (!entry) {
      entry = { timestamps: [] }
      buckets.set(clientKey, entry)
    }

    // Slide the window — discard timestamps older than windowStart
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
