import { isNativeApp } from "@/lib/utils/capacitor"

/**
 * Haptic feedback utilities for native app.
 * No-ops silently on web. Uses @capacitor/haptics (already installed).
 */

/** Tactile impact for button presses (add-to-cart, submit) */
export async function hapticImpact(style: "light" | "medium" | "heavy" = "medium") {
  if (!isNativeApp()) return
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics")
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] })
  } catch { /* not available */ }
}

/** Notification feedback for form results (success, error, warning) */
export async function hapticNotification(type: "success" | "warning" | "error" = "success") {
  if (!isNativeApp()) return
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics")
    const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error }
    await Haptics.notification({ type: map[type] })
  } catch { /* not available */ }
}

/** Lightest vibration for tab switches, option selects */
export async function hapticSelection() {
  if (!isNativeApp()) return
  try {
    const { Haptics } = await import("@capacitor/haptics")
    await Haptics.selectionStart()
    await Haptics.selectionEnd()
  } catch { /* not available */ }
}
