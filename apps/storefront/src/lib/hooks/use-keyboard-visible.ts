import { useState, useEffect } from "react"
import { isNativeApp } from "@/lib/utils/capacitor"

/**
 * Detects whether the Android soft keyboard is open.
 * Uses the Visual Viewport API to compare viewport height against window height.
 * Returns false on web (non-native) platforms.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isNativeApp()) return
    if (typeof window === "undefined" || !window.visualViewport) return

    let timeoutId: ReturnType<typeof setTimeout>

    const handler = () => {
      clearTimeout(timeoutId)
      // Debounce 100ms for Samsung keyboard edge cases
      timeoutId = setTimeout(() => {
        const vp = window.visualViewport
        if (!vp) return
        setVisible(vp.height < window.innerHeight * 0.75)
      }, 100)
    }

    window.visualViewport.addEventListener("resize", handler)
    return () => {
      clearTimeout(timeoutId)
      window.visualViewport?.removeEventListener("resize", handler)
    }
  }, [])

  return visible
}
