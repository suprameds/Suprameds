/**
 * Capacitor native plugin initialization.
 *
 * Only runs on native platforms (Android/iOS).
 * Falls back silently on web — safe to call unconditionally.
 */
import { Capacitor } from "@capacitor/core"

/** True when running inside a native Capacitor shell (Android/iOS) */
export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/** Initialize native plugins after app mount */
export async function initCapacitorPlugins() {
  if (!isNative()) return

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar")
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: "#1E2D5A" })
  } catch {
    /* web fallback — StatusBar not available */
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen")
    await SplashScreen.hide()
  } catch {
    /* web fallback — SplashScreen not available */
  }
}
