import { useState, useEffect } from "react"
import { Keyboard } from "@capacitor/keyboard"
import { isNativeApp } from "@/lib/utils/capacitor"

/**
 * Detects whether the Android soft keyboard is open.
 * Uses @capacitor/keyboard events (reliable across all softInputMode settings),
 * with a Visual Viewport API fallback for edge cases.
 * Returns false on web (non-native) platforms.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isNativeApp()) return

    let showListener: Awaited<ReturnType<typeof Keyboard.addListener>> | null = null
    let hideListener: Awaited<ReturnType<typeof Keyboard.addListener>> | null = null

    Keyboard.addListener("keyboardWillShow", () => setVisible(true)).then((l) => { showListener = l })
    Keyboard.addListener("keyboardWillHide", () => setVisible(false)).then((l) => { hideListener = l })

    // Fallback: Visual Viewport for cases where Capacitor events don't fire
    let timeoutId: ReturnType<typeof setTimeout>
    const vpHandler = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        const vp = window.visualViewport
        if (!vp) return
        setVisible(vp.height < window.innerHeight * 0.75)
      }, 100)
    }
    window.visualViewport?.addEventListener("resize", vpHandler)

    return () => {
      clearTimeout(timeoutId)
      window.visualViewport?.removeEventListener("resize", vpHandler)
      showListener?.remove()
      hideListener?.remove()
    }
  }, [])

  return visible
}
