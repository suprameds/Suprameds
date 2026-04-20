/**
 * Ad click attribution — captures click IDs and UTM params on first touch,
 * persists them for the Google Ads / GA4 attribution window, and makes them
 * available for inclusion in conversion events.
 *
 * Google Ads cookie window: 90 days (gclid/wbraid/gbraid).
 * UTM params are session-only by convention but we persist them 90 days too
 * so they can be attached to a delayed purchase.
 *
 * First-touch wins: once a click ID is stored, later untagged visits do not
 * overwrite it. A new tagged visit (new gclid) DOES overwrite, matching
 * Google Ads' last-click attribution default.
 */

const STORAGE_KEY = "suprameds_ad_attribution"
const TTL_MS = 90 * 24 * 60 * 60 * 1000

const CLICK_ID_PARAMS = ["gclid", "gbraid", "wbraid", "gclsrc"] as const
const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const

type ClickIdParam = (typeof CLICK_ID_PARAMS)[number]
type UtmParam = (typeof UTM_PARAMS)[number]

export type AdAttribution = Partial<Record<ClickIdParam | UtmParam, string>> & {
  /** Unix ms when these values were captured. Used for TTL expiry. */
  captured_at?: number
  /** Landing page URL where the click was captured. */
  landing_page?: string
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

function readStored(): AdAttribution | null {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdAttribution
    if (parsed.captured_at && Date.now() - parsed.captured_at > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStored(data: AdAttribution): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Quota exceeded or storage disabled — attribution is best-effort.
  }
}

function extractFromUrl(search: string): AdAttribution {
  const params = new URLSearchParams(search)
  const out: AdAttribution = {}
  for (const key of CLICK_ID_PARAMS) {
    const v = params.get(key)
    if (v) out[key] = v
  }
  for (const key of UTM_PARAMS) {
    const v = params.get(key)
    if (v) out[key] = v
  }
  return out
}

function hasClickId(attr: AdAttribution): boolean {
  return CLICK_ID_PARAMS.some((k) => Boolean(attr[k]))
}

/**
 * Captures ad attribution from the current URL and merges it with any
 * previously stored attribution. Call once on app mount.
 *
 * Merge rule: if the new URL has a click ID, it replaces the stored record
 * entirely (last-click attribution). If the new URL has only UTM params and
 * no click ID, and stored attribution already has a click ID, the stored
 * record wins (never dilute a paid click with organic UTMs).
 */
export function captureAdAttribution(): AdAttribution | null {
  if (!isBrowser()) return null

  const fresh = extractFromUrl(window.location.search)
  const freshHasClickId = hasClickId(fresh)
  const freshHasAnything =
    freshHasClickId || UTM_PARAMS.some((k) => Boolean(fresh[k]))

  if (!freshHasAnything) {
    return readStored()
  }

  const stored = readStored()
  const storedHasClickId = stored ? hasClickId(stored) : false

  if (!freshHasClickId && storedHasClickId) {
    return stored
  }

  const merged: AdAttribution = {
    ...fresh,
    captured_at: Date.now(),
    landing_page: window.location.pathname + window.location.search,
  }
  writeStored(merged)
  return merged
}

/** Reads stored ad attribution without mutating it. Returns null if expired or absent. */
export function getAdAttribution(): AdAttribution | null {
  return readStored()
}

/** Clears stored attribution — useful for tests and logout flows. */
export function clearAdAttribution(): void {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}
