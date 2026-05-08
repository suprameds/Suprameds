/**
 * Phone number display + normalization helpers.
 *
 * The backend has historically stored customer.phone in two formats:
 *   - 10-digit (legacy email/password registration):     "9876543210"
 *   - E.164 without `+` (OTP signup, normalisePhone()):  "919876543210"
 *
 * These helpers paper over both so display and form-fill code don't
 * end up rendering "+91 919876543210" (the duplicated 91 bug).
 */

/** Strip non-digits and return the last 10 digits — the local Indian number. */
export function toTenDigitIndian(phone: string | null | undefined): string {
  if (!phone) return ""
  return phone.replace(/\D/g, "").slice(-10)
}

/** Format any stored phone for display as "+91 9876543210". Returns "—" if empty. */
export function formatIndianPhone(phone: string | null | undefined): string {
  const ten = toTenDigitIndian(phone)
  return ten ? `+91 ${ten}` : "—"
}
