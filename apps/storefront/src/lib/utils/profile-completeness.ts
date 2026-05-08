import type { PharmaCustomerMetadata } from "@/lib/types/pharma-customer"

type CustomerLike = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  metadata?: PharmaCustomerMetadata | Record<string, unknown> | null
}

const PHONE_BRIDGE_RE = /@phone\.suprameds\.in$/i

const FIELDS: Array<{ key: string; weight: number; check: (c: CustomerLike) => boolean }> = [
  { key: "phone", weight: 20, check: (c) => !!c.phone },
  { key: "first_name", weight: 15, check: (c) => !!c.first_name },
  { key: "last_name", weight: 15, check: (c) => !!c.last_name },
  { key: "email", weight: 15, check: (c) => !!c.email && !PHONE_BRIDGE_RE.test(c.email) },
  { key: "dob", weight: 10, check: (c) => !!(c.metadata as PharmaCustomerMetadata | null | undefined)?.dob },
  { key: "gender", weight: 10, check: (c) => !!(c.metadata as PharmaCustomerMetadata | null | undefined)?.gender },
  { key: "preferred_language", weight: 5, check: (c) => !!(c.metadata as PharmaCustomerMetadata | null | undefined)?.preferred_language },
  { key: "allergies", weight: 5, check: (c) => Array.isArray((c.metadata as PharmaCustomerMetadata | null | undefined)?.allergies) },
  { key: "emergency_contact", weight: 5, check: (c) => !!(c.metadata as PharmaCustomerMetadata | null | undefined)?.emergency_contact?.phone },
]

export function computeProfileCompleteness(customer: CustomerLike): { percent: number; missing: string[] } {
  const missing: string[] = []
  let earned = 0
  let total = 0
  for (const f of FIELDS) {
    total += f.weight
    if (f.check(customer)) {
      earned += f.weight
    } else {
      missing.push(f.key)
    }
  }
  return { percent: Math.round((earned / total) * 100), missing }
}
