import { useEffect, useRef } from "react"
import { isNativeApp } from "@/lib/utils/capacitor"
import { useToast } from "@/lib/context/toast-context"
import { useLocation } from "@tanstack/react-router"

/**
 * Handles Android hardware back button in Capacitor.
 *
 * Priority:
 * 1. Close any open Radix dialog/drawer
 * 2. Navigate back in history
 * 3. Double-tap to exit from home screen
 *
 * Uses @capacitor/app's `backButton` event — the Cordova-era
 * `document.addEventListener("backbutton", ...)` is NOT dispatched by Capacitor.
 */
export function useAndroidBackButton() {
  const { showToast } = useToast()
  const location = useLocation()
  const lastBackPress = useRef(0)

  useEffect(() => {
    if (!isNativeApp()) return

    let handle: { remove: () => void } | null = null
    let cancelled = false

    ;(async () => {
      const [{ App }] = await Promise.all([import("@capacitor/app")])
      if (cancelled) return

      handle = await App.addListener("backButton", async () => {
        // 1. Close any open Radix dialog/drawer/sheet
        const openOverlay = document.querySelector(
          '[data-state="open"][role="dialog"], [data-state="open"][data-vaul-drawer]'
        )
        if (openOverlay) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
          return
        }

        // 2. Navigate back if we have in-app history and aren't on home
        const segments = location.pathname.split("/").filter(Boolean)
        const isHome = segments.length === 0
        if (!isHome && window.history.length > 1) {
          window.history.back()
          return
        }

        // 3. Double-tap to exit from home
        const now = Date.now()
        if (now - lastBackPress.current < 2000) {
          await App.exitApp()
          return
        }
        lastBackPress.current = now
        showToast("Press back again to exit")
      })
    })()

    return () => {
      cancelled = true
      handle?.remove()
    }
  }, [location.pathname, showToast])
}
