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

/** Sync status bar color with the active theme */
export async function syncStatusBarTheme(resolved: "light" | "dark") {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar")
    if (resolved === "dark") {
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setBackgroundColor({ color: "#0B1120" })
    } else {
      await StatusBar.setStyle({ style: Style.Light })
      await StatusBar.setBackgroundColor({ color: "#0D1B2A" })
    }
  } catch { /* not available */ }
}

/** Initialize native plugins after app mount */
export async function initCapacitorPlugins() {
  if (!isNative()) return

  // Read saved theme to set initial status bar color (prevents flash)
  const saved = typeof localStorage !== "undefined"
    ? localStorage.getItem("suprameds-theme")
    : null
  const isDark = saved === "dark" || (!saved && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar")
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({ color: isDark ? "#0B1120" : "#0D1B2A" })
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
