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

  // Fire-and-forget: check for Play Store updates once the app is interactive.
  checkForAppUpdate().catch(() => { /* already logged */ })
}

/**
 * Check Play Store for an available app update. Prompts the user if one is
 * available. Silently no-ops on web, on debug builds, or when no update.
 */
export async function checkForAppUpdate() {
  if (!isNative()) return
  try {
    const { AppUpdate } = await import("@capawesome/capacitor-app-update")
    const info = await AppUpdate.getAppUpdateInfo()
    if (info.updateAvailability !== 2 /* UPDATE_AVAILABLE */) return
    if (info.immediateUpdateAllowed) {
      await AppUpdate.performImmediateUpdate()
    } else if (info.flexibleUpdateAllowed) {
      await AppUpdate.startFlexibleUpdate()
    } else {
      await AppUpdate.openAppStore()
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[app-update] check failed", err)
  }
}

/**
 * Request the native POST_NOTIFICATIONS permission on Android 13+ / iOS and
 * register for push. Listener forwards the FCM token to the backend once
 * granted. Safe to call repeatedly — OS only shows the dialog the first time.
 */
export async function requestNotificationPermission(
  onToken?: (token: string) => void | Promise<void>,
) {
  if (!isNative()) return "unsupported" as const
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications")

    const current = await PushNotifications.checkPermissions()
    let status = current.receive
    if (status === "prompt" || status === "prompt-with-rationale") {
      const result = await PushNotifications.requestPermissions()
      status = result.receive
    }
    if (status !== "granted") return status

    if (onToken) {
      await PushNotifications.addListener("registration", async ({ value }) => {
        try {
          await onToken(value)
        } catch (err) {
          if (import.meta.env.DEV) console.warn("[push] token handler failed", err)
        }
      })
    }

    await PushNotifications.register()
    return status
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[push] native permission request failed", err)
    return "error" as const
  }
}
