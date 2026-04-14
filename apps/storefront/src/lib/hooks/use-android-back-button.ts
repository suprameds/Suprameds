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
 */
export function useAndroidBackButton() {
  const { showToast } = useToast()
  const location = useLocation()
  const lastBackPress = useRef(0)

  useEffect(() => {
    if (!isNativeApp()) return

    const handler = (e: Event) => {
      e.preventDefault()

      // 1. Close any open Radix dialog/drawer/sheet
      const openOverlay = document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][data-vaul-drawer]'
      )
      if (openOverlay) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
        return
      }

      // 2. Navigate back if not on home
      const segments = location.pathname.split("/").filter(Boolean)
      const isHome = segments.length <= 1 // e.g. "/in" or "/"
      if (!isHome && window.history.length > 1) {
        window.history.back()
        return
      }

      // 3. Double-tap to exit from home
      const now = Date.now()
      if (now - lastBackPress.current < 2000) {
        // Exit the app
        const nav = navigator as any
        if (nav.app?.exitApp) {
          nav.app.exitApp()
        }
        return
      }
      lastBackPress.current = now
      showToast("Press back again to exit")
    }

    document.addEventListener("backbutton", handler)
    return () => document.removeEventListener("backbutton", handler)
  }, [location.pathname, showToast])
}
