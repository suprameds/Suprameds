/**
 * Enhanced Conversions — SHA-256 hashing of customer PII per Google Ads spec.
 *
 * Google requires lowercased, trimmed values hashed as hex SHA-256. Phone
 * numbers must be E.164 (leading `+`, country code, digits only) before
 * hashing. Email local parts are NOT gmail-dotted; we just trim and lowercase.
 *
 * Runs in the browser (Web Crypto) and is a no-op during SSR.
 *
 * Docs: https://support.google.com/google-ads/answer/13258081
 */

export interface UserDataInput {
  email?: string | null
  phone?: string | null
  first_name?: string | null
  last_name?: string | null
  /** ISO 3166-1 alpha-2 (e.g. "IN"). Used as fallback when normalizing phone numbers without country code. */
  country?: string | null
}

export interface HashedUserData {
  sha256_email_address?: string
  sha256_phone_number?: string
  sha256_first_name?: string
  sha256_last_name?: string
  address?: {
    sha256_first_name?: string
    sha256_last_name?: string
    country?: string
  }
}

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.subtle !== "undefined"
  )
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await window.crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Normalize a phone number to E.164 for hashing.
 * - Strips whitespace, dashes, parens.
 * - Adds India country code (+91) if it looks like a 10-digit Indian mobile and no country prefix is present.
 * - Otherwise passes through whatever the user provided (assumed already E.164).
 */
function normalizePhone(phone: string, defaultCountry: string | null | undefined): string {
  const cleaned = phone.replace(/[\s\-()]/g, "")
  if (cleaned.startsWith("+")) return cleaned
  const digits = cleaned.replace(/\D/g, "")
  if ((defaultCountry ?? "IN").toUpperCase() === "IN" && /^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`
  }
  if (digits.length >= 10) {
    return `+${digits}`
  }
  return cleaned
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Hash a user-data record per Google Ads Enhanced Conversions spec.
 * Returns only the fields for which non-empty input was provided.
 * Safe to call during SSR — returns an empty object when Web Crypto is unavailable.
 */
export async function hashUserData(input: UserDataInput): Promise<HashedUserData> {
  if (!isBrowser()) return {}
  const out: HashedUserData = {}

  if (input.email) {
    const email = normalizeEmail(input.email)
    if (email) out.sha256_email_address = await sha256Hex(email)
  }

  if (input.phone) {
    const phone = normalizePhone(input.phone, input.country)
    if (phone) out.sha256_phone_number = await sha256Hex(phone)
  }

  if (input.first_name) {
    const first = normalizeName(input.first_name)
    if (first) out.sha256_first_name = await sha256Hex(first)
  }

  if (input.last_name) {
    const last = normalizeName(input.last_name)
    if (last) out.sha256_last_name = await sha256Hex(last)
  }

  if (out.sha256_first_name || out.sha256_last_name || input.country) {
    out.address = {
      ...(out.sha256_first_name ? { sha256_first_name: out.sha256_first_name } : {}),
      ...(out.sha256_last_name ? { sha256_last_name: out.sha256_last_name } : {}),
      ...(input.country ? { country: input.country.toUpperCase() } : {}),
    }
  }

  return out
}
