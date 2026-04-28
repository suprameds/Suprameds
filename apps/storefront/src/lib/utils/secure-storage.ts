/**
 * Secure storage abstraction for auth-equivalent tokens.
 *
 * Why this exists: WebView localStorage is readable by any injected script
 * (XSS = full session takeover). On native, Capacitor Preferences writes to
 * Android SharedPreferences, which is sandboxed to the app's UID and not
 * readable from WebView JS — narrowing the XSS blast radius.
 *
 * Layout:
 *   - Native (Capacitor): Capacitor Preferences (Android SharedPreferences,
 *     iOS UserDefaults). NOT cryptographically encrypted by default, but
 *     sandboxed per-app + not exposed to the WebView's JS context.
 *   - Web (browser): localStorage fallback. No better sync-accessible option.
 *
 * Synchronous read API: callers (especially the Medusa SDK auth fallback)
 * expect `getItem()` to be sync. We hydrate Capacitor Preferences into an
 * in-memory cache once on app boot via `hydrateSecureStorage()`, then serve
 * sync reads from the cache. Writes are write-through (cache + async
 * Preferences set, fire-and-forget).
 *
 * Migration: on first native boot after this lands, any value already in
 * localStorage is copied to Preferences and removed from localStorage. After
 * that, Preferences is the source of truth on native.
 */
import { isNativeApp } from "@/lib/utils/capacitor"

/** Keys that should live in secure storage on native. */
const SECURE_KEYS = ["_suprameds_otp_jwt"] as const
type SecureKey = (typeof SECURE_KEYS)[number]

/** In-memory cache for sync reads on native. */
const cache = new Map<string, string | null>()

let hydrated = false
let hydrationPromise: Promise<void> | null = null

/**
 * Hydrate the in-memory cache from Capacitor Preferences (native) and migrate
 * any pre-existing localStorage values. Idempotent — call as early in the
 * native init path as possible (before useCustomer fires).
 */
export async function hydrateSecureStorage(): Promise<void> {
  if (hydrated) return
  if (hydrationPromise) return hydrationPromise

  hydrationPromise = (async () => {
    if (!isNativeApp()) {
      hydrated = true
      return
    }
    try {
      const { Preferences } = await import("@capacitor/preferences")

      for (const key of SECURE_KEYS) {
        const fromPrefs = await Preferences.get({ key })
        if (fromPrefs.value !== null && fromPrefs.value !== undefined) {
          cache.set(key, fromPrefs.value)
          continue
        }
        // No value in Preferences yet — migrate from localStorage if present.
        if (typeof localStorage !== "undefined") {
          const legacy = localStorage.getItem(key)
          if (legacy) {
            await Preferences.set({ key, value: legacy })
            localStorage.removeItem(key)
            cache.set(key, legacy)
            continue
          }
        }
        cache.set(key, null)
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[secure-storage] hydration failed, falling back to localStorage", err)
      }
    } finally {
      hydrated = true
    }
  })()

  return hydrationPromise
}

/** Sync read. On native uses the in-memory cache; on web reads localStorage. */
export function secureGet(key: SecureKey): string | null {
  if (!isNativeApp()) {
    if (typeof localStorage === "undefined") return null
    return localStorage.getItem(key)
  }
  // Native: prefer cache; if hydration hasn't run yet, fall back to localStorage
  // (it'll be the legacy value during migration, or null on fresh installs).
  if (!hydrated) {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key)
    return null
  }
  return cache.get(key) ?? null
}

/** Write-through: updates cache synchronously and writes async to Preferences. */
export function secureSet(key: SecureKey, value: string): void {
  cache.set(key, value)
  if (!isNativeApp()) {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(key, value)
    return
  }
  void (async () => {
    try {
      const { Preferences } = await import("@capacitor/preferences")
      await Preferences.set({ key, value })
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[secure-storage] set failed", err)
      }
    }
  })()
}

/** Remove from both cache and persistent backing. */
export function secureRemove(key: SecureKey): void {
  cache.delete(key)
  if (!isNativeApp()) {
    if (typeof localStorage === "undefined") return
    localStorage.removeItem(key)
    return
  }
  void (async () => {
    try {
      const { Preferences } = await import("@capacitor/preferences")
      await Preferences.remove({ key })
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[secure-storage] remove failed", err)
      }
    }
  })()
}
