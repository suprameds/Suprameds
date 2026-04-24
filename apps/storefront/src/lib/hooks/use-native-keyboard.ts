import { useEffect } from "react"
import { isNativeApp } from "@/lib/utils/capacitor"

/**
 * Wires @capacitor/keyboard:
 *  - Adds \`--kb-height\` CSS var so layouts can shift content above the keyboard
 *    (already handled natively via WindowInsetsCompat in MainActivity, but the
 *     CSS var lets React code react, e.g. scroll the focused input into view).
 *  - Sets accessoryBarVisible(false) on iOS \u2014 no-op on Android but harmless.
 */
export function useNativeKeyboard() {
  useEffect(() => {
    if (!isNativeApp()) return

    let handles: Array<{ remove: () => void }> = []
    let cancelled = false

    ;(async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard")
        if (cancelled) return

        const setKb = (h: number) => {
          document.documentElement.style.setProperty("--kb-height", `${h}px`)
          document.documentElement.dataset.keyboard = h > 0 ? "open" : "closed"
        }
        setKb(0)

        const show = await Keyboard.addListener("keyboardWillShow", ({ keyboardHeight }) => {
          setKb(keyboardHeight || 0)
        })
        const hide = await Keyboard.addListener("keyboardWillHide", () => {
          setKb(0)
        })
        handles = [show, hide]

        // iOS-only no-op on Android
        try { await Keyboard.setAccessoryBarVisible({ isVisible: false }) } catch { /* android */ }
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[keyboard] init failed", err)
      }
    })()

    return () => {
      cancelled = true
      handles.forEach((h) => h.remove())
      document.documentElement.style.removeProperty("--kb-height")
      delete document.documentElement.dataset.keyboard
    }
  }, [])
}
