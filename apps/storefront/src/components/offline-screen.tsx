import { useState, useEffect } from "react"
import { isNativeApp } from "@/lib/utils/capacitor"

const WifiOffIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M8.5 16.5a5 5 0 017 0" />
    <path d="M2 8.82a15 15 0 014.17-2.65" />
    <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
    <path d="M16.85 11.25a10 10 0 01.7.4" />
    <path d="M5 12.55a10 10 0 015.17-3.3" />
    <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
  </svg>
)

const PillIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
  </svg>
)

/**
 * Branded offline screen shown when the app has no internet connection.
 * Only renders inside native Capacitor shell. Uses navigator.onLine for detection.
 */
export function OfflineScreen() {
  const [isOffline, setIsOffline] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (!isNativeApp()) return

    let listenerHandle: { remove: () => void } | null = null
    let cancelled = false

    ;(async () => {
      try {
        const { Network } = await import("@capacitor/network")
        const status = await Network.getStatus()
        if (cancelled) return
        setIsOffline(!status.connected)
        listenerHandle = await Network.addListener("networkStatusChange", (s) => {
          setIsOffline(!s.connected)
        })
      } catch {
        // Fallback to browser events if Network plugin unavailable
        if (!navigator.onLine) setIsOffline(true)
        const goOffline = () => setIsOffline(true)
        const goOnline = () => setIsOffline(false)
        window.addEventListener("offline", goOffline)
        window.addEventListener("online", goOnline)
        listenerHandle = {
          remove: () => {
            window.removeEventListener("offline", goOffline)
            window.removeEventListener("online", goOnline)
          },
        }
      }
    })()

    return () => {
      cancelled = true
      listenerHandle?.remove()
    }
  }, [])

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const { Network } = await import("@capacitor/network")
      const status = await Network.getStatus()
      if (status.connected) {
        window.location.reload()
        return
      }
    } catch {
      if (navigator.onLine) {
        window.location.reload()
        return
      }
    }
    setTimeout(() => setRetrying(false), 800)
  }

  if (!isOffline) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "var(--bg-primary, #F8F6F2)" }}
    >
      {/* Brand mark */}
      <div className="mb-8 flex items-center gap-2" style={{ color: "var(--brand-teal, #0E7C86)" }}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, var(--brand-teal, #0E7C86), #0a9272)" }}
        >
          <div style={{ color: "white" }}>
            <PillIcon />
          </div>
        </div>
        <span
          className="text-xl font-semibold tracking-tight"
          style={{ color: "var(--text-primary, #0D1B2A)", fontFamily: "Fraunces, Georgia, serif" }}
        >
          Suprameds
        </span>
      </div>

      {/* Offline indicator */}
      <div className="mb-6" style={{ color: "var(--text-tertiary, #8899a6)" }}>
        <WifiOffIcon />
      </div>

      <h2
        className="text-lg font-semibold mb-2"
        style={{ color: "var(--text-primary, #0D1B2A)" }}
      >
        No internet connection
      </h2>

      <p
        className="text-sm mb-8 max-w-xs leading-relaxed"
        style={{ color: "var(--text-secondary, #5a6a7a)" }}
      >
        Check your mobile data or Wi-Fi connection and try again. Your cart and account are safe.
      </p>

      <button
        onClick={handleRetry}
        disabled={retrying}
        className="px-8 py-3 rounded-full text-sm font-semibold transition-all min-w-[160px]"
        style={{
          background: retrying ? "var(--bg-tertiary, #e8e8e8)" : "var(--brand-teal, #0E7C86)",
          color: retrying ? "var(--text-tertiary)" : "white",
        }}
      >
        {retrying ? "Checking..." : "Try again"}
      </button>

      <p
        className="mt-12 text-xs"
        style={{ color: "var(--text-tertiary, #8899a6)" }}
      >
        Need help? Call{" "}
        <a href="tel:+917674962758" className="underline">+91 76749 62758</a>
      </p>
    </div>
  )
}
