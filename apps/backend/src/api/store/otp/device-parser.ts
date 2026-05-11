import { createHash } from "crypto"
import type { MedusaRequest } from "@medusajs/framework/http"

/**
 * Lightweight User-Agent parser for login device tracking.
 *
 * We intentionally avoid pulling in a full UA-parser library (ua-parser-js
 * etc.) — they're 100KB+ for what we use: knowing whether the login came
 * from Windows / macOS / Android / iOS / Linux and roughly which browser.
 *
 * Storage shape (per entry in auth_identity.app_metadata.last_devices[]):
 *   {
 *     ua:       string (truncated to 200 chars to bound storage)
 *     os:       "Windows" | "macOS" | "Android" | "iOS" | "Linux" | "unknown"
 *     browser:  "Chrome" | "Safari" | "Firefox" | "Edge" | "App" | "unknown"
 *     platform: "web" | "android-app" | "ios-app"
 *     ip_hash:  16-char hex (sha256 of IP, truncated — privacy-safe, no raw IP)
 *     at:       ISO timestamp
 *   }
 *
 * Privacy notes:
 *   - We hash the IP rather than store it. Same IP across logins still
 *     produces a stable hash so you can spot "logged in from same place"
 *     without keeping the raw address.
 *   - Hash is salted with COOKIE_SECRET so the hash isn't trivially
 *     reversible via a rainbow table of all 4B IPv4 addresses.
 *   - UA is capped at 200 chars (real UA strings are ~120-180 chars).
 */

export interface DeviceSnapshot {
  ua: string
  os: "Windows" | "macOS" | "Android" | "iOS" | "Linux" | "unknown"
  browser: "Chrome" | "Safari" | "Firefox" | "Edge" | "App" | "unknown"
  platform: "web" | "android-app" | "ios-app"
  ip_hash: string
  at: string
}

const IP_HASH_SALT = process.env.COOKIE_SECRET || "suprameds-dev-salt"

function detectOs(ua: string): DeviceSnapshot["os"] {
  // Order matters: Android UAs contain "Linux", so check Android first.
  if (/Android/i.test(ua)) return "Android"
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS"
  if (/Windows/i.test(ua)) return "Windows"
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS"
  if (/Linux/i.test(ua)) return "Linux"
  return "unknown"
}

function detectBrowser(ua: string, platform: DeviceSnapshot["platform"]): DeviceSnapshot["browser"] {
  // Native apps show their webview UA, but conceptually "browser = App"
  // is what an admin cares about.
  if (platform !== "web") return "App"
  // Order matters: Edge UAs contain "Chrome" + "Safari"; Chrome contains "Safari".
  if (/Edg\//i.test(ua)) return "Edge"
  if (/Firefox\//i.test(ua)) return "Firefox"
  if (/Chrome\//i.test(ua)) return "Chrome"
  if (/Safari\//i.test(ua)) return "Safari"
  return "unknown"
}

function detectPlatform(ua: string): DeviceSnapshot["platform"] {
  // Capacitor signature first (most specific — set by @capacitor/core)
  if (/CapacitorHttp|; capacitor/i.test(ua)) {
    if (/Android/i.test(ua)) return "android-app"
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios-app"
  }
  // Android WebView fallback: UAs contain "; wv)" or "Version/.* Mobile"
  if (/Android.+;\s*wv\)/i.test(ua)) return "android-app"
  // No reliable Capacitor-less iOS-webview UA pattern — leave as web.
  return "web"
}

function getClientIp(req: MedusaRequest): string {
  // Trust Railway/Cloudflare proxy headers. They're set by the edge and
  // can't be spoofed by the client when we're behind that proxy.
  const fwd = (req.headers["x-forwarded-for"] as string | undefined) || ""
  const cf = (req.headers["cf-connecting-ip"] as string | undefined) || ""
  const candidate = cf || fwd.split(",")[0]?.trim() || (req as any).ip || ""
  return candidate || "unknown"
}

function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${IP_HASH_SALT}:${ip}`)
    .digest("hex")
    .slice(0, 16)
}

/**
 * Build a DeviceSnapshot from a Medusa request. Returns null if no UA
 * is present (defensive — every browser/app sets one, but be tolerant).
 */
export function parseDevice(req: MedusaRequest): DeviceSnapshot | null {
  const rawUa = (req.headers["user-agent"] as string | undefined) || ""
  if (!rawUa) return null

  const ua = rawUa.slice(0, 200)
  const platform = detectPlatform(ua)
  const os = detectOs(ua)
  const browser = detectBrowser(ua, platform)
  const ip_hash = hashIp(getClientIp(req))

  return {
    ua,
    os,
    browser,
    platform,
    ip_hash,
    at: new Date().toISOString(),
  }
}

/**
 * Merge a new device snapshot into an existing last_devices array.
 *
 * Rules:
 *   - Keep at most MAX entries (newest first).
 *   - If the most recent entry matches (same os/browser/platform/ip_hash)
 *     and was less than DEDUP_WINDOW_MS ago, just update its timestamp
 *     instead of adding a duplicate. Stops a tab-spam from blowing the
 *     window.
 */
const MAX_DEVICES = 5
const DEDUP_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export function mergeDevice(
  prev: unknown,
  fresh: DeviceSnapshot
): DeviceSnapshot[] {
  const list = Array.isArray(prev) ? (prev as DeviceSnapshot[]) : []

  // Filter out anything that's not a valid-looking entry (defensive)
  const clean = list.filter(
    (d) => d && typeof d === "object" && typeof d.at === "string"
  )

  const top = clean[0]
  const sameDevice =
    top &&
    top.os === fresh.os &&
    top.browser === fresh.browser &&
    top.platform === fresh.platform &&
    top.ip_hash === fresh.ip_hash

  if (sameDevice) {
    const lastSeen = new Date(top.at).getTime()
    if (Date.now() - lastSeen < DEDUP_WINDOW_MS) {
      // Update the timestamp on the existing entry, no duplicate.
      return [{ ...top, at: fresh.at }, ...clean.slice(1)]
    }
  }

  return [fresh, ...clean].slice(0, MAX_DEVICES)
}
