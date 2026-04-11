/**
 * Indian state/UT name → 2-digit GSTN state code mapping.
 * Used for place-of-supply determination in GSTR-1 section classification.
 * Ref: https://www.gst.gov.in/help/statecodemaster
 */

const STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  punjab: "03",
  chandigarh: "04",
  uttarakhand: "05",
  haryana: "06",
  delhi: "07",
  rajasthan: "08",
  "uttar pradesh": "09",
  bihar: "10",
  sikkim: "11",
  "arunachal pradesh": "12",
  nagaland: "13",
  manipur: "14",
  mizoram: "15",
  tripura: "16",
  meghalaya: "17",
  assam: "18",
  "west bengal": "19",
  jharkhand: "20",
  odisha: "21",
  chhattisgarh: "22",
  "madhya pradesh": "23",
  gujarat: "24",
  "dadra and nagar haveli and daman and diu": "26",
  maharashtra: "27",
  "andhra pradesh": "37",
  karnataka: "29",
  goa: "30",
  lakshadweep: "31",
  kerala: "32",
  "tamil nadu": "33",
  puducherry: "34",
  "andaman and nicobar islands": "35",
  telangana: "36",
  ladakh: "38",
}

// Common aliases
const ALIASES: Record<string, string> = {
  ap: "37",
  ts: "36",
  tn: "33",
  ka: "29",
  mh: "27",
  gj: "24",
  rj: "08",
  up: "09",
  mp: "23",
  wb: "19",
  dl: "07",
  hr: "06",
  pb: "03",
  uk: "05",
  jk: "01",
  hp: "02",
  br: "10",
  or: "21",
  cg: "22",
  jh: "20",
  ga: "30",
  sk: "11",
  "new delhi": "07",
  bengaluru: "29",
  bangalore: "29",
  mumbai: "27",
  chennai: "33",
  hyderabad: "36",
  kolkata: "19",
  pune: "27",
}

/**
 * Convert a state name to its 2-digit GSTN state code.
 * Case-insensitive. Returns null for unrecognized states.
 */
export function stateNameToCode(name: string | null | undefined): string | null {
  if (!name || !name.trim()) return null
  const normalized = name.trim().toLowerCase()
  return STATE_CODES[normalized] ?? ALIASES[normalized] ?? null
}

/**
 * Get the seller's state code from environment or default to Telangana (36).
 */
export function getSellerStateCode(): string {
  const sellerState = process.env.WAREHOUSE_STATE || "Telangana"
  return stateNameToCode(sellerState) ?? "36"
}

/**
 * All valid state codes for validation purposes.
 */
export const VALID_STATE_CODES = new Set(
  Object.values(STATE_CODES)
)
