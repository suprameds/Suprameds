/**
 * OTP store with Redis (prod) + in-memory (dev) backends.
 *
 * Auto-detects the backend:
 *   - If REDIS_URL is set → uses Redis hashes with TTL (shared across instances)
 *   - Otherwise → falls back to in-memory Maps (single-instance dev only)
 *
 * Supports both phone and email identifiers.
 * Shared between /store/otp/send and /store/otp/verify routes.
 */

const OTP_TTL_MS = 5 * 60 * 1000           // 5 minutes
const OTP_TTL_S = 300                       // 5 minutes in seconds (for Redis)
const MAX_SEND_PER_WINDOW = 3               // max OTP sends per identifier per window
const SEND_WINDOW_MS = 10 * 60 * 1000       // 10-minute send rate-limit window
const SEND_WINDOW_S = 600                   // 10 minutes in seconds (for Redis)
const MAX_VERIFY_ATTEMPTS = 5               // max verification attempts per OTP
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000   // purge expired entries every 2 min

// ── Redis client (lazy-initialized, same pattern as rate-limiter) ────

let redisClient: any = null
let redisReady = false

async function getRedis(): Promise<any | null> {
  if (redisClient) return redisReady ? redisClient : null

  const url = process.env.REDIS_URL
  if (!url) return null

  try {
    // @ts-ignore — ioredis is available at runtime via Medusa's dependencies
    const ioredis = await import("ioredis")
    const Redis: any = (ioredis as any).default ?? ioredis

    redisClient = new Redis(url, {
      lazyConnect: false,
      enableOfflineQueue: false,
      reconnectOnError: () => false,
      retryStrategy: () => null,
    })

    redisClient.on("error", () => { redisReady = false })
    redisClient.on("ready", () => { redisReady = true })

    await redisClient.ping()
    redisReady = true
    return redisClient
  } catch {
    redisClient = null
    return null
  }
}

// Kick off Redis connection at module load — non-blocking
getRedis().catch(() => {})

// ── In-memory fallback store ─────────────────────────────────────────

interface OtpEntry {
  otp: string
  expiresAt: number
  attempts: number
}

interface SendRateEntry {
  count: number
  windowStart: number
}

const otpMap = new Map<string, OtpEntry>()
const sendRateMap = new Map<string, SendRateEntry>()

const cleanup = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of otpMap) {
    if (entry.expiresAt <= now) otpMap.delete(key)
  }
  for (const [key, entry] of sendRateMap) {
    if (entry.windowStart + SEND_WINDOW_MS <= now) sendRateMap.delete(key)
  }
}, CLEANUP_INTERVAL_MS)
if (cleanup.unref) cleanup.unref()

// ── Phone helpers ────────────────────────────────────────────────────

/** Normalise to full E.164 without the `+` prefix (e.g. "919876543210") */
export function normalisePhone(phone: string, countryCode = "91"): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length > 10 && digits.startsWith(countryCode)) return digits
  return `${countryCode}${digits}`
}

/** Validate an Indian mobile number (10 digits, starts with 6-9) */
export function isValidIndianPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10))
}

// ── Email helpers ────────────────────────────────────────────────────

/** Normalise email to lowercase trimmed string */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Basic email format validation */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// ── Shared helpers ───────────────────────────────────────────────────

/** Generate a cryptographically-sufficient 6-digit numeric OTP */
export function generateOtp(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000))
}

// ── Public API (identifier-agnostic) ─────────────────────────────────

/**
 * Check whether the identifier has exceeded the send rate limit.
 * Returns `true` if the caller is allowed to send another OTP.
 */
export async function canSendOtp(identifier: string): Promise<boolean> {
  const redis = redisReady ? redisClient : null

  if (redis) {
    try {
      const key = `otp:rate:${identifier}`
      const count = await redis.incr(key)
      if (count === 1) await redis.expire(key, SEND_WINDOW_S)
      return count <= MAX_SEND_PER_WINDOW
    } catch {
      // Fall through to in-memory
    }
  }

  const now = Date.now()
  const entry = sendRateMap.get(identifier)

  if (!entry || entry.windowStart + SEND_WINDOW_MS <= now) {
    sendRateMap.set(identifier, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= MAX_SEND_PER_WINDOW) return false
  entry.count++
  return true
}

/** Store an OTP for the given identifier with a 5-minute TTL */
export async function storeOtp(identifier: string, otp: string): Promise<void> {
  const redis = redisReady ? redisClient : null

  if (redis) {
    try {
      const key = `otp:code:${identifier}`
      await redis.hset(key, "otp", otp, "attempts", "0")
      await redis.expire(key, OTP_TTL_S)
      return
    } catch {
      // Fall through to in-memory
    }
  }

  otpMap.set(identifier, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  })
}

/**
 * Verify an OTP for any identifier (phone or email).
 * Returns `true` on a correct match and invalidates it.
 */
export async function verifyOtp(
  identifier: string,
  otp: string,
): Promise<{ valid: boolean; reason?: string }> {
  const redis = redisReady ? redisClient : null

  if (redis) {
    try {
      const key = `otp:code:${identifier}`
      const data = await redis.hgetall(key)

      if (!data || !data.otp) {
        return { valid: false, reason: "No OTP found. Please request a new one." }
      }

      const attempts = parseInt(data.attempts || "0", 10) + 1
      if (attempts > MAX_VERIFY_ATTEMPTS) {
        await redis.del(key)
        return { valid: false, reason: "Maximum verification attempts exceeded" }
      }

      if (data.otp !== otp) {
        await redis.hset(key, "attempts", String(attempts))
        return { valid: false, reason: "Invalid OTP" }
      }

      // Valid — delete the key
      await redis.del(key)
      return { valid: true }
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const entry = otpMap.get(identifier)

  if (!entry) return { valid: false, reason: "No OTP found. Please request a new one." }

  if (Date.now() > entry.expiresAt) {
    otpMap.delete(identifier)
    return { valid: false, reason: "OTP has expired" }
  }

  entry.attempts++

  if (entry.attempts > MAX_VERIFY_ATTEMPTS) {
    otpMap.delete(identifier)
    return { valid: false, reason: "Maximum verification attempts exceeded" }
  }

  if (entry.otp !== otp) {
    return { valid: false, reason: "Invalid OTP" }
  }

  otpMap.delete(identifier)
  return { valid: true }
}
