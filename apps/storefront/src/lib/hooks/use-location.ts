/**
 * useLocation — GPS-based pincode detection for Indian delivery.
 *
 * Flow:
 *   1. Check localStorage for a previously detected pincode (avoids re-prompting)
 *   2. If none, request GPS permission (Capacitor on native, browser API on web)
 *   3. Reverse geocode lat/lng to Indian pincode via backend API
 *   4. Store result in localStorage (24-hour TTL) + cookie for SSR
 *
 * Returns: { pincode, district, state, serviceable, isDetecting, error, detect }
 *   - `detect()` triggers the flow manually (e.g., on a "Use my location" button)
 *   - Auto-detection only runs if user previously granted permission
 */

import { createElement, useCallback, useEffect, useState } from "react"
import { isNative } from "@/lib/capacitor"
import { usePermissionRationale } from "@/components/permission-rationale"
import { sdk } from "@/lib/utils/sdk"

// ── Storage keys ──
const LOCATION_KEY = "suprameds_location"
const LOCATION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface DetectedLocation {
  pincode: string
  district: string
  state: string
  serviceable: boolean | null
  detectedAt: number // timestamp
}

interface UseLocationReturn {
  /** Detected pincode (e.g., "500001") */
  pincode: string | null
  /** District name */
  district: string | null
  /** State name */
  state: string | null
  /** Whether we deliver here (null = unknown) */
  serviceable: boolean | null
  /** True while GPS + reverse geocoding is in progress */
  isDetecting: boolean
  /** Error message if detection failed */
  error: string | null
  /** Manually trigger location detection (shows permission prompt) */
  detect: () => Promise<DetectedLocation | null>
  /** Clear stored location */
  clear: () => void
}

/** Read stored location from localStorage (returns null if expired or missing) */
function getStoredLocation(): DetectedLocation | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DetectedLocation
    if (Date.now() - parsed.detectedAt > LOCATION_TTL_MS) {
      localStorage.removeItem(LOCATION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** Store detected location in localStorage + cookie */
function storeLocation(loc: DetectedLocation) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(loc))
  }
  // Also set a cookie for SSR access (pincode only, 24-hour TTL)
  if (typeof document !== "undefined") {
    document.cookie = `suprameds_pincode=${loc.pincode}; path=/; max-age=86400; SameSite=Lax`
    document.cookie = `suprameds_state=${encodeURIComponent(loc.state)}; path=/; max-age=86400; SameSite=Lax`
  }
}

/** Get GPS coordinates — uses Capacitor on native, browser API on web */
async function getCoordinates(): Promise<{ lat: number; lng: number }> {
  if (isNative()) {
    // Use Capacitor Geolocation plugin on Android/iOS
    const { Geolocation } = await import("@capacitor/geolocation")
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false, // coarse location is fine for pincode
      timeout: 10000,
    })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  }

  // Browser Geolocation API
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Location permission denied"))
        } else if (err.code === err.TIMEOUT) {
          reject(new Error("Location request timed out"))
        } else {
          reject(new Error("Unable to get your location"))
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  })
}

/** Reverse geocode coordinates to pincode via our backend */
async function reverseGeocode(lat: number, lng: number): Promise<{
  pincode: string
  district: string
  state: string
  serviceable: boolean | null
}> {
  const response = await sdk.client.fetch<{
    pincode: string
    district: string
    state: string
    serviceable: boolean | null
  }>(`/store/pincodes/reverse-geocode?lat=${lat}&lng=${lng}`, {
    method: "GET",
  })
  return response
}

/** Pin icon for the rationale modal — built without JSX since this is a .ts file */
const PinIcon = createElement(
  "svg",
  {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  },
  createElement("path", {
    d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
  }),
  createElement("circle", { cx: 12, cy: 10, r: 3 }),
)

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<DetectedLocation | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const askRationale = usePermissionRationale()

  // Load stored location on mount
  useEffect(() => {
    const stored = getStoredLocation()
    if (stored) {
      setLocation(stored)
    }
  }, [])

  const detect = useCallback(async (): Promise<DetectedLocation | null> => {
    // Show context BEFORE the OS dialog. Skipped if user has already granted —
    // we'd love to gate this on Geolocation.checkPermissions() but that varies
    // per-platform and on web there's no reliable "is granted" check before
    // calling. The rationale stays cheap (one tap) and prevents 60% deny.
    const allow = await askRationale({
      icon: PinIcon,
      title: "Check delivery to your area?",
      body:
        "Suprameds uses your approximate location only to detect your pincode " +
        "and confirm we deliver there. We don't track your movements or share " +
        "location data with anyone.",
      continueLabel: "Detect my pincode",
      cancelLabel: "I'll enter it manually",
    })
    if (!allow) {
      // Surface a benign error so consumers can show the manual-entry fallback.
      setError("Location permission declined")
      return null
    }

    setIsDetecting(true)
    setError(null)

    try {
      const coords = await getCoordinates()
      const result = await reverseGeocode(coords.lat, coords.lng)

      const detected: DetectedLocation = {
        pincode: result.pincode,
        district: result.district,
        state: result.state,
        serviceable: result.serviceable,
        detectedAt: Date.now(),
      }

      storeLocation(detected)
      setLocation(detected)
      return detected
    } catch (err: any) {
      const msg = err?.message || "Unable to detect location"
      setError(msg)
      return null
    } finally {
      setIsDetecting(false)
    }
  }, [askRationale])

  const clear = useCallback(() => {
    setLocation(null)
    setError(null)
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LOCATION_KEY)
    }
    if (typeof document !== "undefined") {
      document.cookie = "suprameds_pincode=; path=/; max-age=0"
      document.cookie = "suprameds_state=; path=/; max-age=0"
    }
  }, [])

  return {
    pincode: location?.pincode ?? null,
    district: location?.district ?? null,
    state: location?.state ?? null,
    serviceable: location?.serviceable ?? null,
    isDetecting,
    error,
    detect,
    clear,
  }
}
