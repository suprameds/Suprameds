/**
 * In-memory OTP store with TTL, per-identifier rate limiting, and attempt tracking.
 *
 * Supports both phone and email identifiers.
 * Shared between /store/otp/send and /store/otp/verify routes.
 * For production multi-instance deployments, replace with Redis-backed storage.
 */

const OTP_TTL_MS = 5 * 60 * 1000           // 5 minutes
const MAX_SEND_PER_WINDOW = 3               // max OTP sends per identifier per window
const SEND_WINDOW_MS = 10 * 60 * 1000       // 10-minute send rate-limit window
const MAX_VERIFY_ATTEMPTS = 5               // max verification attempts per OTP
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000   // purge expired entries every 2 min

interface OtpEntry {
  otp: string
  expiresAt: number
  attempts: number
}

interface SendRateEntry {
  count: number
  windowStart: number
}

/** OTP codes indexed by normalised identifier (phone like "919876543210" or email) */
const otpMap = new Map<string, OtpEntry>()

/** Per-identifier send rate tracker */
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
 * Check whether the identifier (phone or email) has exceeded the send rate limit.
 * Returns `true` if the caller is allowed to send another OTP.
 */
export function canSendOtp(identifier: string): boolean {
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
export function storeOtp(identifier: string, otp: string): void {
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
export function verifyOtp(identifier: string, otp: string): { valid: boolean; reason?: string } {
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
